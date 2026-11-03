// Authors: Grok and Eldon R. Brown - WA0UWH
// Rev 20261103 - 0.4.6: after a jump, Play, or Resume, reading keeps going
// paragraph by paragraph to the end of the reply (mock voice, real clicks).
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const puppeteer = require("puppeteer-core");

const root = path.join(__dirname, "..");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
// Same markup as the screenshot harness (Grok-like turns and classes).
const B = 'class="break-words last:mb-0 max-md:leading-[155%] streamdown-first-block:mt-0"';
const P = (t) => `<p dir="auto" ${B}>${t}</p>`;
const reply = (id, paras) => `<div class="turn start"><div class="card"><div class="who">Grok</div><div class="pad gray" id="${id}">${paras.map(P).join("")}</div></div></div>`;
const user = (t) => `<div class="turn end" data-message-author-role="user"><div class="pad purple">${P(t)}</div></div>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Grok mock</title><style>
.turn{display:flex}.start{justify-content:flex-start}.end{justify-content:flex-end}.pad{max-width:75%;padding:10px 14px}.card{display:flex;flex-direction:column;max-width:75%}.gray{background:#2b2e36}.purple{background:#6d28d9;color:#fff}</style></head><body><div id="thread">
${user("What is a dipole?")}
${reply("r1", ["A dipole is two wires.", "Each leg is a quarter wave."])}
${user("How long for 20 meters?")}
${reply("r2", ["About 33 feet tip to tip.", "Cut each leg near 16.5 feet", "Mount it high and clear.", "73 and good DX!"])}
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

// Rev 20261103 - 0.4.7 hands-free run (Grok and Eldon R. Brown - WA0UWH)
const R1 = ["A dipole is two wires.", "Each leg is a quarter wave."];
const R2 = ["About 33 feet tip to tip.", "Cut each leg near 16.5 feet", "Mount it high and clear.", "73 and good DX!"];
const R3 = ["New reply here.", "It has two paragraphs."];
const addReply = (page) => page.evaluate((u, r) => {
  const t = document.getElementById("thread");
  t.insertAdjacentHTML("beforeend", u);
  t.insertAdjacentHTML("beforeend", r);
}, user("And a balun?"), reply("r3", R3));
const waitSaid = async (evalw, last, ms) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { const s = await evalw("__said"); if (s[s.length - 1] === last) return s; await delay(150); }
  return evalw("__said");
};

test("hands-free: |<< back two replies, then it reads every reply in order with no more presses", { timeout: 90000 }, async () => {
  const { browser, page, evalw, click } = await open();
  try {
    await click("bar", "forward");          // newest reply, first paragraph
    await delay(400);
    await click("corner", "reply-back");    // at top: previous reply
    await delay(150);
    await evalw("(__said.length = 0, true)");
    await delay(300);
    await addReply(page);                   // arrives mid-run: queued, no jump
    const said = await waitSaid(evalw, R3[1], 20000);
    const from = said.indexOf(R1[1]);
    assert.deepEqual(said.slice(from), [R1[1], ...R2, ...R3], JSON.stringify(said));
  } finally {
    await browser.close();
  }
});

test("hands-free: after the newest reply it waits, then reads a new reply paragraph by paragraph", { timeout: 90000 }, async () => {
  const { browser, page, evalw, click } = await open();
  try {
    await click("bar", "forward");
    let said = await waitSaid(evalw, R2[3], 10000);
    assert.equal(said[said.length - 1], R2[3]);
    await click("corner", "reply-forward"); // >>| at the very end: no End, just wait
    await delay(800);
    await addReply(page);
    said = await waitSaid(evalw, R3[1], 20000);
    assert.deepEqual(said.slice(-2), R3, JSON.stringify(said));
  } finally {
    await browser.close();
  }
});

test("hands-free: Stop halts the run, and a new reply is not read after Stop", { timeout: 90000 }, async () => {
  const { browser, page, evalw, click } = await open();
  try {
    await click("bar", "forward");
    await delay(150);
    await click("bar", "stop");
    await delay(200);
    const n = (await evalw("__said")).length;
    await addReply(page);
    await delay(5000);
    assert.equal((await evalw("__said")).length, n, "quiet after Stop");
  } finally {
    await browser.close();
  }
});
// End
