// Free Piper voices. The runtime is bundled. A model file is data.
(function (root) {
  "use strict";

  var GV = root.GrokVoice || (root.GrokVoice = {});
  var DB_NAME = "grok-voice-piper";
  var STORE = "voices";

  GV.PIPER_PREFIX = "piper:";
  GV.PIPER_MODEL_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main/";

  // Sizes are the Content-Range lengths published for these official files.
  GV.PIPER_VOICES = [
    {
      id: "en_US-lessac-low",
      name: "Lessac (US)",
      lang: "en-US",
      bytes: 63201294,
      path: "en/en_US/lessac/low/en_US-lessac-low"
    },
    {
      id: "en_GB-alba-medium",
      name: "Alba (UK)",
      lang: "en-GB",
      bytes: 63201294,
      path: "en/en_GB/alba/medium/en_GB-alba-medium"
    }
  ];

  GV.countEnglishVoices = function countEnglishVoices(voices) {
    var count = 0;
    var list = voices || [];
    for (var i = 0; i < list.length; i++) {
      var lang = String(list[i] && list[i].lang || "");
      if (/^en([-_]|$)/i.test(lang)) count += 1;
    }
    return count;
  };

  // One-time offer when the computer has few English system voices.
  GV.shouldOfferPiper = function shouldOfferPiper(voices, dismissed) {
    if (dismissed) return false;
    return GV.countEnglishVoices(voices) <= 5;
  };

  GV.isPiperVoice = function isPiperVoice(uri) {
    return String(uri || "").indexOf(GV.PIPER_PREFIX) === 0;
  };

  GV.piperVoiceId = function piperVoiceId(uri) {
    return GV.isPiperVoice(uri) ? String(uri).slice(GV.PIPER_PREFIX.length) : "";
  };

  GV.piperVoiceURI = function piperVoiceURI(id) {
    return GV.PIPER_PREFIX + id;
  };

  GV.formatBytes = function formatBytes(bytes) {
    var n = Number(bytes) || 0;
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  };

  GV.piperVoiceById = function piperVoiceById(id) {
    for (var i = 0; i < GV.PIPER_VOICES.length; i++) {
      if (GV.PIPER_VOICES[i].id === id) return GV.PIPER_VOICES[i];
    }
    return null;
  };

  GV.piperModelUrl = function piperModelUrl(voice, suffix) {
    return GV.PIPER_MODEL_BASE + voice.path + suffix;
  };

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!root.indexedDB) {
        reject(new Error("IndexedDB is not available"));
        return;
      }
      var req = root.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  GV.listPiperVoices = function listPiperVoices() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
        req.onsuccess = function () {
          var rows = req.result || [];
          resolve(rows.map(function (row) {
            return { id: row.id, name: row.name, lang: row.lang, bytes: row.bytes };
          }));
        };
        req.onerror = function () { reject(req.error); };
      });
    });
  };

  GV.getPiperVoice = function getPiperVoice(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  };

  GV.savePiperVoice = function savePiperVoice(record) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(record);
        tx.oncomplete = function () { resolve(record); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  };
})(globalThis);
