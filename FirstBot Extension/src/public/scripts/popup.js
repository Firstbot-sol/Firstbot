document.addEventListener("DOMContentLoaded", () => {
  chrome.runtime.sendMessage({ message: "checkAuth" });

  const quickBuyInput = document.getElementById("quickBuyAmount");
  const logoutBtn = document.getElementById("logoutBtn");
  const resetBtn = document.getElementById("resetBtn");
  const regionSelect = document.getElementById("regionSelect");

  chrome.storage.local.get(["bloom.quickBuyAmount"], function (result) {
    if (result["bloom.quickBuyAmount"]) {
      quickBuyInput.value = result["bloom.quickBuyAmount"];
    }
  });

  quickBuyInput.addEventListener("input", (e) => {
    const amount = parseFloat(e.target.value);
    if (!isNaN(amount) && amount >= 0) {
      chrome.storage.local.set({ "bloom.quickBuyAmount": amount });
      chrome.tabs.query({}, function (tabs) {
        tabs.forEach((tab) => {
          chrome.tabs
            .sendMessage(tab.id, {
              message: "quickBuyAmount",
              amount,
            })
            .catch(() => { });
        });
      });
    }
  });

  logoutBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ message: "logout" }, async () => {
      await chrome.storage.local.remove("bloom.token");
      await chrome.storage.local.remove("bloom.expires_at");
      smoothRedirect("landing.html");
    });
  });

  settingsBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ message: "openTab", url: chrome.runtime.getURL("src/public/bloom_settings.html") });
  });

  resetBtn.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ message: "reset" });
  });

  chrome.storage.local.get("bloom.activeRegion", function (result) {
    const activeRegion = result["bloom.activeRegion"] || "EU1";
    regionSelect.value = activeRegion;
  });

  regionSelect.addEventListener("change", async (event) => {
    await chrome.storage.local.set({
      "bloom.activeRegion": event.target.value,
    });
  });
});

function smoothRedirect(url) {
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "document";
  link.href = url;
  document.head.appendChild(link);

  document.body.style.opacity = "0";
  document.body.style.transition = "opacity 0.2s ease";

  setTimeout(() => {
    window.location.href = url;
  }, 200);
}
