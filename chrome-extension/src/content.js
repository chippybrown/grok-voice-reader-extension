// Watches one Grok chat tab. Speaks only a bot reply that shows up after
// this script arms (page load, or the moment the popup switch is turned on).
(function (root) {
  "use strict";

  var GV = root.GrokVoice;
  var voiceURI = GV.DEFAULTS.voiceURI;
  var rate = GV.DEFAULTS.rate;
  var debug = GV.DEFAULTS.debug === true;
  var keys = new WeakMap();
  var keySeq = 1;
  var scanTimer = null;
  var observer = null;
  var shadowObservers = new WeakSet();
  var debugEl = null;
  var DEBUG_CLASS = "grok-voice-debug-target";
  var queuedSpeech = "";
  var unlockArmed = false;
  var cachedVoice = null;
  var cachedVoiceURI = null;
  var botSettings = GV.DEFAULTS;
  var botIdentity = { id: "default", name: "Grok" };
  var replyItems = [];
  var speakToken = 0;
  var readingEl = null;
  var readingMode = "";
  var botKey = "";
  var readMode = "play";
  var pausedKey = "";
  var sentencePainter = null;
  var piperBusy = false;
  var piperTicket = 0;
  var chunkAudio = null;
  // Control bar state (src/toolbar.js). stopHeld: Stop was pressed, so stay
  // quiet and unoutlined until Play or a reply click.
  var stopHeld = false;
  var watching = true;
  var toolbar = null;
  var paraPos = { reply: -1, para: -1 };
  var lastBotId = "";
  var showBar = true;
  var paraMarkedAt = 0;

  var playback = GV.createPlayback({
    onSpeak: function (text, item) {
      speakManual(text, item && (item.body || item.element));
    },
    onPause: pauseSpeech,
    onResume: resumeSpeech
  });

  function sentenceUi() {
    if (!sentencePainter && GV.createSentencePainter) sentencePainter = GV.createSentencePainter(document);
    return sentencePainter;
  }

  function paintSpoken(phrase, charIndex) {
    var ui = sentenceUi();
    if (!ui || !readingEl) return;
    var range = ui.show(readingEl, phrase, charIndex);
    if (range) pointAt(range.startContainer);
  }

  function clearSpoken() {
    if (sentencePainter) sentencePainter.clear();
  }

  // Voice pointer: mark the paragraph that holds the sentence being read.
  function pointAt(node) {
    if (!GV.replyParagraphs || !readingEl) return;
    var paras = GV.replyParagraphs(readingEl);
    for (var i = 0; i < paras.length; i++) {
      if (paras[i] === node || paras[i].contains(node)) {
        if (paraPos.reply !== playback.state().index || paraPos.para !== i) paraMarkedAt = Date.now();
        paraPos = { reply: playback.state().index, para: i };
        GV.markParagraph(document, paras[i]);
        updateStrip();
        return;
      }
    }
  }

  function clearPointer() {
    paraPos = { reply: -1, para: -1 };
    if (GV.markParagraph) GV.markParagraph(document, null);
    updateStrip();
  }

  function paragraphCounts() {
    var counts = [];
    for (var i = 0; i < replyItems.length; i++) counts.push(GV.replyParagraphs(replyBody(replyItems[i])).length);
    return counts;
  }

  // Read from one paragraph to the end of its reply.
  function playParagraph(target) {
    if (!target) return false;
    var item = replyItems[target.reply];
    if (!item) return false;
    var body = replyBody(item);
    var paras = GV.replyParagraphs(body);
    var text = paras.length ? GV.speechFromParagraph(paras, target.para) : item.speech;
    if (!text) return false;
    stopHeld = false;
    applyReadMode("play");
    pausedKey = "";
    playback.noteSpoken(item.key);
    speakManual(text, body);
    paraPos = { reply: target.reply, para: target.para };
    paraMarkedAt = Date.now();
    if (paras[target.para]) GV.markParagraph(document, paras[target.para]);
    updateBar();
    updateStrip();
    return true;
  }

  function currentPos() {
    var index = playback.state().index;
    if (index < 0) index = replyItems.length - 1;
    var para = paraPos.reply === index ? paraPos.para : -1;
    return { reply: index, para: para };
  }

  // Back / Forward one paragraph. Shift (or whole=true) jumps a reply.
  function stepParagraph(dir, whole) {
    var counts = paragraphCounts();
    var plan = whole ? GV.planReplyJump(currentPos(), counts, dir) : GV.planParagraphStep(currentPos(), counts, dir);
    if (!plan) {
      doEnd();
      return false;
    }
    return playParagraph(plan);
  }

  // Stop: silence, no outline, no pointer. Quiet until Play or a reply click.
  function doStop() {
    stopSpeaking();
    clearPointer();
    stopHeld = true;
    updateBar();
  }

  // End: silence, outline the newest reply, and wait for the next new one.
  function doEnd() {
    stopSpeaking();
    clearPointer();
    stopHeld = false;
    applyReadMode("play");
    var replies = GV.detectAssistantReplies(document);
    if (session.isEnabled()) session.arm(recordsFrom(replies));
    var last = replyItems.length ? replyItems[replyItems.length - 1] : null;
    if (last) {
      playback.select(last.key);
      showReading(replyBody(last));
    }
    updateBar();
  }

  function updateBar() {
    if (toolbar) toolbar.update(GV.toolbarStatus({ enabled: watching, mode: playback.state().mode, stopHeld: stopHeld }));
    updateStrip();
  }

  // Corner controls: |< ||/> >| >>| at the reply's lower right while
  // reading or paused. Follows the "Show on-page control bar" switch.
  function updateStrip() {
    if (!GV.setCornerExtras) return;
    var status = GV.toolbarStatus({ enabled: watching, mode: playback.state().mode, stopHeld: stopHeld });
    // 0.4.4: a reply with the corner keeps all four buttons while the bar
    // switch is on, so a brief idle between sentences or Piper chunks
    // cannot fold the group under the mouse.
    var on = GV.cornerExtrasWanted(status, showBar, Boolean(readingEl));
    cornerLog("extras", { status: status, mode: playback.state().mode, on: on });
    GV.setCornerExtras(on);
  }

  // Debug flag (popup) only: console.debug lines for the corner controls.
  function cornerLog(what, info) {
    if (!debug) return;
    try { console.debug("[GrokVoice corner] " + what, JSON.stringify(info || {})); } catch (err) { /* debug aid */ }
  }
  GV.debugCorner = function (type, event) {
    var t = event && event.composedPath ? event.composedPath()[0] : null;
    cornerLog(type, { target: t && t.getAttribute ? t.getAttribute("data-action") || t.tagName : "", mode: playback.state().mode, stopHeld: stopHeld });
  };

  // |< on the corner controls: restart the paragraph if more than 2 s in.
  function stripBack() {
    var partway = paraMarkedAt && Date.now() - paraMarkedAt > 2000;
    var plan = GV.planStripBack(currentPos(), paragraphCounts(), partway);
    if (plan) playParagraph(plan);
  }

  function onBarAction(action, event) {
    cornerLog("action " + action, { mode: playback.state().mode, para: paraPos });
    var shift = Boolean(event && event.shiftKey);
    if (action === "back") stepParagraph(-1, shift);
    else if (action === "forward") stepParagraph(1, shift);
    else if (action === "strip-back") stripBack();
    else if (action === "play-pause") onToggle();
    else if (action === "stop") doStop();
    else if (action === "end") doEnd();
    updateBar();
  }

  // Only the frame that shows replies gets a bar.
  function ensureToolbar() {
    if (toolbar || !showBar || !GV.createToolbar || !replyItems.length || !document.body) return;
    toolbar = GV.createToolbar(document, {
      onAction: onBarAction,
      load: function (cb) {
        try {
          chrome.storage.local.get({ toolbar: GV.DEFAULTS.toolbar }, function (stored) { cb(stored && stored.toolbar); });
        } catch (err) { cb(null); }
      },
      save: function (pos) {
        try { chrome.storage.local.set({ toolbar: pos }); } catch (err) { /* storage can be unavailable in a test page */ }
      }
    });
    updateBar();
  }

  // Popup switch, applied live. Off removes the bar; the keys stay on.
  function applyShowBar(on) {
    showBar = on !== false;
    if (!showBar && toolbar) {
      toolbar.destroy();
      toolbar = null;
    }
    if (showBar) ensureToolbar();
    updateStrip();
  }

  function onBarKey(event) {
    var action = GV.barShortcutAction ? GV.barShortcutAction(event) : "";
    if (!action || !replyItems.length) return;
    event.preventDefault();
    event.stopPropagation();
    if (action === "collapse") {
      if (toolbar) toolbar.setCollapsed(!toolbar.collapsed());
    }
    else onBarAction(action, null);
  }

  var speechQueue = GV.createSpeechQueue({
    speak: function (text, hooks) {
      hooks = hooks || {};
      var start = hooks.onstart;
      var boundary = hooks.onboundary;
      hooks.onstart = function () {
        if (start) start();
        paintSpoken(text, null);
      };
      hooks.onboundary = function (event) {
        if (boundary) boundary(event);
        if (event && event.name === "word") paintSpoken(text, event.charIndex);
      };
      speakUtterance(text, hooks);
    },
    cancel: function () {
      piperBusy = false;
      piperTicket += 1;
      if (chunkAudio) {
        try { chunkAudio.pause(); } catch (err) { /* already quiet */ }
        chunkAudio = null;
      }
      var synth = getSynth();
      if (synth && synth.cancel) {
        try { synth.cancel(); } catch (err) { /* already quiet */ }
      }
    },
    isSpeaking: function () {
      if (piperBusy) return true;
      if (chunkAudio && !chunkAudio.paused && !chunkAudio.ended) return true;
      var synth = getSynth();
      return Boolean(synth && (synth.speaking || synth.pending));
    },
    keepalive: function () {
      var synth = getSynth();
      if (synth && synth.speaking && typeof synth.resume === "function") {
        try { synth.resume(); } catch (err) { /* engine already running */ }
      }
    },
    // Let cancel() finish before the next sentence. Chrome drops a speak()
    // that runs inside onend, and stalls the engine after about 15 seconds.
    gapMs: 50,
    watchdogMs: 1200,
    keepaliveMs: 10000,
    onerror: function (event, text) {
      if (event && event.error === "not-allowed") {
        queuedSpeech = text;
        armUnlock();
      }
    },
    onfinished: function () {
      clearSpoken();
      playback.markEnded();
      showReading(playback.state().body);
      updateBar();
    }
  });

  var session = GV.createSession({
    settleMs: GV.SETTLE_MS,
    onSpeak: speakAuto
  });

  function keyFor(el) {
    var attr = el.getAttribute("data-message-id") || el.getAttribute("data-id") || el.id || "";
    if (attr) return "id:" + attr;
    var key = keys.get(el);
    if (!key) {
      key = "el:" + (keySeq++);
      keys.set(el, key);
    }
    return key;
  }

  function recordsFrom(replies) {
    var out = [];
    for (var i = 0; i < replies.length; i++) {
      var reply = replies[i];
      if (!reply || !reply.speech) continue;
      out.push({
        key: keyFor(reply.element),
        raw: reply.raw || reply.speech,
        speech: reply.speech
      });
    }
    return out;
  }

  function getSynth() {
    var synth = root.speechSynthesis;
    if (synth && typeof synth.speak === "function") return synth;
    return null;
  }

  // Pick the saved voice once, after the browser has loaded its voice list.
  // Later voiceschanged events must not swap in a different voice.
  function rememberVoice() {
    if (cachedVoice && (!voiceURI || cachedVoice.voiceURI === voiceURI)) return;
    var synth = getSynth();
    if (!synth || typeof synth.getVoices !== "function") return;
    var voices = synth.getVoices() || [];
    if (!voices.length) return;
    if (!voiceURI) {
      cachedVoice = voices[0];
      cachedVoiceURI = cachedVoice.voiceURI || "";
      return;
    }
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].voiceURI === voiceURI) {
        cachedVoice = voices[i];
        cachedVoiceURI = voiceURI;
        return;
      }
    }
  }

  function voiceForUtterance() {
    if (!cachedVoice || (voiceURI && cachedVoice.voiceURI !== voiceURI)) rememberVoice();
    if (voiceURI && (!cachedVoice || cachedVoice.voiceURI !== voiceURI)) return null;
    return cachedVoice;
  }

  function applyVoice() {
    var next = GV.botVoiceURI(botSettings, botIdentity);
    if (next === voiceURI && cachedVoice) return;
    voiceURI = next;
    cachedVoice = null;
    cachedVoiceURI = null;
    rememberVoice();
  }

  function syncBot() {
    var label = GV.botLabel(document);
    var nextKey = location.href + "\n" + label;
    var identity = GV.botFromLocation(location.href, label);
    var bots = GV.rememberBot(botSettings, identity);
    var serialized = JSON.stringify(bots);
    if (nextKey === botKey && serialized === JSON.stringify(botSettings.bots || {})) {
      botIdentity = identity;
      return;
    }
    botKey = nextKey;
    botIdentity = identity;
    // Switching bots skips to the newest reply there (setting, default on).
    var change = GV.planBotChange ? GV.planBotChange(lastBotId, identity.id, botSettings.autoEndOnBotSwitch) : "none";
    lastBotId = identity.id;
    if (change === "end") setTimeout(doEnd, 0);
    botSettings.bots = bots;
    if (chrome.storage && chrome.storage.local) {
      try { chrome.storage.local.set({ bots: bots }); } catch (err) { /* storage can be unavailable in a test page */ }
    }
    applyVoice();
  }

  function controlOptions() {
    return {
      mode: playback.state().mode,
      readMode: readMode,
      onToggle: onToggle,
      onAction: onBarAction
    };
  }

  function applyReadMode(mode) {
    mode = GV.normalizeReadMode(mode);
    if (mode === readMode) return;
    readMode = mode;
    if (chrome.storage && chrome.storage.local) {
      try { chrome.storage.local.set({ readMode: mode }); } catch (err) { /* storage can be unavailable in a test page */ }
    }
  }

  // Pause remembers the sentence. Play on that same reply continues.
  // Play on a reply that only has the outline starts at the beginning.
  function onToggle() {
    stopHeld = false;
    var plan = GV.planToggle(readMode, playback.state(), pausedKey);
    cornerLog("toggle " + plan.do, { mode: playback.state().mode, key: playback.state().key, pausedKey: pausedKey });
    applyReadMode(plan.readMode);
    if (plan.do === "pause") {
      if (playback.state().mode === "playing") playback.toggle();
      pausedKey = playback.state().key;
      showReading();
      updateBar();
      return;
    }
    if (plan.do === "resume") {
      playback.toggle();
      showReading();
      updateBar();
      return;
    }
    pausedKey = "";
    clearPointer();
    var key = playback.state().key;
    if (!key && replyItems.length) key = replyItems[replyItems.length - 1].key;
    cornerLog("toggle start", { key: key });
    if (key) playback.playFromStart(key);
    updateBar();
  }

  function replyBody(item) {
    return item && (item.body || item.element);
  }

  function controlsOn(target) {
    return Boolean(target && target.querySelector && target.querySelector("[data-grok-voice-controls]"));
  }

  function showReading(element) {
    var target = element || playback.state().body;
    var mode = playback.state().mode;
    if (!target) {
      if (readingEl) GV.placeReadingControls(document, null);
      readingEl = null;
      readingMode = "";
      return;
    }
    var wantPause = readMode === "pause";
    if (readingEl === target && readingMode === mode && target.classList.contains("grok-voice-reading")
        && target.classList.contains("grok-voice-paused") === wantPause && controlsOn(target)) return;
    readingEl = target;
    readingMode = mode;
    GV.placeReadingControls(document, target, controlOptions());
  }

  function findReplyElement(node) {
    var el = node && node.nodeType === 1 ? node : (node && node.parentElement);
    if (!el) return null;
    var i;
    for (i = replyItems.length - 1; i >= 0; i--) {
      var body = replyBody(replyItems[i]);
      if (body && (body === el || (body.contains && body.contains(el)))) return body;
    }
    return null;
  }

  function itemForElement(element) {
    var i;
    for (i = 0; i < replyItems.length; i++) {
      if (replyBody(replyItems[i]) === element) return replyItems[i];
    }
    return null;
  }

  function highlightedElement() {
    if (readingEl && readingEl.isConnected !== false) return readingEl;
    return playback.state().body || null;
  }

  // A different reply turns Play on and reads from the start.
  // The outlined reply pauses, or continues that same reply.
  function onReplyClick(element) {
    var plan = GV.planReplyClick(readMode, highlightedElement(), element, playback.state(), pausedKey);
    if (plan.do === "ignore") return;
    stopHeld = false;
    if (plan.do === "start") {
      var item = itemForElement(element);
      if (!item) return;
      applyReadMode("play");
      pausedKey = "";
      clearPointer();
      playback.playFromStart(item.key);
      updateBar();
      return;
    }
    onToggle();
  }

  function pauseSpeech() {
    clearSpoken();
    if (speechQueue) return speechQueue.pause();
    return false;
  }

  function resumeSpeech() {
    if (speechQueue) return speechQueue.resume();
    return false;
  }

  // Automatic reads honor the per-bot checkbox. Manual controls do not.
  // Pause still moves the outline onto a new reply, and leaves it quiet.
  function speakAuto(text) {
    if (!text) return;
    if (!GV.botAutoRead(botSettings, botIdentity)) {
      lastDetect.reason = "bot-muted";
      lastDetect.snippet = snippetOf(text);
      logResolve();
      return;
    }
    var item = itemForSpeech(text);
    var plan = GV.planNewReply(readMode, stopHeld);
    if (!plan.highlight) {
      lastDetect.reason = "stopped";
      lastDetect.snippet = snippetOf(text);
      logResolve();
      return;
    }
    clearPointer();
    if (!plan.speak) {
      clearSpoken();
      if (item) playback.select(item.key);
      showReading(item && (item.body || item.element));
      lastDetect.reason = "paused";
      lastDetect.snippet = snippetOf(text);
      logResolve();
      return;
    }
    if (item) playback.noteSpoken(item.key);
    speakManual(text, item && (item.body || item.element));
  }

  function speakManual(text, element) {
    if (!text) return;
    lastDetect.reason = "spoke";
    lastDetect.snippet = snippetOf(text);
    logResolve();
    clearSpoken();
    showReading(element);
    attemptSpeak(text, true);
  }

  function itemForSpeech(text) {
    for (var i = replyItems.length - 1; i >= 0; i--) {
      if (replyItems[i] && replyItems[i].speech === text) return replyItems[i];
    }
    return replyItems.length ? replyItems[replyItems.length - 1] : null;
  }

  function speakPiper(text, hooks) {
    hooks = hooks || {};
    piperBusy = true;
    var ticket = ++piperTicket;
    chrome.runtime.sendMessage({
      type: "piper-synth",
      voiceId: GV.piperVoiceId(voiceURI),
      text: text
    }, function (response) {
      void chrome.runtime.lastError;
      if (ticket !== piperTicket) {
        cornerLog("piper stale reply dropped", { ticket: ticket });
        return;
      }
      piperBusy = false;
      if (!response || !response.ok || !response.wav) {
        if (hooks.onerror) hooks.onerror({ error: "synthesis-failed" });
        return;
      }
      var bytes = new Uint8Array(response.wav);
      var url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
      var audio = new Audio(url);
      chunkAudio = audio;
      if (speechQueue && speechQueue.attachAudio) speechQueue.attachAudio(audio);
      audio.onended = function () {
        URL.revokeObjectURL(url);
        if (chunkAudio === audio) chunkAudio = null;
        if (speechQueue && speechQueue.attachAudio) speechQueue.attachAudio(null);
        if (hooks.onend) hooks.onend();
      };
      audio.onerror = function () {
        if (hooks.onerror) hooks.onerror({ error: "audio" });
      };
      audio.play().then(function () {
        if (hooks.onstart) hooks.onstart();
      }).catch(function () {
        if (hooks.onerror) hooks.onerror({ error: "not-allowed" });
      });
    });
  }

  function speakUtterance(text, hooks) {
    hooks = hooks || {};
    if (GV.isPiperVoice && GV.isPiperVoice(voiceURI)) {
      speakPiper(text, hooks);
      return;
    }
    var synth = getSynth();
    var Utterance = root.SpeechSynthesisUtterance;
    if (!synth || !Utterance || !text) return;
    try {
      var utterance = new Utterance(text);
      utterance.rate = GV.clampRate(rate);
      var voice = voiceForUtterance();
      if (voice) {
        utterance.voice = voice;
        if (voice.lang) utterance.lang = voice.lang;
      }
      utterance.onstart = hooks.onstart || null;
      utterance.onboundary = hooks.onboundary || null;
      utterance.onend = hooks.onend || null;
      utterance.onerror = hooks.onerror || null;
      synth.speak(utterance);
    } catch (err) {
      queuedSpeech = text;
      armUnlock();
    }
  }

  function attemptSpeak(text, allowCancel) {
    if (!text) return;
    if (!allowCancel) {
      speakUtterance(text, {
        onerror: function (event) {
          if (event && event.error === "not-allowed") {
            queuedSpeech = text;
            armUnlock();
          }
        }
      });
      return;
    }
    if (speechQueue) speechQueue.start(text);
  }

  function unlockOnce() {
    var text = queuedSpeech;
    queuedSpeech = "";
    disarmUnlock();
    if (!text) return;
    attemptSpeak(text, false);
  }

  function armUnlock() {
    if (unlockArmed || !queuedSpeech) return;
    unlockArmed = true;
    document.addEventListener("pointerdown", unlockOnce, true);
    document.addEventListener("keydown", unlockOnce, true);
  }

  function disarmUnlock() {
    if (!unlockArmed) return;
    unlockArmed = false;
    document.removeEventListener("pointerdown", unlockOnce, true);
    document.removeEventListener("keydown", unlockOnce, true);
  }

  function stopSpeaking() {
    clearSpoken();
    queuedSpeech = "";
    disarmUnlock();
    speakToken += 1;
    if (speechQueue) speechQueue.stop();
    session.stop();
    playback.stop();
    pausedKey = "";
    readingEl = null;
    readingMode = "";
    if (GV.placeReadingControls) GV.placeReadingControls(document, null, controlOptions());
    var synth = getSynth();
    if (synth && synth.cancel) {
      try { synth.cancel(); } catch (err) { /* already stopped */ }
    }
  }

  function markArmed(on) {
    var node = document.documentElement;
    if (node) node.setAttribute("data-grok-voice-armed", on ? "1" : "0");
  }

  // Pass a callback so a missing worker does not reject an uncaught promise.
  // Reading lastError is what keeps that failure out of the page console.
  function safeSend(message) {
    if (!chrome.runtime || !chrome.runtime.id) return;
    try {
      chrome.runtime.sendMessage(message, function () {
        void chrome.runtime.lastError;
      });
    } catch (err) {
      // The worker may still be starting. The badge is set from the tab URL.
    }
  }

  function ensureDebugStyle() {
    if (document.getElementById("grok-voice-debug-style")) return;
    var style = document.createElement("style");
    style.id = "grok-voice-debug-style";
    style.textContent = "." + DEBUG_CLASS + "{outline:3px solid #3ddc84 !important;outline-offset:3px !important;}";
    (document.head || document.documentElement).appendChild(style);
  }

  function clearDebug() {
    if (GV.stripDebugMarks) GV.stripDebugMarks(document);
    else {
      var nodes = document.querySelectorAll("." + DEBUG_CLASS);
      for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove(DEBUG_CLASS);
    }
    debugEl = null;
  }

  var lastDetect = { blocks: 0, groups: 0, snippet: "", reason: "starting" };

  function snippetOf(text) {
    text = String(text || "").replace(/\s+/g, " ").trim();
    if (text.length <= 60) return text;
    return text.slice(0, 60);
  }

  var lastLogLine = "";

  function logResolve(report) {
    if (!debug) return;
    report = report || {};
    var detail = "";
    var groups = report.groups || [];
    for (var i = 0; i < groups.length; i++) {
      detail += " group" + (i + 1) + "=" + groups[i].role + ":" + groups[i].reason
        + ":\"" + snippetOf(groups[i].speech) + "\"";
    }
    var line = "[GrokVoice] frame=" + location.href
      + " blocks=" + lastDetect.blocks
      + " groups=" + groups.length
      + " assistant=" + lastDetect.groups
      + " mode=" + (lastDetect.mode || "")
      + detail
      + " chosen=\"" + lastDetect.snippet + "\""
      + " skip=" + lastDetect.reason;
    if (line === lastLogLine) return;
    lastLogLine = line;
    try {
      console.log(line);
    } catch (err) {
      // Logging is only a debugging aid.
    }
  }

  function publishDetect(report, reason) {
    var replies = report.replies || [];
    var latest = replies.length ? replies[replies.length - 1] : null;
    lastDetect.blocks = report.blockCount || 0;
    lastDetect.groups = replies.length;
    lastDetect.mode = report.mode || "";
    lastDetect.snippet = snippetOf(latest ? latest.speech : "");
    lastDetect.reason = reason;
    var rootNode = document.documentElement;
    if (rootNode) {
      rootNode.setAttribute("data-grok-voice-detected", String(replies.length));
      rootNode.setAttribute("data-grok-voice-snippet", lastDetect.snippet);
    }
    logResolve(report);
    safeSend({
      type: "frame-report",
      href: location.href,
      blocks: lastDetect.blocks,
      groups: lastDetect.groups,
      snippet: lastDetect.snippet,
      reason: lastDetect.reason,
      mode: lastDetect.mode,
      botId: botIdentity.id,
      botName: botIdentity.name,
      playback: playback.state().mode
    });
  }

  function updateDebug(replies) {
    if (!debug) {
      if (debugEl || document.querySelector("." + DEBUG_CLASS)) clearDebug();
      return;
    }
    ensureDebugStyle();
    var target = readingEl && readingEl.isConnected !== false ? readingEl : null;
    if (!target) {
      var latest = replies.length ? replies[replies.length - 1] : null;
      target = latest ? (latest.body || latest.element) : null;
    }
    if (!target || target.isConnected === false) {
      clearDebug();
      return;
    }
    if (GV.keepDebugMark) GV.keepDebugMark(document, target);
    else target.classList.add(DEBUG_CLASS);
    debugEl = target;
  }

  function applyEnabled(on) {
    watching = Boolean(on);
    session.setEnabled(on);
    if (on) {
      session.arm(recordsFrom(GV.detectAssistantReplies(document)));
      markArmed(true);
    } else {
      stopSpeaking();
      markArmed(false);
    }
    safeSend({ type: "watch-state", enabled: Boolean(on) });
    scheduleScan();
    updateBar();
  }

  function scan() {
    syncBot();
    var report = GV.inspectAssistant(document);
    var replies = report.replies || [];
    replyItems = [];
    for (var i = 0; i < replies.length; i++) {
      replyItems.push({
        key: keyFor(replies[i].element),
        speech: replies[i].speech,
        element: replies[i].element,
        body: replies[i].body || replies[i].element
      });
    }
    playback.setItems(replyItems);
    if (playback.state().mode !== "stopped") showReading();
    updateDebug(replies);
    ensureToolbar();
    updateBar();
    var reason = "disabled";
    if (!session.isEnabled()) reason = "disabled";
    else if (!report.blockCount) reason = "no-streamdown-blocks";
    else if (!replies.length) reason = "no-assistant-groups";
    else reason = session.watch(recordsFrom(replies)) || "waiting";
    publishDetect(report, reason);
  }

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(function () {
      scanTimer = null;
      try {
        watchShadows(document);
        scan();
      } catch (err) {
        // Keep watching after a bad read.
      }
    }, 50);
  }

  function watchShadows(rootNode) {
    if (!observer || !rootNode || !rootNode.querySelectorAll) return;
    var all = rootNode.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      var shadow = all[i].shadowRoot;
      if (!shadow || shadowObservers.has(shadow)) continue;
      shadowObservers.add(shadow);
      observer.observe(shadow, observeOptions());
      watchShadows(shadow);
    }
  }

  function observeOptions() {
    return {
      subtree: true,
      childList: true,
      characterData: true
    };
  }

  function mutationsAreNoise(records) {
    if (!records || !records.length || typeof GV.ignoreMutation !== "function") return false;
    for (var i = 0; i < records.length; i++) {
      if (!GV.ignoreMutation(records[i])) return false;
    }
    return true;
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(function (records) {
      try {
        bindObserver();
        if (mutationsAreNoise(records)) return;
        scheduleScan();
      } catch (err) {
        scheduleScan();
      }
    });
    bindObserver();
  }

  var observedRoot = null;

  function bindObserver() {
    var target = document.body || document.documentElement;
    if (!target || observedRoot === target) {
      watchShadows(document.body || document);
      return;
    }
    observer.observe(target, observeOptions());
    if (document.documentElement && document.documentElement !== target) {
      observer.observe(document.documentElement, { childList: true, subtree: false });
    }
    observedRoot = target;
    watchShadows(target);
  }

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message || typeof message.type !== "string") return;
    if (message.type === "stop") {
      doStop();
      sendResponse({ ok: true });
      return;
    }
    if (message.type === "replay") {
      var text = session.getLastSpoken();
      var item = itemForSpeech(text);
      applyReadMode("play");
      pausedKey = "";
      if (item) playback.noteSpoken(item.key);
      if (text) speakManual(text, item && (item.body || item.element));
      sendResponse({ ok: Boolean(text), text: text || "" });
      return;
    }
    if (message.type === "previous" || message.type === "next" || message.type === "play-pause") {
      var played = "";
      if (message.type === "play-pause") {
        onToggle();
        played = playback.state().speech || "";
      } else {
        applyReadMode("play");
        pausedKey = "";
        stopHeld = false;
        clearPointer();
        played = message.type === "previous" ? playback.previous() : playback.next();
        showReading();
        updateBar();
      }
      sendResponse({ ok: Boolean(played), text: played || "", mode: playback.state().mode });
      return;
    }
    if (message.type === "status") {
      sendResponse({
        ok: true,
        enabled: session.isEnabled(),
        armed: document.documentElement.getAttribute("data-grok-voice-armed") === "1",
        last: session.getLastSpoken(),
        detected: lastDetect.groups,
        blocks: lastDetect.blocks,
        snippet: lastDetect.snippet,
        reason: lastDetect.reason
      });
    }
  });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    if (changes.voiceURI || changes.bots || changes.newBotsAutoRead) {
      chrome.storage.local.get(GV.DEFAULTS, function (stored) {
        botSettings = stored;
        syncBot();
      });
    }
    if (changes.rate) rate = GV.clampRate(changes.rate.newValue);
    if (changes.debug) {
      debug = changes.debug.newValue === true;
      if (!debug) clearDebug();
      scheduleScan();
    }
    if (changes.readMode) {
      readMode = GV.normalizeReadMode(changes.readMode.newValue);
      showReading();
    }
    if (changes.showToolbar) applyShowBar(changes.showToolbar.newValue !== false);
    if (changes.autoEndOnBotSwitch) botSettings.autoEndOnBotSwitch = changes.autoEndOnBotSwitch.newValue !== false;
    if (changes.enabled) applyEnabled(changes.enabled.newValue !== false);
  });

  function boot() {
    if (GV.bindReplyClick) GV.bindReplyClick(document, findReplyElement, onReplyClick);
    startObserver();
    document.addEventListener("keydown", onBarKey, true);
    var synth = getSynth();
    if (synth && synth.addEventListener) {
      synth.addEventListener("voiceschanged", rememberVoice);
    }
    chrome.storage.local.get(GV.DEFAULTS, function (stored) {
      botSettings = stored;
      rate = GV.clampRate(stored.rate);
      debug = stored.debug === true;
      readMode = GV.normalizeReadMode(stored.readMode);
      showBar = GV.toolbarWanted(stored);
      syncBot();
      applyEnabled(stored.enabled !== false);
      scheduleScan();
    });
    setInterval(scheduleScan, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(globalThis);
