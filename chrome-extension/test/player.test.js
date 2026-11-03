const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");

function loadWindow() {
  const dom = new JSDOM(
    "<!DOCTYPE html><html><head><title>Moya - Grok</title></head><body><h1>Moya</h1><div id=\"a\"></div><div id=\"b\"></div></body></html>",
    { runScripts: "dangerously", url: "https://grok.com/bot/abc-123" }
  );
  const window = dom.window;
  for (const file of ["src/config.js", "src/playback.js", "src/bots.js", "src/updates.js", "src/controls.js"]) {
    window.eval(fs.readFileSync(path.join(root, file), "utf8"));
  }
  return window;
}

const window = loadWindow();
const GV = window.GrokVoice;

test("previous and next walk assistant replies in order", () => {
  const spoken = [];
  const playback = GV.createPlayback({
    onSpeak: function (text) { spoken.push(text); }
  });
  playback.setItems([
    { key: "a", speech: "First reply here." },
    { key: "b", speech: "Second reply here." },
    { key: "c", speech: "Third reply here." }
  ]);
  assert.equal(playback.previous(), "Second reply here.");
  assert.equal(playback.previous(), "First reply here.");
  assert.equal(playback.previous(), "First reply here.");
  assert.equal(playback.next(), "Second reply here.");
  assert.equal(playback.next(), "Third reply here.");
  assert.equal(playback.next(), "Third reply here.");
  assert.deepEqual(spoken, [
    "Second reply here.",
    "First reply here.",
    "First reply here.",
    "Second reply here.",
    "Third reply here.",
    "Third reply here."
  ]);
});

test("play resumes from the last word boundary", () => {
  const chunks = GV.splitSpeechChunks("Alpha beta gamma. Delta epsilon.");
  assert.equal(Array.from(chunks).join("|"), "Alpha beta gamma.|Delta epsilon.");
  const mid = chunks[0].indexOf("gamma") + 2;
  const plan = GV.resumeFromOffset(chunks, 0, mid);
  assert.equal(plan[0].indexOf("gamma"), 0);
  assert.equal(plan[1], "Delta epsilon.");
  assert.equal(plan[0].indexOf("Alpha"), -1);

  const spoken = [];
  let hooks = null;
  const queue = GV.createSpeechQueue({
    speak: function (text, next) { spoken.push(text); hooks = next; },
    cancel: function () {}
  });
  assert.equal(queue.start("Alpha beta gamma. Delta epsilon."), true);
  assert.equal(spoken[0], "Alpha beta gamma.");
  hooks.onboundary({ name: "word", charIndex: mid });
  assert.equal(queue.pause(), true);
  assert.equal(queue.state().charIndex, mid);
  assert.equal(queue.resume(), true);
  assert.equal(spoken[1].indexOf("gamma"), 0);
  hooks.onend();
  assert.equal(spoken[2], "Delta epsilon.");
});

test("play resumes the current sentence when no word boundary is reported", () => {
  const spoken = [];
  let hooks = null;
  const queue = GV.createSpeechQueue({
    speak: function (text, next) {
      spoken.push(text);
      hooks = next;
      if (next.onstart) next.onstart();
    },
    cancel: function () {}
  });
  assert.equal(queue.start("Alpha beta gamma. Delta epsilon. Final sentence here."), true);
  assert.equal(spoken[0], "Alpha beta gamma.");
  hooks.onend();
  assert.equal(spoken[1], "Delta epsilon.");
  assert.equal(queue.state().index, 1);
  assert.equal(queue.state().charIndex, 0);
  assert.equal(queue.pause(), true);
  assert.equal(queue.state().index, 1);
  assert.equal(queue.resume(), true);
  assert.equal(spoken[2], "Delta epsilon.");
  assert.notEqual(spoken[2], "Alpha beta gamma.");
  hooks.onend();
  assert.equal(spoken[3], "Final sentence here.");
  assert.equal(spoken.indexOf("Alpha beta gamma.") === spoken.length - 1, false);

  const audio = {
    paused: false,
    ended: false,
    currentTime: 4,
    play: function () { this.paused = false; },
    pause: function () { this.paused = true; }
  };
  queue.useAudio(audio);
  assert.equal(queue.pause(), true);
  assert.equal(audio.paused, true);
  assert.equal(queue.resume(), true);
  assert.equal(audio.paused, false);
  assert.equal(audio.currentTime, 4);
});

