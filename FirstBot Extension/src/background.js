let shouldWarnAboutUpdate = false;
const currentVersion = '3.1.5a';

function getMessage(url) {
  if (url.includes("photon-sol.tinyastro.io")) {
    if (url.includes("/memescope")) return "photon-memescope";
    if (url.includes("/lp/")) return "photon-token";
    if (url.includes("/discover")) return "photon-discover";
    if (url.includes("/trending")) return "photon-trending";
  } else if (url.includes("bullx.io")) {
    if (url.includes("neo.") || url.includes("neo-backup.")) {
      if (url.includes("/neo-vision") || url.includes("/hyper-vision")) return "bullx-neo-vision";
      if (!url.split("neo.bullx.io/")[1]?.split("?")?.[0] && !url.split("neo-backup.bullx.io/")[1]?.split("?")?.[0])
        return "bullx-neo-vision";
      if (url.includes("/terminal")) return "bullx-neo-token";
      if (url.includes("/explore")) return "bullx-neo-home";
      return 'bullx-neo'
    } else {
      if (url.includes("/pump-vision")) return "bullx-pump-vision";
      if (!url.split("bullx.io/")[1]?.split("?")?.[0]) return "bullx-home";
      if (url.includes("/terminal")) return "bullx-token";
    }
  } else if (url.includes("gmgn.ai")) {
    if (url.includes("/sol/token")) return "gmgn-token";
    const parsedUrl = new URL(url);
    const tab = parsedUrl.searchParams.get("tab");
    if (!tab) return "gmgn-empty-tab";
    if (tab === "home") return "gmgn-meme";
    if (tab === "new_pair") return "gmgn-home";
    if (tab === "new_creation") return "gmgn-home";
    if (tab === "completing") return "gmgn-home";
    if (tab === "soaring") return "gmgn-home";
    if (tab === "complete") return "gmgn-home";
    if (tab === "trending") return "gmgn-home";
    if (tab === "bluechip") return "gmgn-home";
  } else if (url.includes("debot.ai")) {
    if (url.includes("/token/solana/")) return "debot-token";
    const parsedUrl = new URL(url);
    const tab = parsedUrl.searchParams.get("tab");
    if (parsedUrl.pathname === "/meme") return "debot-empty-tab"
    if (!tab) {
      if (parsedUrl.pathname === "/hot" || parsedUrl.pathname === "/new") return "debot-home";
      return "debot-empty-tab";
    }
    if (tab === "pump") return "debot-home";
    if (tab === "new") return "debot-home";
    if (tab === "completed") return "debot-home";
    if (tab === "completing") return "debot-home";
    if (tab === "graduated") return "debot-home";
    if (tab === "new_creation") return "debot-home";
  } else if (url.includes("dexscreener.com")) {
    if (url.includes("/solana/")) return "dexscreener-token";
    return "dexscreener";
  } else if (url.includes("ape.pro")) {
    if (url.includes("/gems")) return "ape-gems";
    if (url.includes("/solana/")) return "ape-token";
    if (!url.split("ape.pro/")[1]?.split("?")?.[0]) return "ape-home";
  } else if (url.includes("solscan.io")) {
    if (url.includes("/token/")) return "solscan-token";
    if (url.includes("/account/")) return "solscan-account";
    return "solscan";
  } else if (url.includes("pump.fun")) {
    if (url.includes("/board")) return "pumpfun-board";
    if (url.includes("/profile")) return "pumpfun-profile";
    if (url.includes("/advanced")) return "pumpfun-advanced";
    if (url.includes("/coin")) return "pumpfun-token"
    return "pumpfun-other";
  } else if (url.includes("x.com")) {
    return "twitter-home"
  } else if (url.includes("ave.ai")) {
    if (url.includes("/token") && url.includes('-solana')) return "ave-token";
    return "ave";
  } else if (url.includes("discord.com")) {
    return "discord";
  } else if (url.includes("web.telegram.org")) {
    return "telegram";
  } else if (url.includes("axiom.trade")) {
    if (url.includes("/discover")) return "axiom-discover";
    if (url.includes("/pulse")) return "axiom-pulse";
    if (url.includes("/meme")) return "axiom-token";
    if (url.includes("/tracker")) return "axiom-tracker";
    return "axiom";
  }
  return;
}

const tabMap = {};

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;
  const tab = await chrome.tabs.get(tabId);
  const tabStatus = tabMap[tabId] || {};
  if (tabStatus.url === tab.url && tabStatus.status === changeInfo.status) return;
  tabMap[tabId] = { url: tab.url, status: changeInfo.status };
  const message = getMessage(tab.url);
  if (message) {
    const auth = checkAuthentication();
    chrome.tabs.sendMessage(tabId, {
      message,
      event: "onUpdated",
      url: tab.url,
      auth,
      shouldWarnAboutUpdate,
    });
    if (shouldWarnAboutUpdate) {
      shouldWarnAboutUpdate = false;
    }
  } else {
    delete tabMap[tabId];
  }
});

chrome.tabs.onActivated.addListener(async (details) => {
  const { tabId } = details;
  const tab = await chrome.tabs.get(tabId);
  const { url } = tab;
  const message = getMessage(url);
  if (message) {
    const auth = checkAuthentication();
    chrome.tabs.sendMessage(tabId, {
      message,
      event: "onActivated",
      url,
      auth,
      shouldWarnAboutUpdate,
    });
    if (shouldWarnAboutUpdate) {
      shouldWarnAboutUpdate = false;
    }
  } else {
    delete tabMap[tabId];
  }
});

