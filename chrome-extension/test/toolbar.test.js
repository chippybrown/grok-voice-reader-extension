// Control bar planning: paragraph stepping, reply jumps, Stop/End, Auto End,
// status light, shortcuts, and the Shadow DOM bar itself (jsdom).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");
const FILES = ["src/config.js", "src/text.js", "src/controls.js", "src/toolbar.js"];

function load(html) {
  const dom = new JSDOM(html || "<!doctype html><body></body>", { runScripts: "outside-only", pretendToBeVisual: true });
  for (const file of FILES) dom.window.eval(fs.readFileSync(path.join(root, file), "utf8"));
  return { dom, GV: dom.window.GrokVoice };
}

const { GV } = load();
const plain = (v) => JSON.parse(JSON.stringify(v));

test("paragraph Forward steps inside a reply, then into the next reply", () => {
  const counts = [2, 3];
  assert.deepEqual(plain(GV.planParagraphStep({ reply: 0, para: 0 }, counts, 1)), { reply: 0, para: 1 });
  assert.deepEqual(plain(GV.planParagraphStep({ reply: 0, para: 1 }, counts, 1)), { reply: 1, para: 0 });
  assert.equal(GV.planParagraphStep({ reply: 1, para: 2 }, counts, 1), null, "past the newest paragraph means End");
  assert.deepEqual(plain(GV.planParagraphStep({ reply: 1, para: -1 }, counts, 1)), { reply: 1, para: 0 });
});

test("paragraph Back crosses into the previous reply and stops at the top", () => {
  const counts = [2, 0, 3];
  assert.deepEqual(plain(GV.planParagraphStep({ reply: 2, para: 1 }, counts, -1)), { reply: 2, para: 0 });
  assert.deepEqual(plain(GV.planParagraphStep({ reply: 2, para: 0 }, counts, -1)), { reply: 0, para: 1 }, "empty reply skipped");
  assert.deepEqual(plain(GV.planParagraphStep({ reply: 0, para: 0 }, counts, -1)), { reply: 0, para: 0 });
  assert.equal(GV.planParagraphStep({ reply: 0, para: 0 }, [], -1), null);
});

test("Shift jumps a whole reply", () => {
  assert.deepEqual(plain(GV.planReplyJump({ reply: 1, para: 2 }, [2, 3, 1], -1)), { reply: 0, para: 0 });
  assert.deepEqual(plain(GV.planReplyJump({ reply: 1, para: 2 }, [2, 3, 1], 1)), { reply: 2, para: 0 });
  assert.equal(GV.planReplyJump({ reply: 2, para: 0 }, [2, 3, 1], 1), null);
  assert.deepEqual(plain(GV.planReplyJump({ reply: 0, para: 1 }, [2, 3], -1)), { reply: 0, para: 0 });
});

test("Stop holds new replies quiet and unoutlined", () => {
  assert.deepEqual(plain(GV.planNewReply("play", true)), { speak: false, highlight: false, readMode: "play" });
  assert.deepEqual(plain(GV.planNewReply("play", false)), { speak: true, highlight: true, readMode: "play" });
  assert.deepEqual(plain(GV.planNewReply("pause")), { speak: false, highlight: true, readMode: "pause" });
});

test("Auto End on a bot switch, unless turned off", () => {
  assert.equal(GV.DEFAULTS.autoEndOnBotSwitch, true);
  assert.equal(GV.planBotChange("", "bot:a", true), "none", "first bot in the tab");
  assert.equal(GV.planBotChange("bot:a", "bot:a", true), "none");
  assert.equal(GV.planBotChange("bot:a", "bot:b", undefined), "end");
  assert.equal(GV.planBotChange("bot:a", "bot:b", false), "none");
});

test("status light matches the desktop app", () => {
  assert.equal(GV.toolbarStatus({ enabled: true, mode: "stopped" }), "watching");
  assert.equal(GV.toolbarStatus({ enabled: true, mode: "playing" }), "reading");
  assert.equal(GV.toolbarStatus({ enabled: true, mode: "paused" }), "paused");
  assert.equal(GV.toolbarStatus({ enabled: true, mode: "playing", stopHeld: true }), "stopped");
  assert.equal(GV.toolbarStatus({ enabled: false, mode: "stopped" }), "stopped");
  assert.equal(GV.STATUS_LIGHTS.watching.color, "#3ddc84");
});

