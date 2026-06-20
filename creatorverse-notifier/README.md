# Creatorverse Raid Notifier (cloud, 24/7)

A notify-only bot that runs in **GitHub Actions** (no PC needed) every ~5 minutes,
checks Creatorverse for new raids / open spots, and sends you a **Telegram**
message. It never claims anything — you tap in and claim from your phone.

## What you need to provide

1. **Telegram token + chat ID** (same ones from the extension).
2. **The raids API URL** — the request the site makes to load raids.
3. **Auth** (only if the raids API requires you to be logged in).

### How to find the raids API URL

1. On your PC, open **app.thecreatorverse.xyz** and log in.
2. Press `F12` → **Network** tab → click **Fetch/XHR** filter.
3. Go to the page that lists raids (and refresh).
4. Look through the requests for one that returns the raid list — click it and
   check the **Response** tab; the right one contains the raids as JSON.
5. Copy its **Request URL** (the full `https://...` address).
6. In that request's **Headers**, check **Request Headers**:
   - If you see an **`authorization: Bearer ...`** header → copy its full value.
   - If instead it relies on a **`cookie:`** header → copy that value.
   - If there's neither, the API is public and you need no auth.

Send those to me (or fill them in as secrets below) and I'll confirm the parsing.

## Set it up (GitHub Actions)

In your repo on GitHub: **Settings → Secrets and variables → Actions → New repository secret**, add:

| Secret | Value |
| --- | --- |
| `TELEGRAM_TOKEN` | your bot token |
| `TELEGRAM_CHAT_ID` | your chat ID |
| `CREATORVERSE_API_URL` | the raids API URL from above |
| `CREATORVERSE_AUTH` | *(optional)* the `authorization` header value, e.g. `Bearer eyJ...` |
| `CREATORVERSE_COOKIE` | *(optional)* the `cookie` header value, if it uses cookies |
| `RAIDS_PATH` | *(optional)* dot-path to the raids array if auto-detection misses it, e.g. `data.raids` |

Then go to the **Actions** tab → enable workflows if prompted → open
**Creatorverse Raid Notifier** → **Run workflow** to test it once. The first
run just sends a "notifier is live" message and learns the current raids;
after that you only get pinged on *new* spots.

## Notes & honesty

- **Cadence:** GitHub's minimum is 5 minutes and runs can be delayed when their
  servers are busy. So a spot could be claimed by someone else before your ping.
  For faster polling (30–60s) you'd need a small always-on host (Railway / Render
  / Fly.io) — I can set that up if 5 min isn't fast enough.
- **Auth tokens expire.** If alerts stop, your `CREATORVERSE_AUTH`/`COOKIE`
  secret has probably expired — grab a fresh value and update the secret.
- This reads your Creatorverse data via a token you control; it does **not**
  store your password. It's still your account and likely against their ToS to
  automate — your call, your risk.

## Files

```
creatorverse-notifier/
├── poll.js                 # the poller (fetch raids → diff → Telegram)
└── README.md
.github/workflows/creatorverse-notify.yml   # the 5-minute schedule
```