test("pause holds the reply and resume restarts it only when the browser cannot", () => {
  const spoken = [];
  let resumeWorks = false;
  const playback = GV.createPlayback({
    onSpeak: function (text) { spoken.push(text); },
    onPause: function () { return true; },
    onResume: function () { return resumeWorks; }
  });
  playback.setItems([{ key: "a", speech: "Read this paragraph again." }]);
  assert.equal(playback.next(), "Read this paragraph again.");
  const paused = playback.toggle();
  assert.equal(paused.mode, "paused");
  assert.equal(paused.restarted, false);
  assert.equal(playback.state().icon, "play");
  resumeWorks = true;
  const resumed = playback.toggle();
  assert.equal(resumed.mode, "playing");
  assert.equal(resumed.restarted, false);
  assert.equal(spoken.length, 1);
  playback.toggle();
  resumeWorks = false;
  const restarted = playback.toggle();
  assert.equal(restarted.restarted, true);
  assert.equal(restarted.speech, "Read this paragraph again.");
  assert.deepEqual(spoken, ["Read this paragraph again.", "Read this paragraph again."]);
});

test("each bot keeps its own voice and mute, and new bots follow the default", () => {
  const bot = GV.botFromLocation("https://grok.com/bot/abc-123", GV.botLabel(window.document));
  assert.equal(bot.id, "abc-123");
  assert.equal(bot.name, "Moya");
  const stored = { voiceURI: "browser-default", newBotsAutoRead: true, bots: {} };
  assert.equal(GV.botVoiceURI(stored, bot), "browser-default");
  assert.equal(GV.botAutoRead(stored, bot), true);
  stored.bots = { "abc-123": { name: "Moya", voiceURI: "jenny", autoRead: false } };
  assert.equal(GV.botVoiceURI(stored, bot), "jenny");
  assert.equal(GV.botAutoRead(stored, bot), false);
  stored.newBotsAutoRead = false;
  const fresh = { id: "later-bot", name: "Later" };
  assert.equal(GV.botAutoRead(stored, fresh), false);
  assert.equal(GV.botVoiceURI(stored, fresh), "browser-default");
  stored.newBotsAutoRead = true;
  assert.equal(GV.botAutoRead(stored, fresh), true);
});

test("update check keeps ext-v tags and hides prereleases unless beta is on", () => {
  const releases = [
    { tag_name: "v1.4.0", prerelease: false, html_url: "https://example/desktop" },
    { tag_name: "ext-v0.1.6", prerelease: false, html_url: "https://example/016" },
    { tag_name: "ext-v0.2.0", draft: true, html_url: "https://example/draft" },
    {
      tag_name: "ext-v0.2.1",
      prerelease: false,
      html_url: "https://example/021",
      assets: [{ name: "Grok-Voice-Reader-Extension.zip", browser_download_url: "https://example/021.zip" }]
    },
    {
      tag_name: "ext-v0.9.0",
      prerelease: true,
      html_url: "https://example/beta",
      assets: [{ name: "Grok-Voice-Reader-Extension.zip", browser_download_url: "https://example/beta.zip" }]
    }
  ];
  const stable = GV.pickExtensionUpdate(releases, "0.2.0", { beta: false });
  assert.equal(stable.tag, "ext-v0.2.1");
  assert.equal(stable.url, "https://example/021.zip");
  assert.equal(GV.pickExtensionUpdate(releases, "0.2.1", { beta: false }), null);
  const beta = GV.pickExtensionUpdate(releases, "0.2.1", { beta: true });
  assert.equal(beta.tag, "ext-v0.9.0");
  assert.equal(beta.url, "https://example/beta.zip");
  assert.equal(GV.pickExtensionUpdate(releases, "9.0.0", { beta: true }), null);
  assert.equal(GV.updateCheckDue(0, 5000), true);
  assert.equal(GV.updateCheckDue(1000, 2000), false);
  assert.equal(GV.updateCheckDue(1000, 1000 + GV.UPDATE_INTERVAL_MS), true);
});

test("the green outline follows the reply being read", () => {
  const doc = window.document;
  const first = doc.getElementById("a");
  const second = doc.getElementById("b");
  GV.placeReadingControls(doc, first, { mode: "playing" });
  assert.equal(first.classList.contains("grok-voice-reading"), true);
  assert.equal(second.classList.contains("grok-voice-reading"), false);
  GV.placeReadingControls(doc, second, { mode: "paused" });
  assert.equal(first.classList.contains("grok-voice-reading"), false);
  assert.equal(second.classList.contains("grok-voice-reading"), true);
  GV.placeReadingControls(doc, null, { mode: "stopped" });
  assert.equal(first.classList.contains("grok-voice-reading"), false);
  assert.equal(second.classList.contains("grok-voice-reading"), false);
});

