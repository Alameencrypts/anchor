"use strict";

const DEFAULTS = {
  enabled: false,
  telegramToken: "",
  telegramChatId: "",
  claimSelector: "",
  claimKeywords: ["claim spot", "claim slot", "claim", "take spot", "grab spot", "join campaign"],
  autoRefreshSeconds: 0,
  cooldownSeconds: 120
};

const $ = (id) => document.getElementById(id);

async function load() {
  const cfg = await chrome.storage.local.get(DEFAULTS);
  $("enabled").checked = cfg.enabled;
  $("telegramToken").value = cfg.telegramToken;
  $("telegramChatId").value = cfg.telegramChatId;
  $("claimKeywords").value = (cfg.claimKeywords || []).join(", ");
  $("claimSelector").value = cfg.claimSelector;
  $("autoRefreshSeconds").value = cfg.autoRefreshSeconds;
  $("cooldownSeconds").value = cfg.cooldownSeconds;
}

async function save() {
  const keywords = $("claimKeywords").value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  await chrome.storage.local.set({
    enabled: $("enabled").checked,
    telegramToken: $("telegramToken").value.trim(),
    telegramChatId: $("telegramChatId").value.trim(),
    claimKeywords: keywords.length ? keywords : DEFAULTS.claimKeywords,
    claimSelector: $("claimSelector").value.trim(),
    autoRefreshSeconds: Math.max(0, parseInt($("autoRefreshSeconds").value, 10) || 0),
    cooldownSeconds: Math.max(0, parseInt($("cooldownSeconds").value, 10) || 0)
  });

  $("saved").textContent = "Saved ✓";
  setTimeout(() => ($("saved").textContent = ""), 2000);
}

$("save").addEventListener("click", save);
$("test").addEventListener("click", async () => {
  await save();
  $("saved").textContent = "Sending…";
  chrome.runtime.sendMessage({ type: "testNotify" }, (r) => {
    $("saved").textContent =
      r && r.ok ? "Sent — check Telegram ✓" : "Failed: " + ((r && r.error) || "unknown");
  });
});

// Keep the learned-selector field live if the user runs learn mode meanwhile.
chrome.storage.onChanged.addListener((changes) => {
  if (changes.claimSelector) $("claimSelector").value = changes.claimSelector.newValue || "";
});

load();
