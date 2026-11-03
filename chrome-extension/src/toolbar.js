// On-page control bar, modeled on the desktop Grokbot Voice toolbar:
// Back, Pause/Play, Forward, Stop, End, a status light, and a spare slot
// for Summarize/Verbose later. It lives in a Shadow DOM host so Grok CSS
// cannot reach it. Speech stays in content.js. The plan* functions here are
// plain logic so node --test can check them without a page.
(function (root) {
  "use strict";

  var GV = root.GrokVoice || (root.GrokVoice = {});
  var PARA_CLASS = "grok-voice-paragraph";
  var PARA_SELECTOR = "p, li, h1, h2, h3, h4, h5, h6, pre, blockquote";
  GV.PARA_MARK = "#4aa3ff";

  // Colors match the desktop status light.
  GV.STATUS_LIGHTS = {
    watching: { color: "#3ddc84", label: "Watching" },
    reading: { color: "#4aa3ff", label: "Reading" },
    paused: { color: "#FFB366", label: "Reading paused" },
    stopped: { color: "#ff5c5c", label: "Stopped" }
  };

  GV.toolbarStatus = function toolbarStatus(state) {
    state = state || {};
    if (state.enabled === false || state.stopHeld) return "stopped";
    if (state.mode === "playing") return "reading";
    if (state.mode === "paused") return "paused";
    return "watching";
  };

  // Innermost block elements of one reply, in document order. A <li> that
  // holds a <p> counts once, as the <p>.
  GV.replyParagraphs = function replyParagraphs(body) {
    if (!body || !body.querySelectorAll) return [];
    var nodes = body.querySelectorAll(PARA_SELECTOR);
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.closest && el.closest("[data-grok-voice-controls]")) continue;
      if (el.querySelector && el.querySelector(PARA_SELECTOR)) continue;
      if (!GV.visibleSpeech || !GV.visibleSpeech(el)) continue;
      out.push(el);
    }
    return out;
  };

  // Words from paragraph `from` to the end of the reply.
  GV.speechFromParagraph = function speechFromParagraph(paras, from) {
    var parts = [];
    for (var i = Math.max(0, from || 0); i < paras.length; i++) parts.push(GV.visibleSpeech(paras[i]));
    return GV.speakableJoin ? GV.speakableJoin(parts) : parts.join(" ");
  };

  // One paragraph back or forward. counts[i] is the paragraph count of
  // reply i. Crosses into the previous or next reply at the edges.
  // null means "past the newest paragraph": stop and wait (like End).
  GV.planParagraphStep = function planParagraphStep(pos, counts, dir) {
    if (!counts || !counts.length) return null;
    var reply = pos && pos.reply >= 0 ? Math.min(pos.reply, counts.length - 1) : counts.length - 1;
    // No marked paragraph yet: Forward starts this reply, Back the one before.
    if (!pos || !(pos.para >= 0)) {
      if (dir > 0 && counts[reply] > 0) return { reply: reply, para: 0 };
    }
    var para = pos && pos.para >= 0 ? pos.para : 0;
    if (dir < 0) {
      if (para > 0) return { reply: reply, para: para - 1 };
      for (var r = reply - 1; r >= 0; r--) {
        if (counts[r] > 0) return { reply: r, para: counts[r] - 1 };
      }
      return { reply: reply, para: 0 };
    }
    if (para + 1 < counts[reply]) return { reply: reply, para: para + 1 };
    for (var n = reply + 1; n < counts.length; n++) {
      if (counts[n] > 0) return { reply: n, para: 0 };
    }
    return null;
  };

  // Shift+Back / Shift+Forward: a whole reply, from its first paragraph.
  GV.planReplyJump = function planReplyJump(pos, counts, dir) {
    if (!counts || !counts.length) return null;
    var reply = pos && pos.reply >= 0 ? pos.reply : counts.length - 1;
    var next = reply + (dir < 0 ? -1 : 1);
    if (next < 0) next = 0;
    if (next >= counts.length) return null;
    return { reply: next, para: 0 };
  };

  // A different bot (not the first one seen in this tab) means End.
  GV.planBotChange = function planBotChange(previousId, nextId, autoEnd) {
    if (!previousId || !nextId || previousId === nextId) return "none";
    return autoEnd === false ? "none" : "end";
  };

  // Page keys for the bar. Uses event.code so keyboard layout does not matter.
  GV.barShortcutAction = function barShortcutAction(event) {
    if (!event || !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return "";
    switch (event.code) {
      case "Comma": return "back";
      case "Period": return "forward";
      case "KeyS": return "stop";
      case "KeyE": return "end";
      case "KeyH": return "collapse";
      default: return "";
    }
  };

  // Keep the bar on screen after a resize or a saved spot from a bigger window.
  GV.clampBarPosition = function clampBarPosition(pos, width, height, viewW, viewH) {
    var x = pos && pos.x >= 0 ? pos.x : viewW - width - 24;
    var y = pos && pos.y >= 0 ? pos.y : viewH - height - 96;
    x = Math.max(0, Math.min(x, Math.max(0, viewW - width)));
    y = Math.max(0, Math.min(y, Math.max(0, viewH - height)));
    return { x: Math.round(x), y: Math.round(y) };
  };

  function ensureParaStyle(doc) {
    if (!doc || !doc.getElementById || doc.getElementById("grok-voice-paragraph-style")) return;
    var style = doc.createElement("style");
    style.id = "grok-voice-paragraph-style";
    style.textContent = "." + PARA_CLASS + "{box-shadow:inset 4px 0 0 " + GV.PARA_MARK + " !important;"
      + "background-color:rgba(74,163,255,0.08) !important;border-radius:4px;}";
    (doc.head || doc.documentElement).appendChild(style);
  }

  // The voice pointer: one paragraph marked inside the outlined reply.
  GV.markParagraph = function markParagraph(doc, element) {
    if (!doc || !doc.querySelectorAll) return;
    ensureParaStyle(doc);
    var old = doc.querySelectorAll("." + PARA_CLASS);
    for (var i = 0; i < old.length; i++) {
      if (old[i] !== element) old[i].classList.remove(PARA_CLASS);
    }
    if (element && element.classList) element.classList.add(PARA_CLASS);
  };

  function tips() {
    var k = GV.BAR_SHORTCUTS;
    return {
      back: "Back one paragraph (" + k.back + "). Shift+click: previous reply (" + GV.SHORTCUTS.previous + ")",
      pause: "Pause (" + GV.SHORTCUTS.playPause + ")",
      play: "Play (" + GV.SHORTCUTS.playPause + ")",
      forward: "Forward one paragraph (" + k.forward + "). Shift+click: next reply (" + GV.SHORTCUTS.next + ")",
      stop: "Stop, and stay quiet until Play (" + k.stop + ")",
      end: "End: skip to the newest reply and wait (" + k.end + ")",
      summary: "Summarize / Verbose (coming later)",
      collapse: "Collapse to a dot (" + k.collapse + ")",
      expand: "Show the voice controls (" + k.collapse + ")"
    };
  }

  var CSS =
    ":host{all:initial;}" +
    ".bar{display:flex;align-items:center;gap:4px;padding:4px 6px;border-radius:10px;" +
    "background:rgba(15,15,15,.92);box-shadow:0 2px 10px rgba(0,0,0,.4);font:12px system-ui,sans-serif;color:#fff;user-select:none;}" +
    ".grip{width:10px;height:28px;cursor:grab;background:radial-gradient(#888 1px,transparent 1.5px) 0 0/5px 5px;opacity:.8;}" +
    "button{width:28px;height:28px;padding:0;border:0;border-radius:6px;background:transparent;color:#fff;cursor:pointer;}" +
    "button:hover,button:focus-visible{background:rgba(255,255,255,.14);outline:none;}" +
    "button[disabled]{opacity:.35;cursor:default;background:transparent;}" +
    "svg{width:20px;height:20px;fill:#fff;display:block;margin:4px auto;}" +
    ".light{width:12px;height:12px;border-radius:50%;margin:0 4px;box-shadow:0 0 6px currentColor;}" +
    ".sep{width:1px;height:20px;background:#555;margin:0 2px;}" +
    ".dot{display:none;width:18px;height:18px;border-radius:50%;cursor:pointer;border:2px solid #111;box-shadow:0 0 8px rgba(0,0,0,.5);}" +
    ":host(.collapsed) .bar{display:none;}" +
    ":host(.collapsed) .dot{display:block;}" +
    "button.hide{width:18px;}button.hide svg{width:14px;height:14px;margin:7px auto;}";

  var HIDE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h14v2H5z"></path></svg>';

  function button(action, icon, tip, disabled) {
    return '<button type="button" data-action="' + action + '" title="' + tip + '" aria-label="' + tip + '"'
      + (disabled ? " disabled" : "") + ">" + icon + "</button>";
  }

  // options.onAction(name, event) gets back, forward, play-pause, stop, end.
  // options.load(cb) / options.save(pos) keep the spot and collapsed state.
  GV.createToolbar = function createToolbar(doc, options) {
    options = options || {};
    var t = tips();
    var host = doc.createElement("div");
    host.setAttribute("data-grok-voice-controls", "bar");
    host.setAttribute("role", "toolbar");
    host.setAttribute("aria-label", "Grok Voice Reader");
    host.style.cssText = "position:fixed;z-index:2147483646;left:0;top:0;margin:0;display:block;";
    var shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = "<style>" + CSS + "</style>" +
      '<div class="bar">' +
      '<div class="grip" data-drag="1" title="Drag to move"></div>' +
      '<span class="light" data-light="1"></span>' +
      button("back", GV.controlIcon("previous"), t.back) +
      button("play-pause", GV.controlIcon("pause"), t.pause) +
      button("forward", GV.controlIcon("next"), t.forward) +
      button("stop", GV.controlIcon("stop"), t.stop) +
      button("end", GV.controlIcon("end"), t.end) +
      '<span class="sep"></span>' +
      button("summary", GV.controlIcon("summary"), t.summary, true) +
      button("collapse", HIDE_ICON, t.collapse).replace("<button", '<button class="hide"') +
      "</div>" +
      '<div class="dot" data-drag="1" data-action="expand" title="' + t.expand + '"></div>';

    var pos = { x: -1, y: -1, collapsed: false };
    var light = shadow.querySelector("[data-light]");
    var dot = shadow.querySelector(".dot");
    var toggle = shadow.querySelector('[data-action="play-pause"]');
    var dragged = false;
    var shown = "";

    function view() { return doc.defaultView || root; }

    function place() {
      var w = host.offsetWidth || 260;
      var h = host.offsetHeight || 36;
      var v = view();
      var p = GV.clampBarPosition(pos, w, h, v.innerWidth || 1024, v.innerHeight || 768);
      host.style.left = p.x + "px";
      host.style.top = p.y + "px";
    }

    function setCollapsed(on) {
      pos.collapsed = Boolean(on);
      if (pos.collapsed) host.classList.add("collapsed");
      else host.classList.remove("collapsed");
      place();
      if (options.save) options.save({ x: pos.x, y: pos.y, collapsed: pos.collapsed });
    }

    shadow.addEventListener("click", function (event) {
      if (dragged) { dragged = false; return; }
      var node = event.target;
      var el = node && node.closest ? node.closest("[data-action]") : null;
      if (!el || el.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      var action = el.getAttribute("data-action");
      if (action === "collapse") return setCollapsed(true);
      if (action === "expand") return setCollapsed(false);
      if (options.onAction) options.onAction(action, event);
    });

    // Drag by the grip, or by the dot when collapsed. A short move is a click.
    shadow.addEventListener("pointerdown", function (event) {
      var node = event.target;
      if (!node || !node.closest || !node.closest("[data-drag]") || event.button !== 0) return;
      var startX = event.clientX;
      var startY = event.clientY;
      var rect = host.getBoundingClientRect();
      var moved = false;
      function move(e) {
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
        moved = true;
        pos.x = rect.left + dx;
        pos.y = rect.top + dy;
        place();
      }
      function up() {
        view().removeEventListener("pointermove", move, true);
        view().removeEventListener("pointerup", up, true);
        if (moved) {
          dragged = true;
          var r = host.getBoundingClientRect();
          pos.x = Math.round(r.left);
          pos.y = Math.round(r.top);
          if (options.save) options.save({ x: pos.x, y: pos.y, collapsed: pos.collapsed });
        }
      }
      view().addEventListener("pointermove", move, true);
      view().addEventListener("pointerup", up, true);
      event.preventDefault();
    });

    if (view().addEventListener) view().addEventListener("resize", place);
    (doc.body || doc.documentElement).appendChild(host);
    place();
    if (options.load) {
      options.load(function (saved) {
        if (saved) {
          pos.x = saved.x >= 0 ? saved.x : -1;
          pos.y = saved.y >= 0 ? saved.y : -1;
          if (saved.collapsed) host.classList.add("collapsed");
          pos.collapsed = Boolean(saved.collapsed);
        }
        place();
      });
    }

    return {
      host: host,
      // status: watching | reading | paused | stopped
      update: function update(status) {
        if (!host.isConnected) (doc.body || doc.documentElement).appendChild(host);
        // Repaint only on a change. The page observer sees shadow edits too.
        if (status === shown) return;
        shown = status;
        var info = GV.STATUS_LIGHTS[status] || GV.STATUS_LIGHTS.watching;
        light.style.background = info.color;
        light.style.color = info.color;
        light.title = info.label;
        dot.style.background = info.color;
        var playing = status === "reading";
        toggle.innerHTML = GV.controlIcon(playing ? "pause" : "play");
        toggle.title = playing ? t.pause : t.play;
        toggle.setAttribute("aria-label", toggle.title);
      },
      setCollapsed: setCollapsed,
      collapsed: function () { return pos.collapsed; }
    };
  };
})(globalThis);
