// Which reply is selected, and whether Play is showing the pause icon.
// speechSynthesis stays in content.js. Pausing keeps the chunk and the
// character offset so Play can continue instead of starting over.
(function (root) {
  "use strict";

  var GV = root.GrokVoice || (root.GrokVoice = {});

  GV.createPlayback = function createPlayback(options) {
    var onSpeak = options && options.onSpeak ? options.onSpeak : function () {};
    var onPause = options && options.onPause ? options.onPause : function () { return false; };
    var onResume = options && options.onResume ? options.onResume : function () { return false; };
    var items = [];
    var index = -1;
    var mode = "stopped";

    function current() {
      if (index < 0 || index >= items.length) return null;
      return items[index];
    }

    function speakCurrent() {
      var item = current();
      if (!item || !item.speech) {
        mode = "stopped";
        return "";
      }
      mode = "playing";
      onSpeak(item.speech, item);
      return item.speech;
    }

    return {
      setItems: function setItems(list) {
        var key = current() ? current().key : "";
        items = list || [];
        if (key) {
          for (var i = 0; i < items.length; i++) {
            if (items[i] && items[i].key === key) {
              index = i;
              return;
            }
          }
        }
        if (index >= items.length) index = items.length - 1;
      },

      noteSpoken: function noteSpoken(key) {
        for (var i = 0; i < items.length; i++) {
          if (items[i] && items[i].key === key) {
            index = i;
            mode = "playing";
            return true;
          }
        }
        return false;
      },

      // Move the outline onto a reply without speaking it.
      select: function select(key) {
        for (var i = 0; i < items.length; i++) {
          if (items[i] && items[i].key === key) {
            index = i;
            return true;
          }
        }
        return false;
      },

      previous: function previous() {
        if (!items.length) return "";
        if (index < 0) index = Math.max(0, items.length - 2);
        else if (index > 0) index -= 1;
        return speakCurrent();
      },

      next: function next() {
        if (!items.length) return "";
        if (index < 0) index = items.length - 1;
        else if (index < items.length - 1) index += 1;
        return speakCurrent();
      },

      // A click on a different reply. Always the start of that reply.
      playFromStart: function playFromStart(key) {
        for (var i = 0; i < items.length; i++) {
          if (items[i] && items[i].key === key) {
            index = i;
            return speakCurrent();
          }
        }
        return "";
      },

      // One button. Pause keeps the place in the reply. Play continues
      // from there when onResume can. Otherwise the reply starts again.
      toggle: function toggle() {
        if (!items.length) return { mode: mode, speech: "", restarted: false };
        if (index < 0) index = items.length - 1;
        var item = current();
        var speech = item && item.speech ? item.speech : "";
        if (mode === "playing") {
          onPause();
          mode = "paused";
          return { mode: mode, speech: speech, restarted: false };
        }
        if (mode === "paused" && onResume()) {
          mode = "playing";
          return { mode: mode, speech: speech, restarted: false };
        }
        return { mode: "playing", speech: speakCurrent(), restarted: true };
      },

      stop: function stop() {
        mode = "stopped";
      },

      markEnded: function markEnded() {
        if (mode === "playing") mode = "stopped";
      },

      state: function state() {
        var item = current();
        return {
          mode: mode,
          index: index,
          icon: mode === "playing" ? "pause" : "play",
          speech: item ? item.speech : "",
          key: item ? item.key : "",
          element: item ? item.element : null,
          body: item ? (item.body || item.element) : null
        };
      }
    };
  };

  // Short local voices can use speechSynthesis.resume(). Long chunks and
  // online voices in Chrome and Edge often cannot, so those start again
  // from the last word boundary.
  GV.RESUME_CHUNK_LIMIT = 180;

  GV.splitSpeechChunks = function splitSpeechChunks(text) {
    var raw = String(text || "").replace(/\s+/g, " ").trim();
    if (!raw) return [];
    var parts = [];
    var start = 0;
    var i;
    for (i = 0; i < raw.length; i++) {
      var ch = raw.charAt(i);
      if (ch !== "." && ch !== "!" && ch !== "?" && ch !== "…") continue;
      var end = i + 1;
      while (end < raw.length && /["')\]]/.test(raw.charAt(end))) end += 1;
      if (end < raw.length && !/\s/.test(raw.charAt(end))) continue;
      pushChunk(parts, raw.slice(start, end));
      while (end < raw.length && /\s/.test(raw.charAt(end))) end += 1;
      start = end;
      i = end - 1;
    }
    pushChunk(parts, raw.slice(start));
    return parts;
  };

  function pushChunk(parts, piece) {
    var rest = String(piece || "").trim();
    var limit = GV.RESUME_CHUNK_LIMIT;
    while (rest.length > limit) {
      var cut = rest.lastIndexOf(" ", limit);
      if (cut < 40) cut = limit;
      parts.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) parts.push(rest);
  }

  // charIndex from onboundary points at a word, or sometimes into one.
  GV.wordBoundaryIndex = function wordBoundaryIndex(text, charIndex) {
    var value = String(text || "");
    var index = Number(charIndex);
    if (index !== index || index <= 0) return 0;
    if (index > value.length) index = value.length;
    var at = index;
    if (at > 0 && at < value.length && !/\s/.test(value.charAt(at)) && !/\s/.test(value.charAt(at - 1))) {
      while (at > 0 && !/\s/.test(value.charAt(at - 1))) at -= 1;
    }
    while (at < value.length && /\s/.test(value.charAt(at))) at += 1;
    return at;
  };

  GV.resumeFromOffset = function resumeFromOffset(chunks, chunkIndex, charIndex) {
    var list = chunks || [];
    var index = chunkIndex | 0;
    if (index < 0 || index >= list.length) return [];
    var chunk = String(list[index] || "");
    var at = GV.wordBoundaryIndex(chunk, charIndex);
    var rest = chunk.slice(at).trim();
    var out = [];
    if (rest) out.push(rest);
    for (var i = index + 1; i < list.length; i++) {
      if (list[i]) out.push(String(list[i]));
    }
    return out;
  };

  GV.resumeIsReliable = function resumeIsReliable(chunk, voice) {
    var text = String(chunk || "");
    if (!text || text.length > GV.RESUME_CHUNK_LIMIT) return false;
    var label = voice ? String(voice.name || "") + " " + String(voice.voiceURI || "") : "";
    if (/online|natural|neural|network/i.test(label)) return false;
    return true;
  };

  // Speaks a reply one sentence at a time. Pause remembers the sentence
  // even when the browser never reports a word boundary. Play continues
  // from that sentence. An audio element uses pause() and play().
  //
  // Chrome often speaks the first chunk of a past reply and then stops:
  // cancel() races the new utterance, onend never arrives for the chunk
  // that was chained from the previous onend, and an "interrupted" error
  // used to be ignored. Each play has its own generation. A watchdog
  // starts the next chunk if speaking goes idle, and resume() is poked
  // so the engine does not stall after about fifteen seconds.
  GV.createSpeechQueue = function createSpeechQueue(options) {
    options = options || {};
    var speak = options.speak || function () {};
    var cancel = options.cancel || function () {};
    var gapMs = options.gapMs > 0 ? options.gapMs : 0;
    var watchdogMs = options.watchdogMs > 0 ? options.watchdogMs : 0;
    var keepaliveMs = options.keepaliveMs > 0 ? options.keepaliveMs : 0;
    var later = options.later || function (fn, ms) {
      if (!ms) fn();
      else setTimeout(fn, ms);
    };
    var chunks = [];
    var index = 0;
    var charIndex = 0;
    var paused = false;
    var generation = 0;
    var audio = null;
    var chunkTimer = null;
    var keepTimer = null;

    function clearChunkTimer() {
      if (chunkTimer) {
        clearInterval(chunkTimer);
        chunkTimer = null;
      }
    }

    function clearKeepTimer() {
      if (keepTimer) {
        clearInterval(keepTimer);
        keepTimer = null;
      }
    }

    function alive(gen) {
      return gen === generation && !paused;
    }

    function armKeepalive(gen) {
      clearKeepTimer();
      if (!keepaliveMs || !options.keepalive) return;
      keepTimer = setInterval(function () {
        if (!alive(gen)) return;
        var speaking = options.isSpeaking ? options.isSpeaking() : false;
        if (!speaking) return;
        try { options.keepalive(); } catch (err) { /* engine already busy */ }
      }, keepaliveMs);
    }

    function playFrom(list, start, gen) {
      if (!alive(gen)) return false;
      chunks = list || [];
      if (!chunks.length || start >= chunks.length || start < 0) {
        clearChunkTimer();
        clearKeepTimer();
        if (alive(gen) && options.onfinished) options.onfinished();
        return false;
      }
      index = start;
      charIndex = 0;
      var text = chunks[start];
      if (!text) return playFrom(chunks, start + 1, gen);
      speakChunk(text, start, gen, 0);
      return true;
    }

    function speakChunk(text, start, gen, attempt) {
      if (!alive(gen)) return;
      var heard = false;
      var settled = false;
      var born = Date.now();

      function goNext() {
        if (settled || !alive(gen)) return;
        settled = true;
        clearChunkTimer();
        var run = function () {
          if (!alive(gen)) return;
          playFrom(chunks, start + 1, gen);
        };
        if (gapMs) later(run, gapMs);
        else run();
      }

      function retryOrNext() {
        if (settled || !alive(gen)) return;
        if (!heard && attempt < 1) {
          settled = true;
          clearChunkTimer();
          var again = function () {
            if (!alive(gen)) return;
            speakChunk(text, start, gen, attempt + 1);
          };
          later(again, gapMs || 40);
          return;
        }
        goNext();
      }

      function armWatchdog() {
        clearChunkTimer();
        if (!watchdogMs) return;
        chunkTimer = setInterval(function () {
          if (settled || !alive(gen)) return;
          var speaking = options.isSpeaking ? options.isSpeaking() : false;
          if (speaking) {
            if (options.keepalive) {
              try { options.keepalive(); } catch (err) { /* still speaking */ }
            }
            if (Date.now() - born < Math.max(watchdogMs * 8, 14000)) return;
            try { cancel(); } catch (err) { /* already quiet */ }
            goNext();
            return;
          }
          // The sentence finished, or Chrome dropped it, and onend never came.
          if (Date.now() - born >= watchdogMs) goNext();
        }, Math.min(watchdogMs, 400));
      }

      speak(text, {
        onstart: function () {
          if (!alive(gen)) return;
          heard = true;
          index = start;
        },
        onboundary: function (event) {
          if (!alive(gen) || !event) return;
          heard = true;
          var name = event.name || "word";
          if (name !== "word" && name !== "sentence") return;
          var next = Number(event.charIndex);
          if (next !== next) return;
          index = start;
          charIndex = next;
          born = Date.now();
        },
        onend: function () {
          if (!alive(gen)) return;
          heard = true;
          index = start;
          goNext();
        },
        onerror: function (event) {
          if (!alive(gen)) return;
          var name = event && event.error ? event.error : "";
          if (options.onerror) options.onerror(event, text);
          if (name === "not-allowed") {
            settled = true;
            clearChunkTimer();
            return;
          }
          if (name === "interrupted" || name === "canceled" || name === "cancelled") {
            retryOrNext();
            return;
          }
          retryOrNext();
        }
      });
      armWatchdog();
      armKeepalive(gen);
    }

    return {
      start: function (text) {
        audio = null;
        generation += 1;
        var gen = generation;
        paused = false;
        clearChunkTimer();
        var full = String(text || "").replace(/\s+/g, " ").trim();
        var parts = GV.splitSpeechChunks(full);
        chunks = parts;
        if (!parts.length) return false;
        try { cancel(); } catch (err) { /* nothing was speaking */ }
        if (gapMs) {
          later(function () {
            if (!alive(gen)) return;
            playFrom(parts, 0, gen);
          }, gapMs);
          return true;
        }
        return playFrom(parts, 0, gen);
      },
      useAudio: function (element) {
        generation += 1;
        paused = false;
        clearChunkTimer();
        clearKeepTimer();
        chunks = [];
        index = 0;
        charIndex = 0;
        audio = element || null;
        return Boolean(audio);
      },
      pause: function () {
        if (audio && typeof audio.pause === "function") {
          audio.pause();
          paused = true;
          return true;
        }
        paused = true;
        generation += 1;
        clearChunkTimer();
        clearKeepTimer();
        try { cancel(); } catch (err) { /* already quiet */ }
        return chunks.length > 0;
      },
      resume: function () {
        if (audio && typeof audio.play === "function" && audio.paused && !audio.ended) {
          paused = false;
          try { audio.play(); } catch (err) { return false; }
          return true;
        }
        if (!paused || !chunks.length) return false;
        var plan = GV.resumeFromOffset(chunks, index, charIndex);
        if (!plan.length) return false;
        generation += 1;
        var gen = generation;
        paused = false;
        clearChunkTimer();
        try { cancel(); } catch (err) { /* already quiet */ }
        if (gapMs) {
          later(function () {
            if (!alive(gen)) return;
            playFrom(plan, 0, gen);
          }, gapMs);
          return true;
        }
        return playFrom(plan, 0, gen);
      },
      stop: function () {
        generation += 1;
        paused = false;
        clearChunkTimer();
        clearKeepTimer();
        chunks = [];
        index = 0;
        charIndex = 0;
        if (audio && typeof audio.pause === "function") {
          try { audio.pause(); } catch (err) { /* already quiet */ }
        }
        audio = null;
        try { cancel(); } catch (err) { /* already quiet */ }
      },
      attachAudio: function (element) {
        audio = element || null;
      },
      state: function () {
        return { chunks: chunks.slice(), index: index, charIndex: charIndex, paused: paused };
      }
    };
  };

  var SENTENCE_HIGHLIGHT = "grok-voice-sentence";
  GV.SCROLL_GRACE_MS = 3000;

  GV.sentenceHighlightSupported = function sentenceHighlightSupported(view) {
    if (!view) return false;
    var css = view.CSS;
    return Boolean(css && css.highlights && typeof css.highlights.set === "function" && typeof view.Highlight === "function");
  };

  // Off-screen only, and not if the reader scrolled in the last few seconds.
  GV.shouldScrollSentence = function shouldScrollSentence(rect, viewHeight, userMovedAt, now) {
    if (!rect || !(rect.height > 0 || rect.width > 0)) return false;
    var height = viewHeight || 0;
    if (height <= 0) return false;
    var off = rect.bottom <= 0 || rect.top >= height;
    if (!off) return false;
    if (userMovedAt && now - userMovedAt < GV.SCROLL_GRACE_MS) return false;
    return true;
  };

  function skipControl(node) {
    try {
      return Boolean(node && node.closest && node.closest("[data-grok-voice-controls]"));
    } catch (err) {
      return false;
    }
  }

  // Map a speech chunk onto the reply's text without wrapping any nodes.
  GV.speechRangeIn = function speechRangeIn(rootEl, phrase, charIndex) {
    if (!rootEl || !phrase || !rootEl.ownerDocument) return null;
    var needle = String(phrase).replace(/\s+/g, " ").trim();
    if (!needle) return null;
    var norm = "";
    var map = [];
    function pushChar(node, offset, ch) {
      map.push({ node: node, offset: offset });
      norm += ch;
    }
    function walk(node) {
      if (!node || skipControl(node)) return;
      if (node.nodeType === 1) {
        var name = node.tagName;
        if (name === "SCRIPT" || name === "STYLE") return;
        var child = node.firstChild;
        while (child) {
          walk(child);
          child = child.nextSibling;
        }
        return;
      }
      if (node.nodeType !== 3) return;
      var text = node.nodeValue || "";
      for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);
        if (/\s/.test(ch)) {
          if (!norm || norm.charAt(norm.length - 1) === " ") continue;
          ch = " ";
        }
        pushChar(node, i, ch);
      }
    }
    walk(rootEl);
    var at = norm.indexOf(needle);
    if (at < 0) return null;
    var from = at;
    var to = at + needle.length;
    if (charIndex != null && charIndex === charIndex) {
      var wordAt = GV.wordBoundaryIndex(needle, charIndex);
      var wordEnd = wordAt;
      while (wordEnd < needle.length && !/\s/.test(needle.charAt(wordEnd))) wordEnd += 1;
      if (wordEnd > wordAt) {
        from = at + wordAt;
        to = at + wordEnd;
      }
    }
    if (from < 0 || to <= from || from >= map.length) return null;
    if (to > map.length) to = map.length;
    var start = map[from];
    var end = map[to - 1];
    var range = rootEl.ownerDocument.createRange();
    try {
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset + 1);
    } catch (err) {
      return null;
    }
    return range;
  };

  function ensureSentenceStyle(doc) {
    if (!doc || !doc.getElementById || doc.getElementById("grok-voice-sentence-style")) return;
    var style = doc.createElement("style");
    style.id = "grok-voice-sentence-style";
    style.textContent = "::highlight(" + SENTENCE_HIGHLIGHT + "){background-color:rgba(186,204,92,0.42);}";
    (doc.head || doc.documentElement).appendChild(style);
  }

  GV.createSentencePainter = function createSentencePainter(doc) {
    var view = doc && doc.defaultView;
    var userMovedAt = 0;
    var ignoreScroll = false;
    function noteUser() { userMovedAt = Date.now(); }
    if (doc && doc.addEventListener) {
      doc.addEventListener("wheel", noteUser, true);
      doc.addEventListener("touchmove", noteUser, true);
    }
    if (view && view.addEventListener) {
      view.addEventListener("scroll", function () {
        if (ignoreScroll) return;
        noteUser();
      }, true);
    }
    return {
      show: function (rootEl, phrase, charIndex) {
        if (!GV.sentenceHighlightSupported(view)) return null;
        var range = GV.speechRangeIn(rootEl, phrase, charIndex);
        if (!range) {
          this.clear();
          return null;
        }
        ensureSentenceStyle(doc);
        try {
          view.CSS.highlights.set(SENTENCE_HIGHLIGHT, new view.Highlight(range));
        } catch (err) {
          return null;
        }
        var rect = null;
        try { rect = range.getBoundingClientRect(); } catch (err) { rect = null; }
        if (GV.shouldScrollSentence(rect, view.innerHeight, userMovedAt, Date.now())) {
          var delta = 0;
          var height = view.innerHeight || 0;
          if (rect.bottom > height) delta = rect.bottom - height + 24;
          else if (rect.top < 0) delta = rect.top - 24;
          if (delta && view.scrollBy) {
            ignoreScroll = true;
            try { view.scrollBy({ top: delta, left: 0, behavior: "smooth" }); }
            catch (err) { try { view.scrollBy(0, delta); } catch (e2) { /* no scroll */ } }
            setTimeout(function () { ignoreScroll = false; }, 800);
          }
        }
        return range;
      },
      clear: function () {
        if (!view || !view.CSS || !view.CSS.highlights || !view.CSS.highlights.delete) return;
        try { view.CSS.highlights.delete(SENTENCE_HIGHLIGHT); } catch (err) { /* already clear */ }
      }
    };
  };
})(globalThis);
