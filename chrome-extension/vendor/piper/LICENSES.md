# Bundled Piper runtime

These files run locally. Voice models are not included. The extension downloads a model the user picks from `rhasspy/piper-voices` on Hugging Face and stores it in IndexedDB. That download is model data, not code.

- `PhonemizeWebWorker.js` is from piper-tts-web 1.1.2 (MIT). See `LICENSE-piper-tts-web.txt`. Copyright 2024 Jonas Plamann.
- `ort.wasm.min.js` and `onnx/ort-wasm-simd-threaded.wasm` are ONNX Runtime Web 1.20.1 (MIT).
- `piper/piper_phonemize.wasm` and `piper/piper_phonemize.data` are the eSpeak NG phonemizer used by Piper. eSpeak NG is GPL-3.0-or-later, the same license as this extension.

The workers are loaded from this package with `chrome.runtime.getURL`. They are not fetched from a CDN.
