// Background service worker: relays claim events to Telegram.
"use strict";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendTelegram(text) {
  const { telegramToken, telegramChatId } = await chrome.storage.local.get({
    telegramToken: "",
    telegramChatId: ""
  });

  if (!telegramToken || !telegramChatId) {
    return { ok: false, error: "Telegram bot token or chat ID not set. Open the extension options." };
  }

  try {
    const resp = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    const data = await resp.json();
    return data.ok ? { ok: true } : { ok: false, error: data.description || "Telegram API error" };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function buildMessage(ctx) {
  const lines = ["🎯 <b>New task — a spot was claimed for you on Creatorverse!</b>", ""];
  if (ctx.title) lines.push(`📌 <b>${escapeHtml(ctx.title)}</b>`);
  if (ctx.spot) lines.push(`🎟️ Spot #${escapeHtml(ctx.spot)}`);
  if (ctx.tier) lines.push(`🏅 Tier: ${escapeHtml(ctx.tier)}`);
  if (ctx.url) lines.push(`🔗 ${escapeHtml(ctx.url)}`);
  lines.push("", "👉 Go submit your post before the window closes.");
  return lines.join("\n");
}

function flashBadge(ok) {
  chrome.action.setBadgeText({ text: ok ? "✓" : "!" });
  chrome.action.setBadgeBackgroundColor({ color: ok ? "#16a34a" : "#dc2626" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 8000);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "claimed") {
    sendTelegram(buildMessage(msg.ctx)).then((r) => {
      flashBadge(r.ok);
      sendResponse(r);
    });
    return true; // async response
  }
  if (msg && msg.type === "testNotify") {
    sendTelegram("✅ Creatorverse Spot Claimer: this is a test message. Notifications work!").then(
      (r) => {
        flashBadge(r.ok);
        sendResponse(r);
      }
    );
    return true;
  }
});
