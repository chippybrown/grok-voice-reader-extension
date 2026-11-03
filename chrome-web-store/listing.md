# Chrome Web Store listing — Grok Voice Reader 0.3.1

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

Reads Grok replies aloud in the tab that is open, using the computer's own speech voices.

### Detailed description

Grok Voice Reader reads a new Grok reply out loud in the tab you have open. It works in Chrome. Edge and Brave can install the same listing.

A new reply is read after it stops changing. Your own messages stay quiet. Each bot can have its own voice and its own on or off switch. Those choices stay in the browser.

The reply being read has a green outline and a Play/Pause button in the corner. Click another reply to read that one from the start. Pause keeps your place in the same reply. While paused, a new reply is outlined and stays quiet until you press Play.

The sentence being spoken is tinted so you can follow it. Voices are the ones already installed on the computer. The extension does not send reply text anywhere.

## Permission justification

`activeTab` was removed. Nothing in the extension calls it. Content scripts and messages to those pages are covered by the host permissions below. Store review rejects a permission that is not used.

### storage

Needed. The extension saves your voice, rate, per-bot on/off switch, and play or pause mode with `chrome.storage.local`. Nothing in that store is uploaded.

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
| `https://api.github.com/*` | About once a day the service worker fetches the public GitHub releases list to show an update notice. No reply text is sent. |

These host names are the same list as `content_scripts.matches`, plus `api.github.com` for the update check. Chrome grants the whole host even when the pattern has a path.

## Data-usage answers

Confirm these in the privacy form. Checked against the source: the only network call is the GitHub releases request in `chrome-extension/src/background.js`. Voices use local `speechSynthesis`. Settings use `chrome.storage.local`.

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
