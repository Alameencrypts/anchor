"use strict";

const $ = (id) => document.getElementById(id);

async function refresh() {
  const cfg = await chrome.storage.local.get({
    enabled: false,
    telegramToken: "",
    telegramChatId: "",
    claimSelector: ""
  });

  $("enabled").checked = cfg.enabled;

  const configured = cfg.telegramToken && cfg.telegramChatId;
  $("status").innerHTML = configured
    ? '<span class="ok">Telegram configured ✓</span>'
    : '<span class="bad">Telegram not set — open Settings</span>';

  $("selector").innerHTML = cfg.claimSelector
    ? `Learned button: <code>${cfg.claimSelector}</code>`
    : "Using keyword detection (no specific button learned).";
}

$("enabled").addEventListener("change", (e) => {
  chrome.storage.local.set({ enabled: e.target.checked });
});

$("learn").addEventListener("click", async () => {
  await chrome.storage.local.set({ learnMode: true });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/app\.(the)?creatorverse\.xyz/.test(tab.url || "")) {
    $("selector").innerHTML = '<span class="bad">Open app.thecreatorverse.xyz first, then try again.</span>';
    await chrome.storage.local.set({ learnMode: false });
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: "startLearn" });
  window.close();
});

$("test").addEventListener("click", () => {
  $("testResult").textContent = "Sending…";
  chrome.runtime.sendMessage({ type: "testNotify" }, (r) => {
    if (chrome.runtime.lastError) {
      $("testResult").innerHTML = '<span class="bad">' + chrome.runtime.lastError.message + "</span>";
      return;
    }
    $("testResult").innerHTML = r && r.ok
      ? '<span class="ok">Sent! Check Telegram.</span>'
      : '<span class="bad">' + ((r && r.error) || "Failed") + "</span>";
  });
});

$("options").addEventListener("click", () => chrome.runtime.openOptionsPage());

chrome.storage.onChanged.addListener(refresh);
refresh();
