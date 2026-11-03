// Authors: Grok and Eldon R. Brown - WA0UWH
// Rev 20261103 - 0.4.6: after a jump, Play, or Resume, reading keeps going
// paragraph by paragraph to the end of the reply (mock voice, real clicks).
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const puppeteer = require("puppeteer-core");

const root = path.join(__dirname, "..");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const P = (t) => `<p dir="auto">${t}</p>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Grok mock</title></head><body><div id="thread">
<div class="turn end"><div class="pad">${P("What is a dipole?")}</div></div>
<div class="turn start"><div class="pad" id="r1">${P("A dipole is two wires.")}${P("Each leg is a quarter wave.")}</div></div>
<div class="turn end"><div class="pad">${P("How long for 20 meters?")}</div></div>
<div class="turn start"><div class="pad" id="r2">${P("About 33 feet tip to tip.")}${P("Cut each leg near 16.5 feet")}${P("Mount it high and clear.")}${P("73 and good DX!")}</div></div>
</div></body></html>`;

// Mock voice: onstart soon, onend after `ms`, cancel ends the current one.
const VOICE = (ms) => `(() => { let cur = null; globalThis.__said = []; globalThis.__marks = [];
  const fin = (u, err) => { if (cur !== u) return; cur = null; setTimeout(() => { if (err && u.onerror) u.onerror({ error: err }); if (u.onend) u.onend({}); }, 5); };
  const sp = function (u) { cur = u; __said.push(u.text); setTimeout(() => { if (cur !== u) return; if (u.onstart) u.onstart();
    const m = document.querySelector(".grok-voice-paragraph"); __marks.push(m ? m.textContent : ""); }, 10); setTimeout(() => fin(u), ${ms}); };
  SpeechSynthesis.prototype.speak = sp; speechSynthesis.speak = sp;
  Object.defineProperty(speechSynthesis, "speaking", { get: () => Boolean(cur) });
  const cn = function () { if (cur) fin(cur, "interrupted"); }; SpeechSynthesis.prototype.cancel = cn; speechSynthesis.cancel = cn;
  speechSynthesis.pause = function () {}; speechSynthesis.resume = function () {}; return true; })()`;

async function open() {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, pipe: true, enableExtensions: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  await browser.installExtension(root);
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 760 });
  await page.setRequestInterception(true);
  page.on("request", (r) => (r.url().startsWith("https://grok.com/") ? r.respond({ status: 200, contentType: "text/html", body: html }) : r.continue()));
  await page.goto("https://grok.com/bot/mock", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("html[data-grok-voice-armed='1']");
  await page.waitForFunction(() => document.querySelector("[data-grok-voice-controls=bar]"), { timeout: 15000 });
  const client = await page.createCDPSession();
  const ctx = [];
  client.on("Runtime.executionContextCreated", (e) => ctx.push(e.context));
  await client.send("Runtime.enable");
  await delay(300);
  let world = null;
  for (const c of ctx.filter((c) => c.auxData && c.auxData.type === "isolated")) {
    const r = await client.send("Runtime.evaluate", { contextId: c.id, expression: "typeof globalThis.GrokVoice", returnByValue: true });
    if (r.result.value === "object") world = c.id;
  }
  const evalw = async (expression) => (await client.send("Runtime.evaluate", { contextId: world, expression, returnByValue: true })).result.value;
  await evalw(VOICE(500));
  // Real mouse click on a shadow button: bar or corner.
  const click = async (which, action) => {
    const sel = which === "bar" ? "[data-grok-voice-controls=bar]" : "[data-grok-voice-controls='1']";
    const r = await page.evaluate((sel, a) => { const b = document.querySelector(sel).shadowRoot.querySelector(`[data-action="${a}"]`); const q = b.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; }, sel, action);
    await page.mouse.click(r.x, r.y);
  };
  return { browser, page, evalw, click };
}

test("after a Forward jump, reading continues paragraph by paragraph to the end of the reply", { timeout: 60000 }, async () => {
  const { browser, evalw, click } = await open();
  try {
    await click("bar", "forward");            // start of the newest reply
    await delay(200);
    await click("corner", "forward");         // >| to paragraph 2, then no more presses
    await delay(3000);
    const said = await evalw("__said");
    const marks = await evalw("__marks");
    const tail = said.slice(1);
    assert.deepEqual(tail, ["Cut each leg near 16.5 feet", "Mount it high and clear.", "73 and good DX!"], JSON.stringify(said));
    assert.deepEqual(marks.slice(-3), tail, "pointer moves with each paragraph");
    assert.equal(said.includes("A dipole is two wires."), false, "does not run into another reply");
  } finally {
    await browser.close();
  }
});

test("Play from idle and Resume after Pause keep reading the following paragraphs", { timeout: 60000 }, async () => {
  const { browser, evalw, click } = await open();
  try {
    await click("bar", "end");                // outline the newest reply, idle
    await delay(300);
    await click("corner", "play-pause");      // Play from idle
    await delay(450);
    await click("corner", "play-pause");      // Pause in paragraph 1
    await delay(700);
    const before = (await evalw("__said")).length;
    await click("corner", "play-pause");      // Resume
    await delay(3000);
    const said = await evalw("__said");
    assert.equal(said[0], "About 33 feet tip to tip.");
    assert.ok(said.length > before, "resumed " + JSON.stringify(said));
    assert.deepEqual(said.slice(-3), ["Cut each leg near 16.5 feet", "Mount it high and clear.", "73 and good DX!"], JSON.stringify(said));
  } finally {
    await browser.close();
  }
});
// End
