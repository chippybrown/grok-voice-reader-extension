# Grok Voice Reader

[![Download the newest version](https://img.shields.io/badge/Download%20the%20newest%20version-brightgreen?style=for-the-badge)](https://github.com/chippybrown/grok-voice-reader-extension/releases/latest/download/Grok-Voice-Reader-Extension.zip)

That button is always the newest release.

A browser add-on that reads a new Grok reply out loud. It works in the tab you have open, including a Grok Bot chat at grok.com/bot. The popup shows the version next to the title.

You need Chrome, Edge, or Brave, and a speech voice already installed on the computer. Those browsers use the voices that come with Windows or macOS. In Edge, Jenny Online (Natural) is one of those voices.

## Install

[![Coming soon to the Chrome Web Store](https://img.shields.io/badge/Coming%20soon%20to%20the%20Chrome%20Web%20Store-brightgreen?style=for-the-badge)](#coming-soon)

<!-- TODO: replace the badge link above with the Chrome Web Store listing URL after it is approved. -->

<a id="coming-soon"></a>

**Chrome:** Coming soon to the Chrome Web Store.

**Edge:** Open that listing, turn on **Allow extensions from other stores**, then click **Add**.

**Brave:** Open that listing and click **Add**.

Or install from GitHub. On Windows, run [Grok-Voice-Reader-Setup.exe](https://github.com/chippybrown/grok-voice-reader-extension/releases/latest/download/Grok-Voice-Reader-Setup.exe). On Linux, run [Grok-Voice-Reader-x86_64.AppImage](https://github.com/chippybrown/grok-voice-reader-extension/releases/latest/download/Grok-Voice-Reader-x86_64.AppImage). Or unzip [Grok-Voice-Reader-Extension.zip](https://github.com/chippybrown/grok-voice-reader-extension/releases/latest/download/Grok-Voice-Reader-Extension.zip), turn on **Developer mode**, click **Load unpacked**, and pick the folder. Leave that folder where it is.

## First time you use it

1. Open your Grok chat, such as `https://grok.com/bot/…`.
2. Refresh that tab. The extension does not attach to a tab that was already open.
3. Click once anywhere on the page. Chrome, Edge, and Brave sometimes stay quiet until the page has been clicked.
4. The toolbar icon shows **ON** when the tab is a Grok page and reading is turned on.
5. Send a new message. When the reply stops changing for about a second and a half, it is read aloud. Replies that were already on the page stay quiet. Your own messages stay quiet. The bot’s name is not read.

## Playing a reply

Only one reply is outlined. Play mode is green. Pause mode is light orange, including a new reply the outline moves to while paused. **Play/Pause** sits in the lower-right corner of that box.

Click a different reply to outline it and read it from the start. That turns Play on. Click the outlined reply to pause, or to continue the same reply from where it stopped.

Play stays on until you pause. While paused, a new reply gets the outline and stays quiet until you press Play.

The sentence being read is tinted yellow-green. If you scroll away, the page waits a few seconds before following it.

**Alt+Shift+P** plays or pauses. **Alt+Left** and **Alt+Right** go to the previous or next reply from the keyboard.

## Voice and speed

1. Click the **Grok Voice Reader** icon.
2. Open **Voice** and pick a voice. If the list only says **Browser default**, your computer may still be loading voices. Close the popup and open it again.
3. Move **Rate**. 1.0 is normal. Lower is slower. The highest is 2.
4. **Stop** stops the voice that is playing.
5. **Replay last** reads the last reply again.

Those choices are remembered.

**Show what it detects** is off. Leave it off unless a reply is not being read. When it is on, the latest reply is outlined in green, and the page console (press F12, then **Console**) prints lines that start with `[GrokVoice]`.

## Update

1. Download the new zip and unzip it.
2. Replace the contents of the folder the browser is already using. Do not load a second copy.
3. Open `chrome://extensions`, `edge://extensions`, or `brave://extensions`.
4. Click **Reload** on Grok Voice Reader. The circular arrow is on the extension card.
5. Refresh the Grok tab, and click the page once.

## If nothing is read

- Refresh the Grok tab after you load or reload the extension.
- Click the page once.
- Open the extension popup. It lists each frame and how many replies it found. A count of zero means that frame cannot see the chat.
- Turn on **Read new replies aloud** if it is off.

## For developers

From this folder, with Chrome or Chromium installed (`CHROME_PATH` if it is not `/usr/bin/google-chrome`):

```bash
npm install
npm test
```

URL patterns live in `src/config.js` and must match `manifest.json`. Download buttons use `/releases/latest`, so they follow the newest release. Do not point them at a numbered release.
