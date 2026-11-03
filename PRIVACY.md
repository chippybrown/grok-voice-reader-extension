# Privacy policy for Grok Voice Reader

This policy covers the Grok Voice Reader browser extension (Chrome, Edge, and Brave).

The publisher is a non-trader. Contact: chip.brown@cormeg.com.

## What stays on your computer

The extension reads the text of a Grok reply in the tab you have open so it can speak that reply. Reading happens in the browser. The reply text is not sent to a server.

Voices come from the browser's built-in speech feature (`speechSynthesis`). The extension does not download voices and does not send your voice choice anywhere.

These settings are saved only in the browser's local extension storage (`chrome.storage.local`):

- whether reading is on
- the default voice and the voice for each bot
- whether each bot is read aloud
- speaking rate
- play or pause
- whether a beta update notice is offered

## The one network request

About once a day the extension asks GitHub's public releases API whether a newer version exists:

`https://api.github.com/repos/chippybrown/voice-reader-for-grokbot/releases`

That request sends a generic label, `User-Agent: grok-voice-reader`. It does not send reply text, voice names, bot names, or account information. GitHub may log the request under its own policy.

## What we do not do

The extension does not collect personal information, health information, financial information, location, or authentication data. It does not sell data. It does not use data for advertising or credit decisions. It does not include remote code.

## Changes

The current policy is this file in the project repository.