test("bar shortcuts use Alt+Shift and never take P", () => {
  const key = (code, extra) => Object.assign({ altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, code }, extra);
  assert.equal(GV.barShortcutAction(key("Comma")), "back");
  assert.equal(GV.barShortcutAction(key("Period")), "forward");
  assert.equal(GV.barShortcutAction(key("KeyS")), "stop");
  assert.equal(GV.barShortcutAction(key("KeyE")), "end");
  assert.equal(GV.barShortcutAction(key("KeyH")), "collapse");
  assert.equal(GV.barShortcutAction(key("KeyP")), "");
  assert.equal(GV.barShortcutAction(key("KeyS", { ctrlKey: true })), "");
  assert.equal(GV.barShortcutAction(key("KeyS", { shiftKey: false })), "");
});

test("bar position stays on screen", () => {
  assert.deepEqual(plain(GV.clampBarPosition({ x: -1, y: -1 }, 200, 36, 1000, 800)), { x: 776, y: 668 });
  assert.deepEqual(plain(GV.clampBarPosition({ x: 5000, y: 5000 }, 200, 36, 1000, 800)), { x: 800, y: 764 });
});

test("paragraphs are the innermost blocks, and speech starts at one", () => {
  const { dom, GV: G } = load("<!doctype html><body><div id=r><p dir=auto>One.</p><ul><li><p dir=auto>Two.</p></li><li>Three.</li></ul><h2>Four</h2><p></p></div></body>");
  const body = dom.window.document.getElementById("r");
  const paras = G.replyParagraphs(body);
  assert.deepEqual(Array.from(paras, (p) => p.textContent), ["One.", "Two.", "Three.", "Four"]);
  assert.match(G.speechFromParagraph(paras, 2), /^Three\.\s+Four/);
  G.markParagraph(dom.window.document, paras[1]);
  G.markParagraph(dom.window.document, paras[2]);
  assert.equal(dom.window.document.querySelectorAll(".grok-voice-paragraph").length, 1);
  assert.ok(paras[2].classList.contains("grok-voice-paragraph"));
  G.markParagraph(dom.window.document, null);
  assert.equal(dom.window.document.querySelectorAll(".grok-voice-paragraph").length, 0);
});

test("bar renders in a shadow root, sends actions, and collapses", () => {
  const { dom, GV: G } = load();
  const actions = [];
  const saved = [];
  const bar = G.createToolbar(dom.window.document, {
    onAction: (name, event) => actions.push(name + (event && event.shiftKey ? "+shift" : "")),
    save: (pos) => saved.push(pos)
  });
  const shadow = bar.host.shadowRoot;
  assert.ok(shadow);
  for (const a of ["back", "play-pause", "forward", "stop", "end", "summary"]) {
    assert.ok(shadow.querySelector('[data-action="' + a + '"]'), a);
  }
  assert.equal(shadow.querySelector('[data-action="summary"]').disabled, true);
  assert.match(shadow.querySelector('[data-action="stop"]').title, /Alt\+Shift\+S/);
  shadow.querySelector('[data-action="back"]').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, shiftKey: true }));
  shadow.querySelector('[data-action="end"]').click();
  shadow.querySelector('[data-action="summary"]').click();
  assert.deepEqual(actions, ["back+shift", "end"]);
  bar.update("reading");
  assert.match(shadow.querySelector('[data-action="play-pause"]').title, /^Pause/);
  bar.update("paused");
  assert.match(shadow.querySelector('[data-action="play-pause"]').title, /^Play/);
  shadow.querySelector('[data-action="collapse"]').click();
  assert.ok(bar.host.classList.contains("collapsed"));
  assert.equal(saved[saved.length - 1].collapsed, true);
  shadow.querySelector('[data-action="expand"]').click();
  assert.equal(bar.collapsed(), false);
});

test("Show on-page control bar: default on, off removes the bar", () => {
  const { dom, GV: G } = load();
  assert.equal(G.DEFAULTS.showToolbar, true);
  assert.equal(G.toolbarWanted({}), true);
  assert.equal(G.toolbarWanted({ showToolbar: true }), true);
  assert.equal(G.toolbarWanted({ showToolbar: false }), false);
  const bar = G.createToolbar(dom.window.document, {});
  assert.ok(dom.window.document.querySelector("[data-grok-voice-controls=bar]"));
  bar.destroy();
  assert.equal(dom.window.document.querySelector("[data-grok-voice-controls=bar]"), null);
});

// Rev 20261103 - paragraph strip tests (Grok and Eldon R. Brown - WA0UWH)
test("strip Back restarts the paragraph when partway in, else steps back", () => {
  const counts = [2, 3];
  assert.deepEqual(plain(GV.planStripBack({ reply: 1, para: 2 }, counts, true)), { reply: 1, para: 2 });
  assert.deepEqual(plain(GV.planStripBack({ reply: 1, para: 2 }, counts, false)), { reply: 1, para: 1 });
  assert.deepEqual(plain(GV.planStripBack({ reply: 1, para: 0 }, counts, false)), { reply: 0, para: 1 });
  assert.deepEqual(plain(GV.planStripBack({ reply: 1, para: -1 }, counts, true)), { reply: 1, para: 0 });
});