test("clicking a different reply starts it from the beginning", () => {
  const spoken = [];
  let resumes = 0;
  const playback = GV.createPlayback({
    onSpeak: function (text) { spoken.push(text); },
    onPause: function () { return true; },
    onResume: function () { resumes += 1; return true; }
  });
  playback.setItems([
    { key: "a", speech: "First reply here.", body: { id: "a" } },
    { key: "b", speech: "Second reply here.", body: { id: "b" } }
  ]);
  assert.equal(playback.playFromStart("b"), "Second reply here.");
  assert.equal(playback.state().key, "b");
  assert.equal(playback.state().mode, "playing");
  playback.toggle();
  assert.equal(playback.state().mode, "paused");
  assert.equal(GV.replyClickAction(playback.state().body, playback.state().body), "toggle");
  assert.equal(GV.replyClickAction(playback.state().body, { id: "a" }), "start");
  assert.equal(GV.replyClickAction(playback.state().body, null), "ignore");
  assert.equal(playback.playFromStart("a"), "First reply here.");
  assert.equal(playback.state().key, "a");
  assert.equal(playback.state().mode, "playing");
  assert.equal(resumes, 0);
  assert.deepEqual(spoken, ["Second reply here.", "First reply here."]);
  assert.equal(playback.playFromStart("missing"), "");
  assert.equal(playback.state().key, "a");
});

function composerMarkup() {
  return '<button id="add" type="button">+</button>' +
    '<textarea id="message" placeholder="Message Moya"></textarea>' +
    '<button id="mic" type="button" aria-label="Microphone"></button>' +
    '<button id="voice" type="button" aria-label="Voice mode"></button>';
}

test("the composer bar has no playback buttons", () => {
  const doc = window.document;
  const box = doc.createElement("div");
  box.id = "composer";
  box.innerHTML = composerMarkup();
  doc.body.appendChild(box);
  const reply = doc.getElementById("a");
  const host = GV.placeReadingControls(doc, reply, { mode: "playing" });
  assert.equal(box.querySelector("[data-grok-voice-controls]"), null);
  assert.equal(doc.getElementById("mic").nextElementSibling.id, "voice");
  assert.equal(host.parentNode, reply);
  assert.equal(host.style.position, "absolute");
  assert.equal(host.style.right, "8px");
  assert.equal(host.style.bottom, "8px");
  assert.equal(reply.style.position, "relative");
  const buttons = host.shadowRoot.querySelectorAll("button");
  assert.equal(buttons.length, 1);
  const pause = buttons[0];
  assert.equal(pause.getAttribute("data-action"), "play-pause");
  assert.equal(pause.title, "Pause");
  assert.equal(pause.getAttribute("aria-label"), "Pause");
  assert.equal(pause.title.includes("Alt"), false);
  assert.equal(host.shadowRoot.querySelector('[data-action="previous"]'), null);
  assert.equal(host.shadowRoot.querySelector('[data-action="next"]'), null);
  GV.placeReadingControls(doc, reply, { mode: "paused" });
  assert.equal(pause.title, "Play");
  assert.equal(pause.getAttribute("aria-label"), "Play");
});

test("the corner button moves with the outline and one click does not toggle twice", () => {
  const doc = window.document;
  const first = doc.getElementById("a");
  const second = doc.getElementById("b");
  let toggles = 0;
  const host = GV.placeReadingControls(doc, first, {
    mode: "playing",
    onToggle: function () { toggles += 1; }
  });
  assert.equal(first.classList.contains("grok-voice-reading"), true);
  GV.placeReadingControls(doc, second, {
    mode: "paused",
    onToggle: function () { toggles += 1; }
  });
  assert.equal(first.classList.contains("grok-voice-reading"), false);
  assert.equal(first.querySelector("[data-grok-voice-controls]"), null);
  assert.equal(first.style.position, "");
  assert.equal(second.classList.contains("grok-voice-reading"), true);
  assert.equal(host.parentNode, second);
  assert.equal(second.querySelectorAll("[data-grok-voice-controls]").length, 1);
  const play = host.shadowRoot.querySelector('[data-action="play-pause"]');
  assert.equal(play.title, "Play");
  play.dispatchEvent(new window.MouseEvent("click", { bubbles: true, composed: true }));
  play.dispatchEvent(new window.MouseEvent("click", { bubbles: true, composed: true }));
  mouse(host, "mousedown", 12, 12, 1);
  mouse(host, "mouseup", 12, 12, 1);
  assert.equal(toggles, 1);
  doc.__grokVoiceControlsPress = 0;
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mouse(target, type, x, y, detail) {
  target.dispatchEvent(new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    detail: detail || 1,
    clientX: x,
    clientY: y
  }));
}

