# Grok Voice Reader

[![Download](https://img.shields.io/badge/Download-brightgreen?style=for-the-badge)](https://github.com/chippybrown/grok-voice-reader-extension/releases/latest)

This add-on reads a new Grok reply out loud. It works in Chrome, Edge, and Brave.

## Easy install

On Windows, download [Grok-Voice-Reader-Setup.exe](https://github.com/chippybrown/grok-voice-reader-extension/releases/latest/download/Grok-Voice-Reader-Setup.exe) and run it. It copies the add-on to `%LOCALAPPDATA%\Grok Voice Reader\extension` and opens the extensions page.

On Linux, download [Grok-Voice-Reader-x86_64.AppImage](https://github.com/chippybrown/grok-voice-reader-extension/releases/latest/download/Grok-Voice-Reader-x86_64.AppImage) and run it. It copies the add-on to `~/.local/share/grok-voice-reader/extension` and opens the extensions page.

Then turn on **Developer mode**. Click **Load unpacked**. Pick that folder.

Refresh the Grok tab, then click the page once.

## Install from the zip

Use this if you do not want the Windows or Linux installer.

1. Download [Grok-Voice-Reader-Extension.zip](https://github.com/chippybrown/grok-voice-reader-extension/releases/latest/download/Grok-Voice-Reader-Extension.zip) and unzip it. On Windows, right-click the zip and choose **Extract All**. On a Mac, double-click the zip. Put the folder somewhere you will keep, such as Documents. It must contain a file named `manifest.json`.
2. Open the extensions page. Type one of these in the address bar and press Enter:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
3. Turn on **Developer mode**. Click **Load unpacked**. Pick the unzipped folder.

Leave that folder where it is. If you move or delete it, the add-on stops working.

## Playing a reply

Only one reply has a green outline. A **Play/Pause** button sits in the lower-right corner of that box. Hold the pointer on it to see Play or Pause.

Click a different reply to move the outline there and read that reply from the beginning. That turns Play on. The outline and the button leave every other reply.

Click the outlined reply, the corner button, or press **Alt+Shift+P** to pause or to continue. If you paused in the middle of that same reply, Play continues from that place.

Play stays on until you pause. While paused, a new reply gets the outline and stays quiet until you press Play.

The sentence being read is tinted yellow-green. If you scroll away, the page waits a few seconds before following it.

**Alt+Shift+P** plays or pauses. **Alt+Left** and **Alt+Right** go to the previous or next reply from the keyboard.

## Each bot

Click the Grok Voice Reader icon. The popup has a voice and an on or off switch for the bot you have open. **Voice for this bot** picks the voice. **Read this bot aloud** turns reading on or off for that bot.
