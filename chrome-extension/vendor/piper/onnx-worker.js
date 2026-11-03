importScripts("ort.wasm.min.js");

var session = null;

function pcmToWav(buffer, sampleRate) {
  var headerLength = 44;
  var view = new DataView(new ArrayBuffer(buffer.length * 2 + headerLength));
  view.setUint32(0, 0x46464952, true);
  view.setUint32(4, view.buffer.byteLength - 8, true);
  view.setUint32(8, 0x45564157, true);
  view.setUint32(12, 0x20746d66, true);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, 2 * sampleRate, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x61746164, true);
  view.setUint32(40, buffer.length * 2, true);
  var p = headerLength;
  for (var i = 0; i < buffer.length; i++) {
    var v = buffer[i];
    if (v >= 1) view.setInt16(p, 32767, true);
    else if (v <= -1) view.setInt16(p, -32768, true);
    else view.setInt16(p, (v * 32768) | 0, true);
    p += 2;
  }
  return view.buffer;
}

self.onmessage = function (event) {
  var type = event.data.type;
  var data = event.data.data || {};
  if (type === "init") {
    ort.env.wasm.wasmPaths = data.wasmPaths;
    ort.env.wasm.numThreads = 1;
    self.postMessage({ ok: true });
    return;
  }
  if (type !== "generate") return;
  var ids = data.phonemeIds || [];
  var config = data.config;
  var feeds = {
    input: new ort.Tensor("int64", ids, [1, ids.length]),
    input_lengths: new ort.Tensor("int64", [ids.length]),
    scales: new ort.Tensor("float32", [
      config.inference.noise_scale,
      config.inference.length_scale,
      config.inference.noise_w
    ])
  };
  if (config.speaker_id_map && Object.keys(config.speaker_id_map).length) {
    feeds.sid = new ort.Tensor("int64", [data.speaker || 0]);
  }
  var pending = session
    ? Promise.resolve(session)
    : ort.InferenceSession.create(data.model, { executionProviders: ["wasm"] }).then(function (created) {
      session = created;
      return created;
    });
  pending.then(function (current) {
    return current.run(feeds);
  }).then(function (output) {
    var wav = pcmToWav(output.output.data, config.audio.sample_rate);
    self.postMessage({ ok: true, wav: wav }, [wav]);
  }).catch(function (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err) });
  });
};
