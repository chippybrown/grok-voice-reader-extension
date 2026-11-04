# Grok Voice Reader

[![Coming soon to the Chrome Web Store](https://img.shields.io/badge/Coming%20soon%20to%20the%20Chrome%20Web%20Store-brightgreen?style=for-the-badge)](#coming-soon)

<!-- TODO: replace the badge link above with the Chrome Web Store listing URL after it is approved. -->

This add-on reads a new Grok reply out loud. It works in Chrome, Edge, and Brave.

## Install from the Chrome Web Store

<a id="coming-soon"></a>

**Chrome:** Coming soon to the Chrome Web Store. The badge above will open the listing after it is approved.

**Edge:** Open that same listing, turn on **Allow extensions from other stores**, then click **Add**.

**Brave:** Open that same listing and click **Add**.

## Install from GitHub

[![Download](https://img.shields.io/badge/Download-brightgreen?style=for-the-badge)](https://github.com/chippybrown/grok-voice-reader-extension/releases/latest)

On Windows, run [Grok-Voice-Reader-Setup.exe](https://github.com/chippybrown/grok-voice-reader-extension/releases/latest/download/Grok-Voice-Reader-Setup.exe). It copies the add-on to `%LOCALAPPDATA%\Grok Voice Reader\extension`.

On Linux, run [Grok-Voice-Reader-x86_64.AppImage](https://github.com/chippybrown/grok-voice-reader-extension/releases/latest/download/Grok-Voice-Reader-x86_64.AppImage). It copies the add-on to `~/.local/share/grok-voice-reader/extension`.

Or download [Grok-Voice-Reader-Extension.zip](https://github.com/chippybrown/grok-voice-reader-extension/releases/latest/download/Grok-Voice-Reader-Extension.zip), unzip it, turn on **Developer mode**, click **Load unpacked**, and pick the folder.

Refresh the Grok tab, then click the page once.

## Playing a reply

Only one reply is outlined. Play mode is green. Pause mode is light orange, including a new reply the outline moves to while paused. A **Play/Pause** button sits in the lower-right corner of that box. While it reads or is paused, more buttons join it there (see below). Hold the pointer on any button to see what it does.

Click a different reply to move the outline there and read that reply from the beginning. That turns Play on. The outline and the button leave every other reply.

Click the outlined reply, the corner button, or press **Alt+Shift+P** to pause or to continue. If you paused in the middle of that same reply, Play continues from that place.

Play stays on until you pause. While paused, a new reply gets the outline and stays quiet until you press Play.

The sentence being read is tinted yellow-green. If you scroll away, the page waits a few seconds before following it.

**Alt+Shift+P** plays or pauses. **Alt+Left** and **Alt+Right** go to the previous or next reply from the keyboard.

## Voice controls

### Corner buttons

While a reply is being read or is paused, the lower-right corner of the outlined reply shows six small buttons. They are faded until you hold the pointer over them.

| Button | What it does |
| --- | --- |
| **\|<<** | Top of this reply. Already at the top, the top of the previous reply. |
| **\|<** | Back one paragraph. Partway into a paragraph, it starts that paragraph over. |
| **\|\|/>** | Pause or Play. |
| **>\|** | Forward one paragraph. |
| **>>\|** | Last paragraph of this reply. Already there, the next reply. |
| **>>>\|** | Live: skip past the newest reply. Nothing older is read. The next new reply is read. |

### On-page bar

A small bar floats on the page with **Back**, **Pause/Play**, **Forward**, **Stop**, and **End**, plus a status light (green watching, blue reading, orange paused, red stopped). Drag it by its dots. The **–** button folds it to a dot. Shift+click **Back** or **Forward** works like **|<<** or **>>|**.

**Stop** goes quiet and stays quiet, even for new replies, until you press Play or click a reply. **End** goes quiet but keeps watching, so the next new reply is read.

### Reading paragraph by paragraph

A blue mark shows the paragraph being read. Reading goes one paragraph at a time and the mark moves along.

Reading keeps going until you press **Stop**. At the end of a reply it moves on to the next one, all the way to the newest. Then it waits and reads each new reply as it arrives. A new reply that arrives while older ones are being read waits its turn. Pause and Play keep your place.

This is meant to be hands-free, for example in a car: press **|<** a few times and listen.

### Keys

| Keys | What they do |
| --- | --- |
| **Alt+Shift+P** | Play or pause |
| **Alt+Left** / **Alt+Right** | Previous or next reply |
| **Alt+Shift+,** / **Alt+Shift+.** | Back or forward one paragraph |
| **Alt+Shift+S** | Stop |
| **Alt+Shift+E** | End |
| **Alt+Shift+L** | Live (same as **>>>\|**) |
| **Alt+Shift+H** | Fold or show the bar |

The Alt+Shift keys other than **Alt+Shift+P** work only while the Grok tab has focus.

### Popup switches

- **Show on-page control bar** shows or hides the bar and the extra corner buttons. The keys keep working.
- **Continue to next reply** (on by default) keeps reading into the next reply. Off, reading stops at the end of each reply.
- **Auto End when switching bots** does an **End** when you open a different bot.
- **Show what it detects** turns on debug outlines and console lines, which help when something does not work.

## Each bot

Click the Grok Voice Reader icon. The popup has a voice and an on or off switch for the bot you have open. **Voice for this bot** picks the voice. **Read this bot aloud** turns reading on or off for that bot.

If the browser has few English voices, the popup offers free Piper voices. A voice downloads once and stays on this computer. It shows up in the same voice list.

## Building a test zip

From `chrome-extension/`, run `packaging/build_dev_zip.sh [out.zip]`. It zips the add-on and adds a `Rev_<version>.txt` file with the version, commit, and build time. Unzip it and use **Load unpacked**.

Privacy policy: [PRIVACY.md](PRIVACY.md).
