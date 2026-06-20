// Content script: runs on app.creatorverse.xyz, detects the "Claim" button,
// clicks it the moment it becomes available, then asks the background worker
// to send a Telegram notification.
(() => {
  "use strict";

  const DEFAULTS = {
    enabled: false,
    telegramToken: "",
    telegramChatId: "",
    claimSelector: "",
    claimKeywords: [
      "claim spot",
      "claim slot",
      "claim",
      "take spot",
      "grab spot",
      "join campaign"
    ],
    autoRefreshSeconds: 0,
    cooldownSeconds: 120,
    learnMode: false
  };

  let config = { ...DEFAULTS };
  let refreshTimer = null;
  let scanTimer = null;
  let banner = null;

  const log = (...a) => console.log("%c[CV-Claimer]", "color:#2563eb", ...a);

  function loadConfig() {
    return chrome.storage.local.get(DEFAULTS).then((items) => {
      config = { ...DEFAULTS, ...items };
      return config;
    });
  }

  // ---- element helpers -----------------------------------------------------

  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
  }

  function isEnabled(el) {
    if (el.disabled) return false;
    if (el.getAttribute && el.getAttribute("aria-disabled") === "true") return false;
    const s = getComputedStyle(el);
    if (s.pointerEvents === "none") return false;
    if (el.className && typeof el.className === "string" && /\bdisabled\b/i.test(el.className)) {
      return false;
    }
    return true;
  }

  function textOf(el) {
    return (el.innerText || el.value || el.getAttribute("aria-label") || "")
      .trim()
      .toLowerCase();
  }

  function findClaimButton() {
    // 1) Exact button learned by the user (most reliable).
    if (config.claimSelector) {
      try {
        const el = document.querySelector(config.claimSelector);
        if (el && isVisible(el) && isEnabled(el)) return el;
      } catch (_) {
        /* invalid selector; fall through to keyword matching */
      }
    }
    // 2) Keyword match on visible, enabled clickable elements.
    const candidates = document.querySelectorAll(
      'button, a, [role="button"], input[type="submit"], input[type="button"]'
    );
    const keywords = (config.claimKeywords || []).map((k) => k.toLowerCase());
    for (const el of candidates) {
      const text = textOf(el);
      if (!text) continue;
      if (keywords.some((k) => k && text.includes(k))) {
        if (isVisible(el) && isEnabled(el)) return el;
      }
    }
    return null;
  }

  function gatherContext() {
    const bodyText = document.body ? document.body.innerText : "";
    const spotMatch = bodyText.match(/spot\s*#?\s*(\d+)/i);
    const tierMatch = bodyText.match(/\b(Diamond|Platinum|Gold|Silver|Bronze)\b/);
    const heading = document.querySelector("h1, h2");
    return {
      title: (heading && heading.innerText.trim()) || document.title || "Creatorverse campaign",
      spot: spotMatch ? spotMatch[1] : null,
      tier: tierMatch ? tierMatch[1] : null,
      url: location.href
    };
  }

  // ---- claim flow ----------------------------------------------------------

  async function tryClaim() {
    if (!config.enabled || config.learnMode) return;

    const btn = findClaimButton();
    if (!btn) return;

    const ctx = gatherContext();
    const sig = `${ctx.url}|${ctx.spot || ""}`;
    const now = Date.now();

    const { lastClaim } = await chrome.storage.local.get({ lastClaim: null });
    if (lastClaim && lastClaim.sig === sig && now - lastClaim.time < config.cooldownSeconds * 1000) {
      return; // already claimed this spot recently
    }

    log("Claiming spot:", ctx, btn);
    btn.click();
    await chrome.storage.local.set({ lastClaim: { sig, time: now, ctx } });

    chrome.runtime.sendMessage({ type: "claimed", ctx }, (resp) => {
      if (chrome.runtime.lastError) return;
      if (resp && !resp.ok) log("Telegram notify failed:", resp.error);
    });

    showBanner(`✅ Spot claimed${ctx.spot ? " #" + ctx.spot : ""} — notifying Telegram`, "#16a34a");
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  }

  // ---- auto refresh while waiting ------------------------------------------

  function scheduleRefresh() {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    if (config.enabled && !config.learnMode && config.autoRefreshSeconds > 0) {
      refreshTimer = setTimeout(() => {
        if (!findClaimButton()) location.reload();
      }, config.autoRefreshSeconds * 1000);
    }
  }

  // ---- learn mode ----------------------------------------------------------

  function cssPath(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const testId = el.getAttribute("data-testid");
    if (testId) return `${el.tagName.toLowerCase()}[data-testid="${testId}"]`;

    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 5) {
      if (node.id) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      let sel = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const sibs = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (sibs.length > 1) sel += `:nth-of-type(${sibs.indexOf(node) + 1})`;
      }
      parts.unshift(sel);
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  function enterLearnMode() {
    showBanner("👆 Learn mode: click the Claim button now…", "#2563eb");

    const handler = (e) => {
      let target = e.target;
      // Prefer the nearest clickable ancestor.
      const clickable = target.closest('button, a, [role="button"], input[type="submit"], input[type="button"]');
      if (clickable) target = clickable;

      e.preventDefault();
      e.stopPropagation();

      const selector = cssPath(target);
      chrome.storage.local.set({ claimSelector: selector, learnMode: false }, () => {
        showBanner(`🎯 Learned Claim button: ${selector}`, "#16a34a");
      });
      document.removeEventListener("click", handler, true);
    };

    document.addEventListener("click", handler, true);
  }

  // ---- on-page banner ------------------------------------------------------

  function showBanner(text, color) {
    if (!banner) {
      banner = document.createElement("div");
      Object.assign(banner.style, {
        position: "fixed",
        top: "12px",
        right: "12px",
        zIndex: "2147483647",
        padding: "10px 14px",
        borderRadius: "10px",
        font: "600 13px/1.3 system-ui, sans-serif",
        color: "#fff",
        boxShadow: "0 6px 20px rgba(0,0,0,.25)",
        maxWidth: "320px"
      });
      document.documentElement.appendChild(banner);
    }
    banner.style.background = color || "#2563eb";
    banner.textContent = text;
    banner.style.display = "block";
    clearTimeout(banner._t);
    banner._t = setTimeout(() => {
      if (banner) banner.style.display = "none";
    }, 6000);
  }

  // ---- persistent status pill ----------------------------------------------

  // Matches Creatorverse's "no spots" empty state so we can show a clear
  // "watching / refreshing" status instead of looking idle.
  const EMPTY_RE = /(all spots claimed|no spots available|fully claimed)/i;

  function pageIsEmpty() {
    const t = document.body ? document.body.innerText : "";
    return EMPTY_RE.test(t);
  }

  let pill = null;
  function setPill(text, color) {
    if (!pill) {
      pill = document.createElement("div");
      Object.assign(pill.style, {
        position: "fixed",
        bottom: "12px",
        left: "12px",
        zIndex: "2147483646",
        padding: "7px 11px",
        borderRadius: "999px",
        font: "600 12px/1 system-ui, sans-serif",
        color: "#fff",
        boxShadow: "0 4px 14px rgba(0,0,0,.2)"
      });
      document.documentElement.appendChild(pill);
    }
    pill.style.background = color;
    pill.textContent = text;
    pill.style.display = "block";
  }

  function refreshStatus() {
    if (!config.enabled) {
      if (pill) pill.style.display = "none";
      return;
    }
    if (config.learnMode) {
      setPill("👆 Learn mode: click the Claim button", "#2563eb");
      return;
    }
    if (findClaimButton()) {
      setPill("🎯 Spot found — claiming!", "#16a34a");
      return;
    }
    if (pageIsEmpty()) {
      setPill(
        config.autoRefreshSeconds > 0
          ? `⏳ No spots — rechecking every ${config.autoRefreshSeconds}s`
          : "⏳ No spots — turn on Auto-refresh in Settings",
        "#b45309"
      );
      return;
    }
    setPill("👀 Watching for spots…", "#2563eb");
  }

  // ---- wiring --------------------------------------------------------------

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "startLearn") enterLearnMode();
    if (msg && msg.type === "status") tryClaim();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    let relevant = false;
    for (const key of Object.keys(changes)) {
      if (key in DEFAULTS) {
        config[key] = changes[key].newValue;
        relevant = true;
      }
    }
    if (relevant) {
      scheduleRefresh();
      tryClaim();
      refreshStatus();
    }
  });

  function start() {
    const observer = new MutationObserver(() => {
      tryClaim();
      refreshStatus();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Belt-and-suspenders: also poll, in case the SPA mutates without bubbling.
    scanTimer = setInterval(() => {
      tryClaim();
      refreshStatus();
    }, 1500);

    scheduleRefresh();
    tryClaim();
    refreshStatus();
    log("Active on", location.host, "enabled =", config.enabled);
  }

  loadConfig().then(start);
})();