chrome.webNavigation.onCompleted.addListener(async (details) => {
  let changeUrl = details.url;
  if (!changeUrl) {
    const tab = await chrome.tabs.get(details.tabId);
    changeUrl = tab.url;
  }
  const tabStatus = tabMap[details.tabId] || {};
  if (!changeUrl.includes('debot.ai/meme') && tabStatus.url === changeUrl && tabStatus.status === 'complete') return delete tabMap[details.tabId];
  tabMap[details.tabId] = { url: changeUrl, status: 'complete' };
  const message = getMessage(changeUrl);
  if (message) {
    const auth = checkAuthentication();
    chrome.tabs.sendMessage(details.tabId, {
      message,
      event: "onCompleted",
      url: changeUrl,
      auth,
      shouldWarnAboutUpdate,
    });
    if (shouldWarnAboutUpdate) {
      shouldWarnAboutUpdate = false;
    }
  } else {
    delete tabMap[details.tabId];
  }
});

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    chrome.tabs.create({
      url: "https://docs.bloombot.app/chrome-extension/activation"
    })
    chrome.tabs.create({
      url: chrome.runtime.getURL("src/public/whats_new.html")
    })
    const apiData = await getNewApiData();
    chrome.storage.local.set({ "bloom.apiData": apiData });
    const latestVersion = apiData.version;
    if (latestVersion !== currentVersion) {
      shouldWarnAboutUpdate = true;
    }
  } else if (details.reason === "update") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("src/public/whats_new.html")
    })
    const apiData = await getNewApiData();
    chrome.storage.local.set({ "bloom.apiData": apiData });
    const latestVersion = apiData.version;
    if (latestVersion !== currentVersion) {
      shouldWarnAboutUpdate = true;
    }
  }
});

chrome.runtime.onMessage.addListener(async function (request, _sender, sendResponse) {
  if (request.message === "logout") {
    chrome.storage.local.remove(
      ["bloom.token", "bloom.expires_at"],
      function () {
        chrome.action.setPopup({ popup: "src/public/landing.html" });
        sendResponse({ success: true });
      },
    );
    return true;
  } else if (request.message === "openTab") {
    chrome.tabs.create({
      url: request.url,
    });
    return true;
  } else if (request.message === "checkAuth") {
    const result = checkAuthentication();
    sendResponse(result);
    return true;
  } else if (request.message === "reset") {
    const platforms = ["apepro", "ave", "bullx-neo", "dexscreener", "gmgn", "photon", "pumpfun", "solscan", "twitter"];
    platforms.forEach(async (platform) => {
      await chrome.storage.local.remove(`bloom.positionBeforeHide.${platform}`);
      await chrome.storage.local.remove(`bloom.scaleFactor.${platform}`);
    });
    const apiData = await getNewApiData();
    chrome.storage.local.set({ "bloom.apiData": apiData });
    const latestVersion = apiData.version;
    if (latestVersion !== currentVersion) {
      shouldWarnAboutUpdate = true;
    }
    chrome.tabs.query({}, function (tabs) {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { message: "reset" });
      });
    });
  } else if (request.message === "reloadApiData") {
    const apiData = await getNewApiData();
    chrome.storage.local.set({ "bloom.apiData": apiData });
    const latestVersion = apiData.version;
    if (latestVersion !== currentVersion) {
      shouldWarnAboutUpdate = true;
    }
    chrome.tabs.query({}, function (tabs) {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { message: "reset" });
      });
    });
  } else if (request.message === "scraperAmount") {
    chrome.tabs.query({}, function (tabs) {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { message: "scraperAmount" });
      });
    });
  }
});

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const locationHeader = details.responseHeaders?.find(
      (header) => header.name.toLowerCase() === 'location'
    );
    const poolId = new URL(details.url).searchParams.get('id');

    if (locationHeader && poolId) {
      chrome.tabs.sendMessage(details.tabId, {
        type: 'LOCATION_CAPTURED',
        location: locationHeader.value,
        poolId,
      });
    }
  },
  {
    urls: ['https://photon-sol.tinyastro.io/*'],
    types: ['xmlhttprequest']
  },
  ['responseHeaders']
);

function checkAuthentication() {
  chrome.storage.local.get(
    ["bloom.token", "bloom.expires_at"],
    function (result) {
      const token = result["bloom.token"];
      const expiresAt = result["bloom.expires_at"];

      if (token && expiresAt) {
        const currentTime = Date.now();
        if (currentTime < expiresAt) {
          chrome.action.setPopup({ popup: "src/public/popup.html" });
          return result;
        } else {
          chrome.storage.local.remove(
            ["bloom.token", "bloom.expires_at"],
            function () {
              chrome.action.setPopup({ popup: "src/public/landing.html" });
            },
          );
          return false;
        }
      } else {
        chrome.action.setPopup({ popup: "src/public/landing.html" });
        return false;
      }
    },
  );
}

async function checkApiData() {
  try {
    const apiData = await getNewApiData();
    chrome.storage.local.set({ "bloom.apiData": apiData });
    const latestVersion = apiData.version;
    if (latestVersion !== currentVersion) {
      shouldWarnAboutUpdate = true;
    }
  } catch (error) {
    console.error(error);
  }

  setInterval(checkApiData, 1001 * 60 * 30);
}

async function getNewApiData() {
  const options = {
    url: "https://www.bloombot.app/api/extension",
    method: "GET",
    headers: {
      "Accept": "application/json",
    }
  }
  const response = await fetch(options.url, options);
  const data = await response.json();
  return data;
}

checkAuthentication();
checkApiData();