test("strip shows only while reading or paused, and follows the bar switch", () => {
  assert.equal(GV.stripWanted("reading"), true);
  assert.equal(GV.stripWanted("paused"), true);
  assert.equal(GV.stripWanted("watching"), false);
  assert.equal(GV.stripWanted("stopped"), false);
  assert.equal(GV.stripWanted("reading", false), false);
});

test("corner Play/Pause grows to |< ||/> >| >>| while reading and sends actions", () => {
  const { dom, GV: G } = load("<!doctype html><body><div id=r><p>One two.</p></div></body>");
  const doc = dom.window.document;
  const seen = [];
  const r = doc.getElementById("r");
  const host = G.placeReadingControls(doc, r, { mode: "playing", onToggle: () => seen.push("toggle"), onAction: (a) => seen.push(a) });
  const shadow = host.shadowRoot;
  const actions = [...shadow.querySelectorAll("button")].map((b) => b.getAttribute("data-action"));
  assert.deepEqual(actions, ["strip-back", "play-pause", "forward", "end"], "one play/pause, no duplicate");
  assert.equal(host.hasAttribute("data-extras"), false, "extras hidden until reading");
  G.setCornerExtras(true);
  assert.equal(host.getAttribute("data-extras"), "1");
  assert.equal(host.style.bottom, "8px");
  assert.equal(host.style.right, "8px");
  for (const b of shadow.querySelectorAll("button")) b.click();
  assert.deepEqual(seen, ["strip-back", "play-pause", "forward", "end"], "play/pause goes through onAction like the others");
  assert.equal(doc.querySelectorAll("[data-grok-voice-controls=strip]").length, 0, "no separate strip");
  G.setCornerExtras(false);
  assert.equal(host.hasAttribute("data-extras"), false);
});

// Rev 20261103 - 0.4.4 click-level regression (Grok and Eldon R. Brown - WA0UWH)
test("real mouse presses on corner Play/Pause fire once, never as a reply click, and keep the group", async () => {
  const { dom, GV: G } = load("<!doctype html><body><div id=r><p>One two.</p><p>Three four.</p></div></body>");
  const win = dom.window;
  const doc = win.document;
  const r = doc.getElementById("r");
  const seen = [];
  const replyClicks = [];
  const pageSaw = [];
  for (const t of ["pointerdown", "mousedown", "mouseup", "click"]) doc.body.addEventListener(t, () => pageSaw.push(t));
  G.bindReplyClick(doc, (n) => (r.contains(n) ? r : null), (el) => replyClicks.push(el));
  const host = G.placeReadingControls(doc, r, { mode: "playing", onToggle: () => seen.push("toggle"), onAction: (a) => seen.push(a) });
  G.setCornerExtras(true);
  const press = (btn) => {
    const o = { bubbles: true, composed: true, cancelable: true, button: 0, detail: 1, clientX: 5, clientY: 5 };
    btn.dispatchEvent(new win.PointerEvent("pointerdown", o));
    btn.dispatchEvent(new win.MouseEvent("mousedown", o));
    btn.dispatchEvent(new win.PointerEvent("pointerup", o));
    btn.dispatchEvent(new win.MouseEvent("mouseup", o));
    btn.dispatchEvent(new win.MouseEvent("click", o));
  };
  const pp = host.shadowRoot.querySelector('[data-action="play-pause"]');
  press(pp);
  await new Promise((res) => setTimeout(res, 450));
  press(pp);
  press(host.shadowRoot.querySelector('[data-action="forward"]'));
  await new Promise((res) => setTimeout(res, 300));
  assert.deepEqual(seen, ["play-pause", "play-pause", "forward"]);
  assert.equal(replyClicks.length, 0, "a corner press is not also a reply click");
  assert.deepEqual(pageSaw, [], "Grok's page handlers never see the corner press");
  assert.equal(host.getAttribute("data-extras"), "1");
  assert.equal(r.querySelectorAll("[data-grok-voice-controls]").length, 1);
});

test("corner group stays expanded while a reply is outlined, folds after Stop or bar off", () => {
  assert.equal(GV.cornerExtrasWanted("watching", true, true), true, "idle gap between sentences");
  assert.equal(GV.cornerExtrasWanted("reading", true, false), true);
  assert.equal(GV.cornerExtrasWanted("stopped", true, true), false);
  assert.equal(GV.cornerExtrasWanted("reading", false, true), false);
  assert.equal(GV.cornerExtrasWanted("watching", true, false), false);
});
