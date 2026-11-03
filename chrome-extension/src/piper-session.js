var piperBase = chrome.runtime.getURL("vendor/piper/piper/");
var onnxBase = chrome.runtime.getURL("vendor/piper/onnx/");
var phonemes = null;
var onnx = null;
var loadedId = "";

function callWorker(worker, type, data, transfer) {
  return new Promise(function (resolve, reject) {
    function done(event) {
      worker.removeEventListener("message", done);
      worker.removeEventListener("error", fail);
      resolve(event.data);
    }
    function fail(event) {
      worker.removeEventListener("message", done);
      worker.removeEventListener("error", fail);
      reject(event.error || new Error("Piper worker failed"));
    }
    worker.addEventListener("message", done);
    worker.addEventListener("error", fail);
    worker.postMessage({ type: type, data: data }, transfer || []);
  });
}

async function ensurePhonemes() {
  if (phonemes) return;
  phonemes = new Worker(chrome.runtime.getURL("vendor/piper/PhonemizeWebWorker.js"), { type: "module" });
  phonemes.postMessage({ type: "constructor", data: { basePath: piperBase } });
  await callWorker(phonemes, "loadModule", []);
}

async function ensureOnnx() {
  if (onnx) return;
  onnx = new Worker(chrome.runtime.getURL("vendor/piper/onnx-worker.js"));
  await callWorker(onnx, "init", { wasmPaths: onnxBase });
}

async function synthesize(voiceId, text) {
  var row = await globalThis.GrokVoice.getPiperVoice(voiceId);
  if (!row || !row.model || !row.config) throw new Error("missing-voice");
  if (loadedId !== voiceId) {
    if (onnx) onnx.terminate();
    onnx = null;
    loadedId = voiceId;
  }
  var needModel = !onnx;
  await ensurePhonemes();
  await ensureOnnx();
  var phonemeData = await callWorker(phonemes, "phonemize", [text, [row.config, row.model]]);
  var model = needModel ? row.model.slice(0) : null;
  var audio = await callWorker(onnx, "generate", {
    phonemeIds: phonemeData.phoneme_ids,
    config: row.config,
    model: model
  }, model ? [model] : []);
  if (!audio || !audio.ok) throw new Error(audio && audio.error || "no-audio");
  return audio.wav;
}

chrome.runtime.sendMessage({ type: "piper-ready" });

chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
  if (!message || message.type !== "piper-run") return;
  synthesize(message.voiceId, message.text).then(function (wav) {
    sendResponse({ ok: true, wav: Array.from(new Uint8Array(wav)) });
  }).catch(function (err) {
    sendResponse({ ok: false, error: String(err && err.message || err) });
  });
  return true;
});
