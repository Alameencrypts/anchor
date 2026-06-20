# Creatorverse Spot Claimer (Chrome extension)

Watches campaign pages on **app.thecreatorverse.xyz**, automatically clicks the
**Claim** button the instant a spot becomes available, and sends you a
**Telegram** message so you know there's a new task waiting.

> ⚠️ **Use responsibly.** Automating actions may violate Creatorverse's Terms of
> Service. This runs only in *your* logged-in browser, on *your* account, and
> never stores your Creatorverse password. You're responsible for how you use it.

## How it works

- Runs as a content script inside your browser, so it uses your existing
  Creatorverse login session.
- Detects the Claim button two ways:
  1. **Keywords** — any button whose text contains `claim`, `claim spot`, etc.
  2. **Learn mode** — you click the real button once and it records the exact
     selector (most reliable; great when the button text is unusual).
- When it claims, it reads the campaign title / spot # / payout tier off the
  page and sends that to Telegram via the Bot API.
- Optional auto-refresh reloads the page on an interval while you wait for a spot.

## Install (Load unpacked)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the `creatorverse-spot-claimer/` folder.
4. Pin the extension so you can reach the popup easily.

## Set up Telegram notifications

1. In Telegram, open [@BotFather](https://t.me/BotFather) → send `/newbot`,
   follow the prompts, and copy the **bot token**.
2. Open a chat with your new bot and send it any message (this lets the bot
   message you back).
3. Get your **chat ID** — easiest is to message
   [@userinfobot](https://t.me/userinfobot), or open
   `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser after
   step 2 and read the `chat.id` value.
4. Open the extension's **Settings** (popup → ⚙️) and paste the token + chat ID.
5. Click **Send test message** to confirm it works.

## Use it

1. Open the extension popup and toggle **Auto-claim enabled** on.
2. Go to a Creatorverse campaign page.
3. (Recommended once) Click **👆 Learn the Claim button**, then click the real
   Claim button on the page so the extension records exactly which button to press.
4. Leave the tab open. When a spot opens, it claims it and pings your Telegram.

### Settings reference

| Setting | What it does |
| --- | --- |
| Auto-claim enabled | Master on/off switch. |
| Bot token / Chat ID | Telegram credentials for notifications. |
| Claim button keywords | Text used to auto-find the Claim button. |
| Learned button selector | Exact button captured via Learn mode (preferred if set). |
| Auto-refresh every N seconds | Reload the page while waiting (0 = off). |
| Re-claim cooldown | Stops it re-clicking the same spot repeatedly. |

## Waiting for spots to free up

A raid often shows **"All Spots Claimed / No Spots Available"**. Spots open up
when a creator's submission window expires, so to catch one you must let the
extension re-check the page:

- Turn on **Auto-refresh every N seconds** in Settings (≈30–60s is reasonable;
  don't set it very low).
- A status pill in the bottom-left corner shows what it's doing: *watching*,
  *no spots — rechecking*, or *spot found — claiming*.
- The default keyword `claim spot` already matches the live button, so you
  usually don't need Learn mode here (and the button only exists while a spot is
  open, which makes it hard to learn anyway).

## Notes & limits

- The extension can only claim what a normal click would — if Creatorverse
  requires extra confirmation steps, you may need to extend `content.js`.
- Telegram credentials are stored in `chrome.storage.local` on your machine.
- If the Claim button isn't being detected, use **Learn mode**, or add the
  button's text to the keywords list in Settings.
- Per your choice, it does **claim + notify only** — it never auto-submits your
  post URL. You write and submit your QRT/post yourself.

## Files

```
creatorverse-spot-claimer/
├── manifest.json        # MV3 manifest
└── src/
    ├── content.js       # detects + clicks Claim, learn mode, auto-refresh
    ├── background.js    # sends Telegram messages
    ├── popup.html/.js   # quick toggle, learn, test
    └── options.html/.js # settings
```