const replyList = [];
const replyClicks = [];
GV.bindReplyClick(window.document, function (node) {
  const el = node && node.nodeType === 1 ? node : node && node.parentElement;
  if (!el) return null;
  for (let i = replyList.length - 1; i >= 0; i--) {
    if (replyList[i] === el || replyList[i].contains(el)) return replyList[i];
  }
  return null;
}, function (reply) { replyClicks.push(reply); });

test("a quick click on the outlined reply toggles play", async () => {
  const reply = window.document.getElementById("a");
  replyList.splice(0, replyList.length, reply);
  replyClicks.length = 0;
  mouse(reply, "mousedown", 12, 12, 1);
  mouse(reply, "mouseup", 13, 12, 1);
  await delay(320);
  assert.equal(replyClicks.length, 1);
  assert.equal(replyClicks[0], reply);
  assert.equal(GV.replyClickAction(reply, replyClicks[0]), "toggle");
});

test("a click on another reply selects that reply instead of toggling", async () => {
  const doc = window.document;
  const first = doc.getElementById("a");
  const second = doc.getElementById("b");
  first.textContent = "First assistant reply.";
  second.textContent = "Second assistant reply.";
  replyList.splice(0, replyList.length, first, second);
  replyClicks.length = 0;
  GV.placeReadingControls(doc, first, { mode: "playing" });
  mouse(second, "mousedown", 20, 20, 1);
  mouse(second, "mouseup", 21, 20, 1);
  await delay(320);
  assert.deepEqual(replyClicks, [second]);
  assert.equal(GV.replyClickAction(first, second), "start");
  GV.placeReadingControls(doc, second, { mode: "playing" });
  assert.equal(first.classList.contains("grok-voice-reading"), false);
  assert.equal(first.querySelector("[data-grok-voice-controls]"), null);
  assert.equal(second.classList.contains("grok-voice-reading"), true);
  assert.equal(second.querySelector("[data-grok-voice-controls]").style.position, "absolute");
  replyClicks.length = 0;
  mouse(first, "mousedown", 8, 8, 1);
  mouse(first, "mouseup", 9, 8, 1);
  await delay(320);
  assert.deepEqual(replyClicks, [first]);
  assert.equal(GV.replyClickAction(second, first), "start");
});

test("dragging across the reply does not toggle play", async () => {
  const reply = window.document.getElementById("a");
  reply.textContent = "Select this reply text instead of toggling.";
  replyList.splice(0, replyList.length, reply);
  replyClicks.length = 0;
  mouse(reply, "mousedown", 8, 8, 1);
  mouse(reply, "mouseup", 40, 18, 1);
  await delay(320);
  assert.equal(replyClicks.length, 0);
});

test("a text selection inside the reply does not toggle play", async () => {
  const doc = window.document;
  const reply = doc.getElementById("a");
  reply.textContent = "Select this reply text instead of toggling.";
  replyList.splice(0, replyList.length, reply);
  const text = reply.firstChild;
  const range = doc.createRange();
  range.setStart(text, 0);
  range.setEnd(text, 6);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  assert.equal(selection.isCollapsed, false);
  replyClicks.length = 0;
  mouse(reply, "mousedown", 12, 12, 1);
  mouse(reply, "mouseup", 14, 12, 1);
  await delay(320);
  assert.equal(replyClicks.length, 0);
  selection.removeAllRanges();
});

test("a double-click does not toggle play", async () => {
  const reply = window.document.getElementById("a");
  replyList.splice(0, replyList.length, reply);
  replyClicks.length = 0;
  mouse(reply, "mousedown", 12, 12, 1);
  mouse(reply, "mouseup", 12, 12, 1);
  mouse(reply, "mousedown", 12, 12, 2);
  mouse(reply, "mouseup", 12, 12, 2);
  reply.dispatchEvent(new window.MouseEvent("dblclick", { bubbles: true, detail: 2, clientX: 12, clientY: 12 }));
  await delay(320);
  assert.equal(replyClicks.length, 0);
});

test("a click on a link inside the reply does not toggle play", async () => {
  const reply = window.document.getElementById("a");
  const link = window.document.createElement("a");
  link.href = "https://example.com/notes";
  link.textContent = "notes";
  reply.appendChild(link);
  replyList.splice(0, replyList.length, reply);
  replyClicks.length = 0;
  mouse(link, "mousedown", 12, 12, 1);
  mouse(link, "mouseup", 12, 12, 1);
  await delay(320);
  assert.equal(replyClicks.length, 0);
});
