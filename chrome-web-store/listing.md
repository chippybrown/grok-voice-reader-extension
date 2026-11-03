# Chrome Web Store listing — Grok Voice Reader 0.4.0

Account: chip.brown@cormeg.com (free, non-trader).

Privacy policy URL (after this pull request is on main):

https://github.com/chippybrown/grok-voice-reader-extension/blob/main/PRIVACY.md

Upload file: `Grok-Voice-Reader-ChromeWebStore.zip` (also on the GitHub release). `manifest.json` is at the root of the zip. Tests, npm files, and installer sources are not in it.

Images in this folder: `icon128.png` (128×128), `screenshot-1280x800.png` (1280×800), `promo-440x280.png` (440×280). They are mockups of this extension's own UI. They do not use Google or xAI logos.

## Dashboard fields

- **Name:** Grok Voice Reader
- **Summary (132 characters or fewer):** Reads a new Grok reply out loud in the open tab, using the speech voices already on your computer.
- **Category:** Accessibility
- **Language:** English

### Single purpose

Reads Grok replies aloud in the tab that is open, using speech voices on the computer, including an optional Piper voice the user downloads.

### Detailed description

Grok Voice Reader reads a new Grok reply out loud in the tab you have open. It works in Chrome. Edge and Brave can install the same listing.

A new reply is read after it stops changing. Your own messages stay quiet. Each bot can have its own voice and its own on or off switch. Those choices stay in the browser.

The reply being read has an outline and a Play/Pause button in the corner. The outline is green while reading is on, and light orange while paused. Click another reply to read that one from the start. Pause keeps your place in the same reply. While paused, a new reply is outlined and stays quiet until you press Play.

The sentence being spoken is tinted so you can follow it. Voices are the ones already installed on the computer. If those are few, you can download a free Piper voice. The speech runtime is part of the extension. The voice model is a data file stored in this browser. The extension does not send reply text anywhere.

## Permission justification

`activeTab` is not requested. Nothing in the extension calls it. Content scripts and messages to those pages are covered by the host permissions below.

### storage

Needed. The extension saves your voice, rate, per-bot on/off switch, and play or pause mode with `chrome.storage.local`. Nothing in that store is uploaded.

### offscreen

Needed. Piper speech runs in a hidden extension document so the bundled WebAssembly can turn a downloaded voice model into a sound file. The document is not a web page and it does not load remote code.

### Host permissions

| Permission | Why it is needed |
| --- | --- |
| `https://grok.com/*` | The content script reads a Grok chat on grok.com, including grok.com/bot. |
| `https://*.grok.com/*` | The same chat on a grok.com subdomain. |
| `https://x.ai/*` | The content script is registered for a Grok chat opened on x.ai. |
| `https://*.x.ai/*` | The same chat on an x.ai subdomain. |
| `https://grok.x.ai/*` | The content script is registered for a Grok chat opened on grok.x.ai. |
| `https://*.grok.x.ai/*` | The same chat on a grok.x.ai subdomain. |
| `https://cursor.com/*` | The content script is registered for a Grok chat opened on cursor.com. |
| `https://*.cursor.com/*` | The same chat on a cursor.com subdomain. |
| `https://api.github.com/*` | Unpacked and GitHub installs ask the public releases API at most once a day whether a newer version exists. Chrome Web Store installs skip this. No reply text is sent. |
| `https://huggingface.co/*` | When you choose a Piper voice, the extension downloads that voice model from the official `rhasspy/piper-voices` files. The file is model data, not code. |
| `https://*.hf.co/*` | Hugging Face redirects the model file to its download host, such as `us.aws.cdn.hf.co`. This permission lets that file download finish. |

These chat hosts are the same list as `content_scripts.matches`. `api.github.com` is only the update check. `huggingface.co` and `*.hf.co` are only the voice-model download. Chrome grants the whole host even when the pattern has a path. The Piper and ONNX WebAssembly files are inside the extension package and are loaded with `chrome.runtime.getURL`. The extension pages content security policy includes `wasm-unsafe-eval` so that bundled WebAssembly can run. No script is loaded from the network.

## Data-usage answers

Confirm these in the privacy form. Checked against the source: network calls are the GitHub releases request in `chrome-extension/src/background.js` and, only if you download a Piper voice, the model file from Hugging Face. System voices use local `speechSynthesis`. Settings use `chrome.storage.local`. Piper models stay in IndexedDB.

- **Do you collect user data?** No.
- **Personally identifiable information:** No.
- **Health information:** No.
- **Financial and payment information:** No.
- **Authentication information:** No.
- **Personal communications:** No. Reply text is read in the page so it can be spoken. It is not transmitted.
- **Location:** No.
- **Web history:** No.
- **User activity:** No.
- **Website content:** Not collected. The words of a reply are processed on the device and are not sent off the device.
- **I do not sell or transfer user data to third parties:** Yes, certify.
- **I do not use or transfer user data for purposes unrelated to the single purpose:** Yes, certify.
- **I do not use or transfer user data to determine creditworthiness or for lending:** Yes, certify.

The GitHub request sends only `User-Agent: grok-voice-reader` and receives the public release list. It does not include reply text, voice names, or an account.
