// One Play/Pause button in the lower-right corner of the outlined reply.
// The composer bar is left alone. Previous and Next stay on the keyboard.
(function (root) {
  "use strict";

  var GV = root.GrokVoice || (root.GrokVoice = {});
  var READING_CLASS = "grok-voice-reading";
  var DEBUG_CLASS = "grok-voice-debug-target";
  var MARK_CLASSES = [READING_CLASS, DEBUG_CLASS];
  var currentHost = null;
  var handlers = { onToggle: null };

  var ICONS = {
    previous: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"></path></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"></path></svg>'
  };

  GV.controlIcon = function controlIcon(name) {
    return ICONS[name] || "";
  };

  GV.controlTooltips = function controlTooltips() {
    return {
      previous: "Previous",
      play: "Play",
      pause: "Pause",
      next: "Next"
    };
  };

  // A different assistant reply starts from the beginning. The outlined
  // reply pauses or continues. Anything else is ignored.
  GV.replyClickAction = function replyClickAction(active, clicked) {
    if (!clicked) return "ignore";
    if (active && active === clicked) return "toggle";
    return "start";
  };

  GV.normalizeReadMode = function normalizeReadMode(value) {
    return value === "pause" ? "pause" : "play";
  };

  // Pause holds new replies quiet and still moves the outline onto them.
  // Play reads them as they arrive.
  GV.planNewReply = function planNewReply(readMode) {
    var mode = GV.normalizeReadMode(readMode);
    return { speak: mode === "play", highlight: true, readMode: mode };
  };

  // Corner button, Alt+Shift+P, or a click on the outlined reply.
  // Resume only when that same reply is the one that was paused.
  GV.planToggle = function planToggle(readMode, state, pausedKey) {
    var playing = state && state.mode === "playing";
    if (playing) return { do: "pause", readMode: "pause" };
    var same = state && state.mode === "paused" && pausedKey && state.key === pausedKey;
    return { do: same ? "resume" : "start", readMode: "play" };
  };

  // A different reply always turns Play on and reads from the start.
  GV.planReplyClick = function planReplyClick(readMode, active, clicked, state, pausedKey) {
    var action = GV.replyClickAction(active, clicked);
    if (action === "ignore") return { do: "ignore", readMode: GV.normalizeReadMode(readMode) };
    if (action === "start") return { do: "start", readMode: "play" };
    return GV.planToggle(readMode, state, pausedKey);
  };

  var lastUiToggle = 0;

  // The corner button and the reply click can both see one press.
  function uiToggle(fn) {
    var now = Date.now();
    if (now - lastUiToggle < 400) return;
    lastUiToggle = now;
    if (fn) fn();
  }

  function ensureStyle(doc) {
    if (!doc.getElementById) return;
    if (doc.getElementById("grok-voice-reading-style")) return;
    var style = doc.createElement("style");
    style.id = "grok-voice-reading-style";
    style.textContent = "." + READING_CLASS + "{outline:3px solid #3ddc84 !important;outline-offset:3px !important;}";
    (doc.head || doc.documentElement).appendChild(style);
  }

  function paint(host, mode) {
    var shadow = host && host.shadowRoot;
    if (!shadow) return;
    var toggle = shadow.querySelector('[data-action="play-pause"]');
    if (!toggle) return;
    var tips = GV.controlTooltips();
    var playing = mode === "playing";
    var tip = playing ? tips.pause : tips.play;
    toggle.innerHTML = ICONS[playing ? "pause" : "play"];
    toggle.title = tip;
    toggle.setAttribute("aria-label", tip);
  }

  function interactiveTarget(node) {
    var el = node && node.nodeType === 1 ? node : (node && node.parentElement);
    if (!el || !el.closest) return false;
    try {
      return Boolean(el.closest("a, button, input, textarea, select, pre, code, [role='button'], [data-grok-voice-controls]"));
    } catch (err) {
      return false;
    }
  }

  function eventHitsControls(event) {
    var path = event && event.composedPath ? event.composedPath() : [];
    var i;
    for (i = 0; i < path.length; i++) {
      var node = path[i];
      if (node && node.getAttribute && node.getAttribute("data-grok-voice-controls")) return true;
    }
    return interactiveTarget(event && event.target);
  }

  // A plain click on an assistant reply. Drags, double-clicks, links, and
  // modifier keys do not count. A press on the corner button does not also
  // count from here.
  GV.bindReplyClick = function bindReplyClick(doc, findReply, onReply) {
    if (!doc || doc.__grokVoiceClickBound) return;
    doc.__grokVoiceClickBound = true;
    var pending = null;
    var timer = null;
    function cancel() {
      pending = null;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
    function modified(event) {
      return event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
    }
    function replyFrom(event) {
      if (!findReply) return null;
      try { return findReply(event && event.target) || null; } catch (err) { return null; }
    }
    doc.addEventListener("pointerdown", function (event) {
      if (eventHitsControls(event)) doc.__grokVoiceControlsPress = Date.now();
    }, true);
    doc.addEventListener("mousedown", function (event) {
      if (eventHitsControls(event)) doc.__grokVoiceControlsPress = Date.now();
      if (event.button !== 0 || event.detail > 1) {
        cancel();
        return;
      }
      if (modified(event) || eventHitsControls(event) || !replyFrom(event) || interactiveTarget(event.target)) {
        pending = null;
        return;
      }
      pending = { x: event.clientX, y: event.clientY };
    }, true);
    doc.addEventListener("mouseup", function (event) {
      var start = pending;
      pending = null;
      if (!start || event.button !== 0 || event.detail > 1 || modified(event)) return;
      if (doc.__grokVoiceControlsPress && Date.now() - doc.__grokVoiceControlsPress < 1000) return;
      if (Math.abs(event.clientX - start.x) > 5 || Math.abs(event.clientY - start.y) > 5) return;
      var reply = replyFrom(event);
      if (!reply || interactiveTarget(event.target)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        var selection = null;
        try {
          var view = doc.defaultView;
          selection = view && view.getSelection ? view.getSelection() : null;
        } catch (err) {
          selection = null;
        }
        if (selection && selection.isCollapsed === false) return;
        if (onReply) onReply(reply);
      }, 250);
    }, true);
    doc.addEventListener("dblclick", function () { cancel(); }, true);
  };

  function build(doc) {
    var tips = GV.controlTooltips();
    var host = doc.createElement("div");
    host.setAttribute("data-grok-voice-controls", "1");
    host.setAttribute("role", "group");
    host.setAttribute("aria-label", "Play or pause");
    var shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML =
      "<style>" +
      ":host{all:initial;}" +
      "button{width:28px;height:28px;padding:0;border:0;border-radius:6px;background:rgba(15,15,15,.9);color:#fff;cursor:pointer;}" +
      "button:hover,button:focus{background:rgba(15,15,15,.75);}" +
      "svg{width:20px;height:20px;fill:#fff;display:block;margin:4px auto;}" +
      "</style>" +
      '<button type="button" data-action="play-pause" title="' + tips.play + '" aria-label="' + tips.play + '">' +
      ICONS.play + "</button>";
    shadow.addEventListener("click", function (event) {
      var node = event.target;
      var button = node && node.closest ? node.closest("button") : null;
      if (!button && node && node.parentElement && node.parentElement.closest) button = node.parentElement.closest("button");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      if (button.getAttribute("data-action") === "play-pause") uiToggle(handlers.onToggle);
    });
    return host;
  }

  function discardHost() {
    if (currentHost && currentHost.parentNode) currentHost.parentNode.removeChild(currentHost);
    currentHost = null;
  }

  function anchor(element) {
    if (!element || element.hasAttribute("data-grok-voice-anchored")) return;
    var view = element.ownerDocument && element.ownerDocument.defaultView;
    var pos = "static";
    try {
      if (view && view.getComputedStyle) pos = view.getComputedStyle(element).position || "static";
    } catch (err) {
      pos = "static";
    }
    if (pos === "static") {
      element.setAttribute("data-grok-voice-anchored", element.style.position || "");
      element.style.position = "relative";
    }
  }

  function releaseAnchor(element) {
    if (!element || !element.removeAttribute || !element.hasAttribute("data-grok-voice-anchored")) return;
    element.style.position = element.getAttribute("data-grok-voice-anchored");
    element.removeAttribute("data-grok-voice-anchored");
  }

  function collectElements(root, out) {
    var nodes = [];
    try {
      nodes = root && root.querySelectorAll ? root.querySelectorAll("*") : [];
    } catch (err) {
      return;
    }
    for (var i = 0; i < nodes.length; i++) {
      out.push(nodes[i]);
      if (nodes[i].shadowRoot) collectElements(nodes[i].shadowRoot, out);
    }
  }

  function ownedBy(keep, el) {
    if (!keep || !el) return false;
    if (el === keep) return true;
    try { return Boolean(keep.contains && keep.contains(el)); } catch (err) { return false; }
  }

  function stripMarkStyles(el) {
    if (!el.style) return;
    el.style.outline = "";
    el.style.outlineOffset = "";
    var bg = String(el.style.backgroundColor || "").replace(/\s+/g, "").toLowerCase();
    if (bg === "#3ddc84" || bg === "rgb(61,220,132)") el.style.backgroundColor = "";
  }

  // Every highlight except the reply we are keeping. Shadow roots included,
  // because a re-rendered node is not the one we stored last time.
  function stripOtherHighlights(doc, keep) {
    var all = [];
    collectElements(doc, all);
    var i;
    var c;
    for (i = 0; i < all.length; i++) {
      var el = all[i];
      if (!el || el === keep) continue;
      var marked = false;
      if (el.classList) {
        for (c = 0; c < MARK_CLASSES.length; c++) {
          if (el.classList.contains(MARK_CLASSES[c])) {
            el.classList.remove(MARK_CLASSES[c]);
            marked = true;
          }
        }
      }
      if (marked) {
        stripMarkStyles(el);
        releaseAnchor(el);
      }
      if (el.getAttribute && el.getAttribute("data-grok-voice-controls") === "1" && el !== currentHost && !ownedBy(keep, el)) {
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    }
  }

  GV.stripDebugMarks = function stripDebugMarks(doc) {
    if (!doc) return;
    var all = [];
    collectElements(doc, all);
    for (var i = 0; i < all.length; i++) {
      if (all[i].classList && all[i].classList.contains(DEBUG_CLASS)) {
        all[i].classList.remove(DEBUG_CLASS);
        stripMarkStyles(all[i]);
      }
    }
  };

  GV.keepDebugMark = function keepDebugMark(doc, element) {
    if (!doc) return;
    var all = [];
    collectElements(doc, all);
    for (var i = 0; i < all.length; i++) {
      if (all[i] !== element && all[i].classList && all[i].classList.contains(DEBUG_CLASS)) {
        all[i].classList.remove(DEBUG_CLASS);
        stripMarkStyles(all[i]);
      }
    }
    if (element && element.classList) element.classList.add(DEBUG_CLASS);
  };

  function placeCorner(host) {
    host.style.position = "absolute";
    host.style.right = "8px";
    host.style.bottom = "8px";
    host.style.left = "auto";
    host.style.top = "auto";
    host.style.margin = "0";
    host.style.width = "28px";
    host.style.height = "28px";
    host.style.zIndex = "2147483646";
    host.style.display = "block";
    host.style.transform = "none";
    host.style.pointerEvents = "auto";
  }

  // Green outline and the corner button. Nothing is added to the composer.
  GV.placeReadingControls = function placeReadingControls(doc, element, options) {
    options = options || {};
    if (!doc) return null;
    ensureStyle(doc);
    handlers.onToggle = options.onToggle || handlers.onToggle || null;
    stripOtherHighlights(doc, element);
    if (!element) {
      discardHost();
      return null;
    }
    element.classList.add(READING_CLASS);
    anchor(element);
    if (!currentHost || !currentHost.isConnected) {
      discardHost();
      currentHost = build(doc);
    }
    if (currentHost.parentNode !== element) element.appendChild(currentHost);
    placeCorner(currentHost);
    paint(currentHost, options.mode || "stopped");
    return currentHost;
  };
})(globalThis);
