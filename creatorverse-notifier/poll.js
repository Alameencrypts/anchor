// Creatorverse raid notifier — runs on a schedule (GitHub Actions), checks the
// Creatorverse raids API, and sends a Telegram message when a NEW raid appears
// or an existing raid gets open spots. Notify-only: it never claims anything.
"use strict";

const fs = require("fs");
const path = require("path");

const {
  TELEGRAM_TOKEN,
  TELEGRAM_CHAT_ID,
  CREATORVERSE_API_URL,
  CREATORVERSE_AUTH, // optional: full value for an Authorization header (e.g. "Bearer eyJ...")
  CREATORVERSE_COOKIE, // optional: Cookie header value if the API uses cookies
  RAIDS_PATH, // optional dot-path to the raids array in the JSON (e.g. "data.raids")
  DEBUG
} = process.env;

const STATE_FILE = path.join(__dirname, "seen.json");

function die(msg) {
  console.error("✗ " + msg);
  process.exit(1);
}

async function sendTelegram(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) die("TELEGRAM_TOKEN / TELEGRAM_CHAT_ID not set");
  const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });
  const data = await resp.json();
  if (!data.ok) console.error("Telegram error:", data.description);
  return data.ok;
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return null; // null == first run
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ---- response parsing (defensive: the exact shape is unknown until tested) --

function getByPath(obj, dotPath) {
  return dotPath.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}

function findRaidsArray(json) {
  if (RAIDS_PATH) {
    const v = getByPath(json, RAIDS_PATH);
    if (Array.isArray(v)) return v;
  }
  if (Array.isArray(json)) return json;
  // Heuristic: first property whose value is an array of objects.
  for (const key of Object.keys(json || {})) {
    const v = json[key];
    if (Array.isArray(v) && v.length && typeof v[0] === "object") return v;
    if (v && typeof v === "object") {
      for (const k2 of Object.keys(v)) {
        if (Array.isArray(v[k2]) && v[k2].length && typeof v[k2][0] === "object") return v[k2];
      }
    }
  }
  return [];
}

function raidId(r) {
  return String(r.id ?? r._id ?? r.raidId ?? r.slug ?? r.uuid ?? JSON.stringify(r).slice(0, 60));
}

function raidTitle(r) {
  return r.title ?? r.name ?? r.campaign ?? r.project ?? "Creatorverse raid";
}

// Best-effort "are there open spots?" detection across likely field names.
function hasOpenSpots(r) {
  const numFields = ["spotsAvailable", "availableSpots", "openSpots", "remainingSpots", "spotsLeft"];
  for (const f of numFields) if (typeof r[f] === "number") return r[f] > 0;

  const boolFields = ["hasSpots", "isOpen", "claimable", "canClaim", "spotsOpen"];
  for (const f of boolFields) if (typeof r[f] === "boolean") return r[f];

  const status = String(r.status ?? r.state ?? "").toLowerCase();
  if (status) {
    if (/(full|claimed|closed|completed|expired)/.test(status)) return false;
    if (/(open|available|active|live)/.test(status)) return true;
  }
  // Unknown shape: assume open so we don't silently miss it.
  return true;
}

function raidUrl(r) {
  return r.url ?? r.link ?? (r.slug ? `https://app.thecreatorverse.xyz/raid/${r.slug}` : "https://app.thecreatorverse.xyz/dashboard");
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---- main ------------------------------------------------------------------

async function main() {
  if (!CREATORVERSE_API_URL) die("CREATORVERSE_API_URL not set (the raids API endpoint)");

  const headers = {
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (raid-notifier)"
  };
  if (CREATORVERSE_AUTH) headers.Authorization = CREATORVERSE_AUTH;
  if (CREATORVERSE_COOKIE) headers.Cookie = CREATORVERSE_COOKIE;

  let json;
  try {
    const resp = await fetch(CREATORVERSE_API_URL, { headers });
    const text = await resp.text();
    if (!resp.ok) die(`API returned HTTP ${resp.status}. Body: ${text.slice(0, 300)}`);
    json = JSON.parse(text);
  } catch (e) {
    die("Failed to fetch/parse raids API: " + e.message);
  }

  const raids = findRaidsArray(json);
  if (DEBUG) {
    console.log("Top-level keys:", Object.keys(json || {}));
    console.log(`Found ${raids.length} raids. First item:`, JSON.stringify(raids[0], null, 2));
  }
  console.log(`Fetched ${raids.length} raids.`);

  const prev = loadState();
  const next = {};
  const newlyOpen = [];

  for (const r of raids) {
    const id = raidId(r);
    const open = hasOpenSpots(r);
    next[id] = { open, title: raidTitle(r), url: raidUrl(r) };

    if (prev == null) continue; // first run: just seed, don't spam
    const before = prev[id];
    const isBrandNew = !before;
    const justOpened = before && !before.open && open;
    if ((isBrandNew && open) || justOpened) newlyOpen.push(next[id]);
  }

  if (prev == null) {
    saveState(next);
    await sendTelegram(
      `🛰️ <b>Creatorverse notifier is live.</b>\nWatching ${raids.length} raids. You'll get a ping when a new spot opens.`
    );
    console.log("First run — state seeded, no alerts sent.");
    return;
  }

  for (const r of newlyOpen) {
    await sendTelegram(
      [
        "🚨 <b>New Creatorverse spot available!</b>",
        "",
        `📌 <b>${esc(r.title)}</b>`,
        `🔗 ${esc(r.url)}`,
        "",
        "👉 Open the app and claim it before it's gone."
      ].join("\n")
    );
  }

  saveState(next);
  console.log(`Sent ${newlyOpen.length} alert(s).`);
}

main().catch((e) => die(e.stack || String(e)));
