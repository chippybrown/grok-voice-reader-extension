# Privacy policy for Grok Voice Reader

This policy covers the Grok Voice Reader browser extension (Chrome, Edge, and Brave).

The publisher is a non-trader. Contact: chip.brown@cormeg.com.

## What stays on your computer

The extension reads the text of a Grok reply in the tab you have open so it can speak that reply. Reading happens in the browser. The reply text is not sent to a server.

Voices normally come from the browser's built-in speech feature (`speechSynthesis`). If you choose a Piper voice, the extension downloads that voice model from Hugging Face (`rhasspy/piper-voices`) and stores the file in this browser only (IndexedDB). The model is data, not code. Your voice choice is not sent anywhere.

These settings are saved only in the browser's local extension storage (`chrome.storage.local`):

- whether reading is on
- the default voice and the voice for each bot
- whether each bot is read aloud
- speaking rate
- play or pause
- whether a beta update notice is offered

## Network requests

About once a day, and only if you installed from GitHub or as an unpacked extension, the extension asks GitHub whether a newer version exists:

`https://api.github.com/repos/chippybrown/grok-voice-reader-extension/releases/latest`

That request sends a generic label, `User-Agent: grok-voice-reader`. It does not send reply text, voice names, bot names, or account information. Installs from the Chrome Web Store skip this check.

If you download a Piper voice, the extension fetches that model file from `huggingface.co`. The file stays on your computer. Reply text is not included in the request.

## What we do not do

The extension does not collect personal information, health information, financial information, location, or authentication data. It does not sell data. It does not use data for advertising or credit decisions. It does not include remote code.

## Changes

The current policy is this file in the project repository.
