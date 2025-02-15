const activeObservers = {};
const platform = "axiom";

const buyButtonClassName = "b" + Math.random().toString(36).substring(2, 10);
const snipeButtonClassName = "n" + Math.random().toString(36).substring(2, 10);
const toastClassName = "t" + Math.random().toString(36).substring(2, 10);
const quickPanelClassName = "qp" + Math.random().toString(36).substring(2, 10);
const buyDivClassName = "bd" + Math.random().toString(36).substring(2, 10);
const sellDivClassName = "sd" + Math.random().toString(36).substring(2, 10);
const headerClassName = "h" + Math.random().toString(36).substring(2, 10);
const trackerButtonClassName = "tr" + Math.random().toString(36).substring(2, 10);

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const signal = controller.signal;

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, { ...options, signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function getBloomToken() {
  const data = await chrome.storage.local.get("bloom.token");
  return data["bloom.token"] || "";
}

// LISTENER

let currentPage, quickBuyAmount, pulseButtonsEnabled;
chrome.runtime.onMessage.addListener(async function (request) {
  if (request.shouldWarnAboutUpdate) {
    showToast("A new version of the Bloom Extension is available! Check out how to install it <a href='https://docs.bloombot.app/extension/setup/download-chrome/.zip-file' target='_blank' style='text-decoration: underline; color: #96FF98;'>here</a>", "top-center");
  }
  const sitePreferences = (await chrome.storage.local.get(`bloom.sitePreferences`))?.[`bloom.sitePreferences`] || {};
  removeBloomQuickPanels();
  if (sitePreferences[platform] === false) return;
  quickBuyAmount = (await chrome.storage.local.get("bloom.quickBuyAmount"))?.[
    "bloom.quickBuyAmount"
  ] || 0.5;
  if (request.event !== "onActivated") {
    if (activeObservers["search"]) {
      activeObservers["search"].forEach((observer) => observer.disconnect());
    }
  }
  if (activeObservers["wallet-tracker"]) {
    activeObservers["wallet-tracker"].forEach((observer) => observer.disconnect());
  }
  if (activeObservers["search"]) {
    activeObservers["search"].forEach((observer) => observer.disconnect());
  }
  listenForWalletTracker();
  listenForSearchContainer();
  if (request.message === "axiom-pulse") {
    pulseButtonsEnabled = (await chrome.storage.local.get("bloom.pulseButtons"))?.["bloom.pulseButtons"] ?? true;
    const token = await getBloomToken();
    if (!token && request.event === "onCompleted") {
      showToast(
        "Log in to the Bloom extension to enhance your experience!",
        "top-center"
      );
    }
    const observers = activeObservers["pulse"] || [];
    observers.forEach((observer) => observer.disconnect());
    currentPage = request.message;
    handlePulse();
  } else if (request.message === "axiom-token") {
    addBloomQuickPanel();
  } else if (request.message === "axiom-discover") {
    const token = await getBloomToken();
    if (!token && request.event === "onCompleted") {
      showToast(
        "Log in to the Bloom extension to enhance your experience!",
        "top-center"
      );
    }
    const observers = activeObservers["discover-trending"] || [];
    observers.forEach((observer) => observer.disconnect());
    currentPage = request.message;
    handleDiscoverTrending();
  } else if (request.message === "axiom-tracker") {
    if (activeObservers["main-tracker"]) {
      activeObservers["main-tracker"].forEach((observer) => observer.disconnect());
    }
    currentPage = request.message;
    listenForMainTracker();
  } else if (request.message === "quickBuyAmount") {
    quickBuyAmount =
      (await chrome.storage.local.get("bloom.quickBuyAmount"))?.[
      "bloom.quickBuyAmount"
      ] || 0.5;
    if (
      currentPage === "axiom-discover"
    ) {
      const container = await findDiscoverContainer();
      const cards = Array.from(container.querySelectorAll("div.w-full.flex-row.whitespace-nowrap"));
      cards.forEach((card) =>
        addDiscoverTrendingBuyButton(card, true)
      );
    } else if (currentPage === "axiom-pulse") {
      const cards = Array.from(document.querySelectorAll("div[style*='position: absolute'][style*='width: 100%']"));
      cards.forEach((card) => {
        if (pulseButtonsEnabled) {
          addPulseButtons(card, true);
        }
      });
    }
  } else if (request.message === "reset" && currentPage === "axiom-token") {
    addBloomQuickPanel();
  }
});

// UTILS

function insertAfter(referenceNode, newNode) {
  referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function insertBefore(referenceNode, newNode) {
  referenceNode.parentNode.insertBefore(newNode, referenceNode);
}

// ORDERS

async function interactWithBloom(selectedRegion, address, type, authToken, amount, side, additionalPayload) {
  try {
    if (!selectedRegion) {
      selectedRegion = (await chrome.storage.local.get("bloom.activeRegion"))?.["bloom.activeRegion"] || "EU1";
    }
    const payload = (type === 'snipe' || type === "pnl")
      ? {
        addr: address,
        auth: authToken,
      }
      : {
        addr: address,
        isPool: true,
        amt: amount === "ini" ? amount : parseFloat(amount).toString(),
        auth: authToken,
        side,
      }
    if (additionalPayload && type === "swap") {
      payload.fee = (side === 'buy' ? additionalPayload.values['buy-fee'] : additionalPayload.values['sell-fee']).toString();
      payload.tip = (side === 'buy' ? additionalPayload.values['buy-tip'] : additionalPayload.values['sell-tip']).toString();
      payload.slippage = (side === 'buy' ? additionalPayload.values['buy-slippage'] : additionalPayload.values['sell-slippage']).toString();
      if (side === 'buy') {
        if (typeof additionalPayload.values['buy-anti-mev'] === 'undefined') {
          payload.antimev = additionalPayload.values['anti-mev'];
        } else {
          payload.antimev = additionalPayload.values['buy-anti-mev'];
        }
      } else {
        if (typeof additionalPayload.values['sell-anti-mev'] === 'undefined') {
          payload.antimev = additionalPayload.values['anti-mev'];
        } else {
          payload.antimev = additionalPayload.values['sell-anti-mev'];
        }
      }
      payload.autotip = additionalPayload.values['auto-tip'];
    } else if (additionalPayload && type === "limit") {
      payload.bundletip = additionalPayload.values['limit-tip'].toString();
      payload.slippage = additionalPayload.values['limit-slippage'].toString();
      payload.targettype = additionalPayload.values['target-type'];
      payload.targetvalue = additionalPayload.values['target-value'].toString();
      payload.expiry = additionalPayload.values['expiry'].toString();
    }

    if (type === 'swap' && side === 'buy') {
      const devSellSettings = (await chrome.storage.local.get("bloom.devSellSettings"))?.["bloom.devSellSettings"] || {};
      if (devSellSettings.enabled) {
        payload.devsell = {
          slippage: devSellSettings.slippage.toString(),
          tip: devSellSettings.bundleTip.toString(),
          amt: devSellSettings.amount.toString(),
        }
      }
    }

    const res = await fetchWithTimeout(
      `https://extension.bloombot.app/${type}?region=${selectedRegion}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();
    return data;
  } catch (error) {
    if (error.toString().includes("signal is aborted")) {
      return { status: "timeout" };
    }
    console.error("Failed to create order:", error);
    return null;
  }
}

// TOAST

function showToast(message, position = "bottom-right") {
  const previousToasts = document.querySelectorAll(`.${toastClassName}`);
  previousToasts.forEach((toast) => toast.remove());

  const toast = document.createElement("div");
  toast.style.position = "fixed";
  if (position === "bottom-right") {
    toast.style.bottom = "20px";
    toast.style.right = "20px";
  } else if (position === "top-center") {
    toast.style.top = "20px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
  }

  toast.style.backgroundColor = "rgba(255, 255, 255, 0)";
  toast.style.backdropFilter = "blur(6px)";

  toast.style.color = "#96FF98";
  toast.style.padding = "12px 24px";
  toast.style.borderRadius = "5px";
  toast.style.zIndex = 10000;
  toast.style.fontSize = "14px";
  toast.style.fontWeight = "600";
  toast.style.border = "1px solid #96FF98";
  toast.innerHTML = message;
  toast.classList.add(toastClassName);

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity 0.5s ease-out";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 500);
  }, position === "top-center" ? 10000 : 3000);
}

// FINDERS

async function findPulseContainer(timeout = 5000) {
  for (let i = 0; i < timeout / 500; i++) {
    const container = document.body.querySelector('.flex-1.border-primaryStroke.bg-backgroundSecondary')
    if (container) return container;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function findDiscoverContainer(timeout = 5000) {
  for (let i = 0; i < timeout / 500; i++) {
    const container = document.body.querySelector('.flex-1.min-h-\\[0px\\]')
    if (container) return container;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function findTopBar(timeout = 5000) {
  for (let i = 0; i < timeout / 500; i++) {
    const topBar = document.querySelector(".p-show__bar__row");
    if (topBar) {
      const lastDiv = topBar.querySelector(".l-col-md-auto:last-of-type");
      if (lastDiv) return lastDiv;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function findBuySellContainer(timeout = 5000) {
  for (let i = 0; i < timeout / 500; i++) {
    const container = document.querySelector("div.js-show__trade-tabs");
    if (container) return container;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function findWalletTracker() {
  for (let i = 0; i < 5000 / 500; i++) {
    const walletTracker = document.querySelector("div#wallet-tracker");
    if (walletTracker) return walletTracker;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function findMainTracker(timeout = 5000) {
  for (let i = 0; i < timeout / 500; i++) {
    const trackerDivs = document.querySelectorAll("div.bg-elevation1")
    const walletTracker = Array.from(trackerDivs).find((div) => !div.innerHTML.includes("Twitter Alerts"))
    if (walletTracker) return walletTracker;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

// HANDLERS

async function handleDiscoverTrending() {
  const container = await findDiscoverContainer();
  if (!container) return;
  quickBuyAmount =
    (await chrome.storage.local.get("bloom.quickBuyAmount"))?.[
    "bloom.quickBuyAmount"
    ] || 0.5;

  const cards = Array.from(container.querySelectorAll("div.w-full.flex-row.whitespace-nowrap"));
  cards.forEach((card) => addDiscoverTrendingBuyButton(card));

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === "DIV") {
          if (node.classList.contains("w-full") && node.classList.contains("flex-row") && node.classList.contains("whitespace-nowrap")) {
            addDiscoverTrendingBuyButton(node);
          } else {
            const cards = Array.from(node.querySelectorAll("div.w-full.flex-row.whitespace-nowrap"));
            cards.forEach((card) => addDiscoverTrendingBuyButton(card));
          }
        }
      });
    });
  });

  observer.observe(container, { childList: true, subtree: true });
  activeObservers["discover-trending"]
    ? activeObservers["discover-trending"].push(observer)
    : (activeObservers["discover-trending"] = [observer]);
}

async function handlePulse() {
  const container = await findPulseContainer();
  if (!container) return;
  quickBuyAmount =
    (await chrome.storage.local.get("bloom.quickBuyAmount"))?.[
    "bloom.quickBuyAmount"
    ] || 0.5;

  const cards = Array.from(container.querySelectorAll("div[style*='position: absolute'][style*='width: 100%']"));
  cards.forEach((card) => {
    if (pulseButtonsEnabled) {
      addPulseButtons(card);
    }
  });

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === "DIV" && !Array.from(node.classList).length) {
          if (pulseButtonsEnabled) {
            addPulseButtons(node);
          }
        } else if (node.nodeName === "DIV" && node.classList.contains("hidden") && node.innerHTML.includes('ri-crosshair-2-fill')) {
          const card = node.closest('div[style*="position: absolute"][style*="width: 100%"]')
          if (card && pulseButtonsEnabled) {
            addPulseButtons(card);
          }
        }
      });
    });
  });

  observer.observe(container, { childList: true, subtree: true });
  activeObservers["pulse"]
    ? activeObservers["pulse"].push(observer)
    : (activeObservers["pulse"] = [observer]);
}

async function listenForWalletTracker() {
  let trackerObserver = null;
  const walletTracker = await findWalletTracker();
  if (walletTracker) trackerObserver = handleWalletTracker(walletTracker);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === "DIV" && node.id === "wallet-tracker") {
          try {
            trackerObserver.disconnect();
          } catch (e) { }
          trackerObserver = handleWalletTracker(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  activeObservers["wallet-tracker"]
    ? activeObservers["wallet-tracker"].push(observer)
    : (activeObservers["wallet-tracker"] = [observer]);
}

async function listenForMainTracker() {
  let trackerObserver = null;
  const mainTracker = await findMainTracker();
  if (mainTracker) trackerObserver = handleWalletTracker(mainTracker);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === "DIV" && node.classList.contains("bg-elevation1") && !node.innerHTML.includes("Twitter Alerts")) {
          try {
            trackerObserver.disconnect();
          } catch (e) { }
          trackerObserver = handleWalletTracker(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  activeObservers["main-tracker"]
    ? activeObservers["main-tracker"].push(observer)
    : (activeObservers["main-tracker"] = [observer]);
}

async function listenForSearchContainer() {
  let searchObserver = null;
  const searchContainer = document.querySelector('.w-full.pointer-events-none:not(.absolute)');
  if (searchContainer) searchObserver = handleSearchContainer(searchContainer);

  const isSearchContainer = (node) => node.nodeName === "DIV" && node.classList.contains("w-full") && node.classList.contains("pointer-events-none") && !node.classList.contains("absolute");

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (isSearchContainer(node)) {
          try {
            searchObserver.disconnect();
          } catch (e) { }
          searchObserver = handleSearchContainer(node);
        } else if (node.firstChild && isSearchContainer(node.firstChild)) {
          try {
            searchObserver.disconnect();
          } catch (e) { }
          searchObserver = handleSearchContainer(node.firstChild);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  activeObservers["search"]
    ? activeObservers["search"].push(observer)
    : (activeObservers["search"] = [observer]);
}

async function handleWalletTracker(walletTracker) {
  const observer = new MutationObserver((mutations) => {
    const removeMutations = mutations.filter((mutation) => mutation.removedNodes.length > 0)
    removeMutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => {
        if (node.nodeName && node.nodeName.toLowerCase() === "button" && node.classList.contains(buyButtonClassName) && node.id !== "decoy-button") {
          const row = mutation.target.closest('div.flex.group')
          if (row) {
            addWalletTrackerBuyButton(row, true)
          }
        }
      });
    });
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName && node.nodeName.toLowerCase() === "div") {
          if (node.classList.length === 0 || node.offsetParent?.id === "split-container") {
            Array.from(node.children).forEach((child) => addWalletTrackerBuyButton(child));
          } else {
            addWalletTrackerBuyButton(node);
          }
        } else if (node.nodeName === "BUTTON" && node.id === "decoy-button") {
          node.remove()
        }
      });
    });
  });

  observer.observe(walletTracker, { childList: true, subtree: true });
  activeObservers["wallet-tracker"]
    ? activeObservers["wallet-tracker"].push(observer)
    : (activeObservers["wallet-tracker"] = [observer]);

  const existingRows = walletTracker.querySelectorAll("div.flex-row.group")
  existingRows.forEach((row) => addWalletTrackerBuyButton(row));

  return observer;
}

async function handleSearchContainer(searchContainer) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === "A") {
          addSearchBuyButton(node);
        }
      });
    });
  });

  observer.observe(searchContainer, { childList: true, subtree: true });
  activeObservers["search"]
    ? activeObservers["search"].push(observer)
    : (activeObservers["search"] = [observer]);
}

// INJECTORS

function addWalletTrackerBuyButton(row, skipCheck = false) {
  const existingBuyButton = row.querySelector(`.${buyButtonClassName}`);
  if (existingBuyButton && !skipCheck) return;

  const actionArea = row.querySelector("button.bg-primaryBlue");
  if (!actionArea) return;

  const bloomButton = document.createElement("button");
  bloomButton.innerHTML = `🚀 ${quickBuyAmount}`;
  bloomButton.classList.add(buyButtonClassName);
  bloomButton.style.border = "1px solid #96FF98";
  bloomButton.style.marginRight = "6px";
  bloomButton.style.padding = "0px 4px";
  bloomButton.style.borderRadius = "4px";
  bloomButton.style.backgroundColor = "transparent";
  bloomButton.style.cursor = "pointer";
  bloomButton.style.zIndex = 1000;
  bloomButton.style.fontSize = "12px";
  bloomButton.style.visibility = "visible";
  bloomButton.onmouseover = function () {
    bloomButton.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
  };
  bloomButton.onmouseout = function () {
    bloomButton.style.backgroundColor = "transparent";
  };

  bloomButton.onclick = async function (event) {
    event.preventDefault();
    event.stopPropagation();

    const token = await getBloomToken();
    if (!token) {
      return chrome.runtime.sendMessage({
        message: "openTab",
        url: `https://t.me/BloomSolana_bot?start=ref_QT_ca_${poolId}`,
      });
    }

    const poolAnchor = row.querySelector("a[href*='/meme/']");
    if (!poolAnchor) return;
    const poolId = poolAnchor.href.split("meme/")[1].split("?")[0];
    if (!poolId) return;

    const order = await interactWithBloom(null, poolId, "swap", token, quickBuyAmount, "buy");
    if (order?.status === "success") {
      showToast("Order placed successfully!");
    } else {
      showToast("Failed placing order!");
    }
  }

  insertBefore(actionArea, bloomButton);
}

function addPulseButtons(card, reload = false) {
  try {
    const pumpLogo = card.querySelector('img[src="https://axiom.trade/images/pump.svg"]');
    const isMigrating = pumpLogo && pumpLogo.closest('div.bg-primaryBlue')
    const existingBuyButtons = card.querySelectorAll(`.${buyButtonClassName}`);
    const existingSnipeButtons = card.querySelectorAll(`.${snipeButtonClassName}`);

    if (existingBuyButtons.length || existingSnipeButtons.length) {
      if (reload && existingBuyButtons.length) {
        existingBuyButtons.forEach(button => button.remove());
      } else if (reload && existingSnipeButtons.length) {
        existingSnipeButtons.forEach(button => button.remove());
      } else if (isMigrating && existingBuyButtons.length) {
        existingBuyButtons.forEach(button => button.remove());
      } else if (!isMigrating && existingSnipeButtons.length) {
        existingSnipeButtons.forEach(button => button.remove());
      } else {
        [...existingBuyButtons, ...existingSnipeButtons].forEach(button => button.remove());
      }
    }

    const actionAreas = isMigrating ? Array.from(card.querySelectorAll("img[src*='pump-grad.svg']")).map((el) => el.closest('div.relative')) : Array.from(card.querySelectorAll("button i.ri-flashlight-fill")).map(el => el.parentElement);
    if (!actionAreas.length) return;

    if (isMigrating) {
      actionAreas.forEach(actionArea => {
        addPulseSnipingButton(card, actionArea);
      });
    } else {
      actionAreas.forEach(actionArea => {
        addPulseBuyButton(card, actionArea, quickBuyAmount);
      });
    }
  } catch (error) {
    console.error("Failed to add Bloom button:", error);
  }
}

function addPulseSnipingButton(card, actionArea) {
  const buttonText = `🚀 Snipe`;

  const bloomButton = document.createElement("button");
  bloomButton.innerHTML = buttonText;
  bloomButton.type = "button";
  bloomButton.classList.add(snipeButtonClassName);
  bloomButton.style.border = `1px solid #96FF98`;
  bloomButton.style.marginLeft = "6px";
  bloomButton.style.padding = "0px 4px";
  bloomButton.style.borderRadius = "4px";
  bloomButton.style.zIndex = 1000;
  bloomButton.style.backgroundColor = "transparent";
  bloomButton.style.cursor = "pointer";
  bloomButton.onmouseover = function () {
    bloomButton.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
  };
  bloomButton.onmouseout = function () {
    bloomButton.style.backgroundColor = "transparent";
  };

  actionArea.style.display = "flex";
  actionArea.style.marginBottom = "-4px";

  bloomButton.onclick = async function (event) {
    event.preventDefault();
    event.stopPropagation();

    const token = await getBloomToken();
    if (!token) {
      return chrome.runtime.sendMessage({
        message: "openTab",
        url: `https://t.me/BloomSolana_bot?start=ref_QT_sniper_${tokenMint}`,
      });
    }

    const texts = card.querySelectorAll('span.text-nowrap');
    const copyButton = card.querySelector('button.group\\/copy');
    if (!texts.length || !copyButton) return showToast('Token not found!');
    const [addressStartsWith, addressEndsWith] = [copyButton.textContent.split('...')[0], copyButton.textContent.split('...')[1]];

    const currentPulse = localStorage.getItem('axiom.pulse');
    if (!currentPulse) return showToast('Pulse not found!');

    const pulseData = JSON.parse(currentPulse);
    const pulseToken = pulseData?.content?.find(
      (token) =>
        token.tokenAddress.startsWith(addressStartsWith) &&
        token.tokenAddress.endsWith(addressEndsWith) &&
        texts[0].textContent === token.tokenTicker
    );
    if (!pulseToken) return showToast('Token not found!');

    const tokenMint = pulseToken.tokenAddress;

    const order = await interactWithBloom(null, tokenMint, "snipe", token);
    if (order?.status === "success") {
      showToast("Order placed successfully!");
    } else if (order?.status === "timeout") {
      showToast("Error sending order, try switching region!");
    } else {
      showToast("Failed placing order!");
    }
  };

  insertAfter(actionArea.firstChild, bloomButton);
}

function addPulseBuyButton(card, actionArea, quickBuyAmount) {
  const buttonText = `◎ ${quickBuyAmount}`;

  const bloomButton = document.createElement("button");
  bloomButton.innerHTML = buttonText;
  bloomButton.type = "button";
  bloomButton.classList.add(buyButtonClassName);
  bloomButton.style.border = `1px solid #96FF98`;
  bloomButton.style.marginLeft = "6px";
  bloomButton.style.padding = "0px 4px";
  bloomButton.style.borderRadius = "4px";
  bloomButton.style.zIndex = 1000;
  bloomButton.style.backgroundColor = "transparent";
  bloomButton.style.cursor = "pointer";
  bloomButton.onmouseover = function () {
    bloomButton.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
  };
  bloomButton.onmouseout = function () {
    bloomButton.style.backgroundColor = "transparent";
  };
  actionArea.parentElement.style.display = "flex";
  actionArea.parentElement.style.marginBottom = "-4px";

  bloomButton.onclick = async function (event) {
    event.preventDefault();
    event.stopPropagation();

    const token = await getBloomToken();
    if (!token) {
      return chrome.runtime.sendMessage({
        message: "openTab",
        url: `https://t.me/BloomSolana_bot?start=ref_QT_ca_${poolId}`,
      });
    }

    const texts = card.querySelectorAll('span.text-nowrap');
    const copyButton = card.querySelector('button.group\\/copy');
    if (!texts.length || !copyButton) return showToast('Token not found!');
    const [addressStartsWith, addressEndsWith] = [copyButton.textContent.split('...')[0], copyButton.textContent.split('...')[1]];

    const currentPulse = localStorage.getItem('axiom.pulse');
    if (!currentPulse) return showToast('Pulse not found!');

    const pulseData = JSON.parse(currentPulse);
    const pulseToken = pulseData?.content?.find(
      (token) =>
        token.tokenAddress.startsWith(addressStartsWith) &&
        token.tokenAddress.endsWith(addressEndsWith) &&
        texts[0].textContent === token.tokenTicker
    );
    if (!pulseToken) return showToast('Token not found!');

    const poolAddress = pulseToken.pairAddress;

    const order = await interactWithBloom(null, poolAddress, "swap", token, quickBuyAmount, "buy");
    if (order?.status === "success") {
      showToast("Order placed successfully!");
    } else if (order?.status === "timeout") {
      showToast("Error sending order, try switching region!");
    } else {
      showToast("Failed placing order!");
    }
  };

  insertAfter(actionArea, bloomButton);
}

async function addDiscoverTrendingBuyButton(card, reload = false) {
  return;
  try {
    const existingBuyButton = card.querySelector(`.${buyButtonClassName}`);

    if (existingBuyButton && !reload) return;
    else if (existingBuyButton) existingBuyButton.remove();

    const actionArea = card.querySelector("button.bg-primaryBlue");
    if (!actionArea) return;

    const buttonClass = buyButtonClassName;

    const bloomButton = document.createElement("button");

    bloomButton.innerHTML = `◎ ${quickBuyAmount}`;
    bloomButton.type = "button";
    bloomButton.classList.add(buttonClass);
    bloomButton.style.margin = "0 6px";
    bloomButton.style.zIndex = 1000;
    bloomButton.style.border = "1px solid #96FF98";
    bloomButton.style.padding = "0px 4px";
    bloomButton.style.borderRadius = "4px";
    bloomButton.style.backgroundColor = "transparent";
    bloomButton.style.cursor = "pointer";
    bloomButton.onmouseover = function () {
      bloomButton.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
    };
    bloomButton.onmouseout = function () {
      bloomButton.style.backgroundColor = "transparent";
    };

    bloomButton.onclick = async function (event) {
      event.preventDefault();
      event.stopPropagation();

      const token = await getBloomToken();
      if (!token) {
        return chrome.runtime.sendMessage({
          message: "openTab",
          url: `https://t.me/BloomSolana_bot?start=ref_QT_ca_${poolId}`,
        });
      }

      const xSearchLink = card.querySelector('a[href*="x.com/search"]');
      if (!xSearchLink) return showToast('Token not found!');
      const xSearchUrl = new URL(xSearchLink.href);
      const searchQuery = xSearchUrl.searchParams.get("q");
      if (!searchQuery) return showToast('Token not found!');

      const poolId = searchQuery.split(" OR ").find(term => !term.startsWith("($"))?.trim()?.replace(')', '');
      if (!poolId) return showToast('Token not found!');

      const order = await interactWithBloom(null, poolId, "swap", token, quickBuyAmount, "buy");
      if (order?.status === "success") {
        showToast("Order placed successfully!");
      } else if (order?.status === "timeout") {
        showToast("Error sending order, try switching region!");
      } else {
        showToast("Failed placing order!");
      }
    };

    insertBefore(actionArea, bloomButton);
  } catch (error) {
    console.error("Failed to add Bloom button:", error);
  }
}

async function addSearchBuyButton(node) {
  const buttonText = `◎ ${quickBuyAmount}`;
  const bloomButton = document.createElement("button");
  bloomButton.innerHTML = buttonText;
  bloomButton.type = "button";
  bloomButton.classList.add(buyButtonClassName);
  bloomButton.style.marginBottom = "6px";
  bloomButton.style.zIndex = 1000;
  bloomButton.style.border = "1px solid #96FF98";
  bloomButton.style.padding = "0px 4px";
  bloomButton.style.borderRadius = "4px";
  bloomButton.style.backgroundColor = "transparent";
  bloomButton.style.cursor = "pointer";
  bloomButton.onmouseover = function () {
    bloomButton.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
  };
  bloomButton.onmouseout = function () {
    bloomButton.style.backgroundColor = "transparent";
  };

  bloomButton.onclick = async function (event) {
    event.preventDefault();
    event.stopPropagation();

    const token = await getBloomToken();
    if (!token) {
      showToast("Log in to the Bloom extension first!");
      return;
    }

    const poolId = node.href.split("meme/")[1].split("?")[0];
    if (!poolId) return;

    const order = await interactWithBloom(null, poolId, "swap", token, quickBuyAmount, "buy");
    if (order?.status === "success") {
      showToast("Order placed successfully!");
    } else if (order?.status === "timeout") {
      showToast("Error sending order, try switching region!");
    } else {
      showToast("Failed to send order!");
    }
  };

  node.appendChild(bloomButton);
}

let isQuickPanelHidden = false;
let chosenRegion = "EU1";

async function addBloomQuickPanel() {
  try {
    const {
      'bloom.presets': bloomPresets,
      'bloom.activePreset': activeBloomPreset,
      [`bloom.hiddenState.${platform}`]: hiddenState,
      'bloom.activeRegion': activeRegion
    } = await chrome.storage.local.get([
      "bloom.presets",
      "bloom.activePreset",
      `bloom.hiddenState.${platform}`,
      "bloom.activeRegion"
    ]);

    let chosenPreset = null;
    if (Array.isArray(bloomPresets) && bloomPresets.length > 0) {
      if (activeBloomPreset) {
        chosenPreset =
          bloomPresets.find((p) => p.label === activeBloomPreset) ||
          bloomPresets[0];
      } else {
        chosenPreset = bloomPresets[0];
      }
    }

    if (activeRegion) chosenRegion = activeRegion;

    const container = document.createElement("div");
    container.classList.add(quickPanelClassName);
    container.style.pointerEvents = "none";
    container.style.visibility = "hidden";
    styleContainer(container);

    const header = document.createElement("div");
    Object.assign(header.style, {
      cursor: hiddenState ? "default" : "move",
      fontWeight: "500",
      color: "#f0b3f0",
      fontSize: "16px",
      textShadow: "2px 2px 4px rgba(0, 0, 0, 0.3)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "8px",
      paddingBottom: "8px",
      paddingTop: "8px",
      borderBottom: "1px solid #5e5e68",
    });

    const headerLeft = document.createElement("div");
    Object.assign(headerLeft.style, {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flex: "1",
    });

    if (!Array.isArray(bloomPresets) || bloomPresets.length === 0) {
      const headerLeftText = document.createElement("span");
      headerLeftText.textContent = "No Bloom Presets";
      styleLabelText(headerLeftText);
      headerLeft.appendChild(headerLeftText);
    } else {
      let presetSelector = document.createElement("select");
      styleDropdown(presetSelector);

      bloomPresets.forEach((pst) => {
        const option = document.createElement("option");
        option.value = pst.label;
        option.textContent = pst.label;
        presetSelector.appendChild(option);
      });

      if (chosenPreset) {
        presetSelector.value = chosenPreset.label;
      }

      presetSelector.addEventListener("mousedown", (evt) => {
        evt.stopPropagation();
      });
      presetSelector.addEventListener("change", async (e) => {
        const newLabel = e.target.value;
        const newPreset = bloomPresets.find((p) => p.label === newLabel);
        if (!newPreset) return;
        await chrome.storage.local.set({ 'bloom.activePreset': newLabel });
        chosenPreset = newPreset;
        updateBloomModalUI(newPreset, bodyWrapper);
      });

      headerLeft.appendChild(presetSelector);
    }

    const regionSelect = document.createElement("select");
    styleDropdown(regionSelect);

    ["EU1", "EU2", "US1", "SG1"].forEach((region) => {
      const opt = document.createElement("option");
      opt.value = region;
      opt.textContent = region;
      regionSelect.appendChild(opt);
    });
    regionSelect.value = chosenRegion;

    regionSelect.addEventListener("mousedown", (evt) => {
      evt.stopPropagation();
    });

    regionSelect.addEventListener("change", async (e) => {
      chosenRegion = e.target.value;
      await chrome.storage.local.set({ "bloom.activeRegion": chosenRegion });
    });

    headerLeft.appendChild(regionSelect);

    header.appendChild(headerLeft);

    const settingsBtn = document.createElement("button");
    settingsBtn.textContent = "⚙️";
    Object.assign(settingsBtn.style, {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      fontSize: "16px",
      color: "#e5ace5",
      padding: "0 4px",
      lineHeight: "1.15"
    });
    settingsBtn.addEventListener("mousedown", (evt) => {
      evt.stopPropagation();
    });
    settingsBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({
        message: "openTab",
        url: chrome.runtime.getURL("src/public/bloom_settings.html"),
      });
    });
    header.appendChild(settingsBtn);

    const bodyWrapper = document.createElement("div");
    Object.assign(bodyWrapper.style, {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      padding: "0 4px",
    });

    container.appendChild(header);
    container.appendChild(bodyWrapper);

    removeBloomQuickPanels();
    document.body.appendChild(container);

    await updateBloomModalUI(chosenPreset, bodyWrapper);

    await new Promise((resolve) => requestAnimationFrame(resolve));

    const containerHeight = container.offsetHeight;

    if (hiddenState) {
      container.style.transition = 'none';
      const originalTransition = 'bottom 0.3s ease, right 0.3s ease';
      const showMargin = 48;
      const bottomPos = -(containerHeight - showMargin);

      container.style.inset = '';
      container.style.top = 'auto';
      container.style.left = 'auto';
      container.style.bottom = bottomPos + 'px';
      container.style.right = '20px';

      container.style.transition = originalTransition;
      container.style.visibility = "visible";
    } else {
      restoreBloomPanelPosition(container, `bloom.positionBeforeHide.${platform}`);
    }

    addHideUnhideBehavior(container, hiddenState, containerHeight);
    initializePanelResize(container, `bloom.scaleFactor.${platform}`);
    restoreBloomPanelScale(container, `bloom.scaleFactor.${platform}`);

    container.style.pointerEvents = "auto";
  } catch (error) {
    console.error("Failed to add Bloom popup:", error);
  }
}

function addHideUnhideBehavior(container, initialHiddenState, containerHeight) {
  const originalTransition = "bottom 0.3s ease, right 0.3s ease";
  const showMargin = 48;
  const hoverMargin = 72;

  isQuickPanelHidden = Boolean(initialHiddenState);

  container.style.transition = originalTransition;

  const minimizeBtn = document.createElement("button");
  minimizeBtn.textContent = isQuickPanelHidden ? "⛶" : "–";
  Object.assign(minimizeBtn.style, {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "20px",
    color: "#e5ace5",
    marginRight: "4px",
    marginLeft: "8px",
    padding: "0 4px"
  });

  const header = container.firstChild;
  header.appendChild(minimizeBtn);

  if (!isQuickPanelHidden) {
    initializePanelDrag(container, `bloom.positionBeforeHide.${platform}`);
    header.style.cursor = "move";
  } else {
    container.style.transform = "scale(1)";
    header.style.cursor = "default";
  }

  minimizeBtn.addEventListener("mousedown", (evt) => {
    evt.stopPropagation();
  });
  minimizeBtn.addEventListener("click", async (evt) => {
    evt.stopPropagation();
    evt.preventDefault();
    if (!isQuickPanelHidden) {
      hideContainer();
    } else {
      unhideContainer();
    }
  });

  document.addEventListener("keydown", (evt) => {
    if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === "b") {
      evt.preventDefault();
      if (isQuickPanelHidden) {
        unhideContainer();
      } else {
        hideContainer();
      }
    }
  });

  container.addEventListener("mouseenter", () => {
    if (isQuickPanelHidden) {
      const bottomPos = -(containerHeight - hoverMargin);
      container.style.bottom = bottomPos + "px";
    }
  });

  container.addEventListener("mouseleave", () => {
    if (isQuickPanelHidden) {
      const bottomPos = -(containerHeight - showMargin);
      container.style.bottom = bottomPos + "px";
    }
  });

  function hideContainer() {
    isQuickPanelHidden = true;
    chrome.storage.local.set({ [`bloom.hiddenState.${platform}`]: true });

    let { left, top } = container.style;
    if (!left || left === "auto") {
      left = container.getBoundingClientRect().left + "px";
    }
    if (!top || top === "auto") {
      top = container.getBoundingClientRect().top + "px";
    }
    chrome.storage.local.set({
      [`bloom.positionBeforeHide.${platform}`]: { left, top },
    });

    container.style.height = container.offsetHeight + 'px';
    container.style.transition = "opacity 0.2s ease";
    container.style.opacity = "0";

    setTimeout(() => {
      minimizeBtn.textContent = "⛶";
      header.style.cursor = "default";

      container.style.transition = "none";
      container.style.height = '';
      container.style.inset = '';
      container.style.top = "auto";
      container.style.left = "auto";
      container.style.bottom = "auto";
      container.style.right = "20px";
      const bottomPos = -(containerHeight - showMargin);
      container.style.bottom = bottomPos + "px";

      setTimeout(() => {
        container.style.transition = "opacity 0.2s ease";
        container.style.opacity = "1";
        container.style.transform = `scale(1)`;

        setTimeout(() => {
          container.style.transition = originalTransition;
        }, 200);
      }, 0);
    }, 200);
  }

  function unhideContainer() {
    isQuickPanelHidden = false;
    chrome.storage.local.set({ [`bloom.hiddenState.${platform}`]: false });

    container.style.height = container.offsetHeight + 'px';
    container.style.transition = "opacity 0.2s ease";
    container.style.opacity = "0";

    setTimeout(() => {
      minimizeBtn.textContent = "–";
      header.style.cursor = "move";

      container.style.transition = "none";
      container.style.height = '';
      container.style.inset = '';
      container.style.right = "auto";
      container.style.bottom = "auto";
      container.style.top = "";
      container.style.left = "";
      restoreBloomPanelPosition(container, `bloom.positionBeforeHide.${platform}`);

      setTimeout(() => {
        container.style.transition = "opacity 0.2s ease";
        container.style.opacity = "1";

        initializePanelDrag(container, `bloom.positionBeforeHide.${platform}`);
        restoreBloomPanelScale(container, `bloom.scaleFactor.${platform}`);

        setTimeout(() => {
          container.style.transition = originalTransition;
        }, 200);
      }, 0);
    }, 200);
  }
}

async function updateBloomModalUI(preset, bodyWrapper) {
  bodyWrapper.innerHTML = "";

  const buySide = document.createElement("div");
  styleSideDiv(buySide);
  const buyTitle = document.createElement("div");
  buyTitle.textContent = "Quick Buy";
  styleTitle(buyTitle);
  buySide.appendChild(buyTitle);

  const buyButtonContainer = document.createElement("div");
  Object.assign(buyButtonContainer.style, {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "6px",
    width: "100%",
  });

  const buyAmounts = preset?.values?.["buy-amounts"] || [0.5, 1, 2, 5, 10];
  buyAmounts.forEach((amt) => {
    const btn = document.createElement("button");
    styleButton(btn, "buy", true);
    const text = `${amt}`;
    btn.textContent = text;
    btn.addEventListener("click", async () => {
      showButtonClickFeedback(btn, text, "buy", "pending", true);

      const token = await getBloomToken();
      if (!token) {
        showToast("Log in to the Bloom extension first!");
        showButtonClickFeedback(btn, text, "buy", "error", true);
        return;
      }

      const urlParts = window.location.href.split("/meme/");
      let poolId = "";
      if (urlParts.length > 1) {
        poolId = urlParts[1].split("?")[0];
      }
      if (!poolId) {
        showToast("Token not found!");
        showButtonClickFeedback(btn, text, "buy", "error", true);
        return;
      }

      const buyOrder = await interactWithBloom(chosenRegion, poolId, "swap", token, amt, "buy", preset);
      if (buyOrder?.status === "success") {
        showToast("Buy order sent!");
        showButtonClickFeedback(btn, text, "buy", "success", true);
      } else if (buyOrder?.status === "timeout") {
        showToast("Error sending order, try switching region!");
        showButtonClickFeedback(btn, text, "buy", "error", true);
      } else {
        showToast("Failed to send buy order!");
        showButtonClickFeedback(btn, text, "buy", "error", true);
      }
    });
    buyButtonContainer.appendChild(btn);
  });

  const manualBuyWrapper = document.createElement("div");
  Object.assign(manualBuyWrapper.style, {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "6px",
    marginTop: "4px",
  });
  const manualBuyInput = document.createElement("input");
  styleInput(manualBuyInput);
  manualBuyInput.placeholder = "Enter SOL amount";

  const manualBuyBtn = document.createElement("button");
  styleButton(manualBuyBtn, "buy");
  const buyText = "Buy";
  manualBuyBtn.textContent = buyText;
  manualBuyBtn.addEventListener("click", async () => {
    showButtonClickFeedback(manualBuyBtn, buyText, "buy", "pending", true);

    const val = manualBuyInput.value.trim();
    if (!val || isNaN(val) || val <= 0) {
      showToast("Please enter a valid SOL amount!");
      showButtonClickFeedback(manualBuyBtn, buyText, "buy", "error", true);
      return;
    }
    const token = await getBloomToken();
    if (!token) {
      showToast("Log in to the Bloom extension first!");
      showButtonClickFeedback(manualBuyBtn, buyText, "buy", "error", true);
      return;
    }

    const urlParts = window.location.href.split("/meme/");
    let poolId = "";
    if (urlParts.length > 1) {
      poolId = urlParts[1].split("?")[0];
    }
    if (!poolId) {
      showToast("Token not found!");
      showButtonClickFeedback(manualBuyBtn, buyText, "buy", "error", true);
      return;
    }

    const buyOrder = await interactWithBloom(chosenRegion, poolId, "swap", token, val, "buy", preset);
    if (buyOrder?.status === "success") {
      showToast("Buy order sent!");
      showButtonClickFeedback(manualBuyBtn, buyText, "buy", "success", true);
    } else if (buyOrder?.status === "timeout") {
      showToast("Error sending order, try switching region!");
      showButtonClickFeedback(manualBuyBtn, buyText, "buy", "error", true);
    } else {
      showToast("Failed to send buy order!");
      showButtonClickFeedback(manualBuyBtn, buyText, "buy", "error", true);
    }
  });

  manualBuyWrapper.appendChild(manualBuyInput);
  manualBuyWrapper.appendChild(manualBuyBtn);

  buySide.appendChild(buyButtonContainer);
  buySide.appendChild(manualBuyWrapper);

  const sellSide = document.createElement("div");
  styleSideDiv(sellSide);
  const sellTitle = document.createElement("div");
  sellTitle.textContent = "Quick Sell";
  styleTitle(sellTitle);
  sellSide.appendChild(sellTitle);

  const sellButtonContainer = document.createElement("div");
  Object.assign(sellButtonContainer.style, {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "6px",
    width: "100%",
    boxSizing: "border-box"
  });

  const devSellSettings = (await chrome.storage.local.get("bloom.devSellSettings"))?.["bloom.devSellSettings"] || {};

  const sellPercs = preset?.values?.["sell-percents"] || (devSellSettings.btnEnabled ? [20, 50, 100] : [10, 20, 50, 100]);
  sellPercs.forEach((pct) => {
    const btn = document.createElement("button");
    styleButton(btn, "sell", true);
    const text = `${pct}%`;
    btn.textContent = text;
    btn.addEventListener("click", async () => {
      showButtonClickFeedback(btn, text, "sell", "pending", true);

      const token = await getBloomToken();
      if (!token) {
        showToast("Log in to the Bloom extension first!");
        showButtonClickFeedback(btn, text, "sell", "error", true);
        return;
      }

      const urlParts = window.location.href.split("/meme/");
      let poolId = "";
      if (urlParts.length > 1) {
        poolId = urlParts[1].split("?")[0];
      }
      if (!poolId) {
        showToast("Token not found!");
        showButtonClickFeedback(btn, text, "sell", "error", true);
        return;
      }

      const sellOrder = await interactWithBloom(chosenRegion, poolId, "swap", token, pct, "sell", preset);
      if (sellOrder?.status === "success") {
        showToast("Sell order sent!");
        showButtonClickFeedback(btn, text, "sell", "success", true);
      } else if (sellOrder?.status === "timeout") {
        showToast("Error sending order, try switching region!");
        showButtonClickFeedback(btn, text, "sell", "error", true);
      } else {
        showToast("Failed to send sell order!");
        showButtonClickFeedback(btn, text, "sell", "error", true);
      }
    });
    sellButtonContainer.appendChild(btn);
  });

  const manualSellRow = document.createElement("div");
  Object.assign(manualSellRow.style, {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "8px",
    width: "100%",
    boxSizing: "border-box",
    marginTop: "8px"
  });

  const manualSellWrapperPercent = document.createElement("div");
  Object.assign(manualSellWrapperPercent.style, {
    display: "flex",
    alignItems: "center",
    gap: "6px"
  });

  const manualSellInputPercent = document.createElement("input");
  styleInput(manualSellInputPercent);
  manualSellInputPercent.placeholder = "Sell %";

  const manualSellBtnPercent = document.createElement("button");
  styleButton(manualSellBtnPercent, "sell");
  const sellText = "Sell";
  manualSellBtnPercent.textContent = sellText;
  manualSellBtnPercent.addEventListener("click", async () => {
    showButtonClickFeedback(manualSellBtnPercent, sellText, "sell", "pending", true);

    const val = manualSellInputPercent.value.trim();
    if (!val || isNaN(val) || val <= 0 || val > 100) {
      showToast("Please enter a valid percentage (1 - 100)!");
      showButtonClickFeedback(manualSellBtnPercent, sellText, "sell", "error", true);
      return;
    }
    const token = await getBloomToken();
    if (!token) {
      showToast("Log in to the Bloom extension first!");
      showButtonClickFeedback(manualSellBtnPercent, sellText, "sell", "error", true);
      return;
    }

    const urlParts = window.location.href.split("/meme/");
    let poolId = "";
    if (urlParts.length > 1) {
      poolId = urlParts[1].split("?")[0];
    }
    if (!poolId) {
      showToast("Token not found!");
      showButtonClickFeedback(manualSellBtnPercent, sellText, "sell", "error", true);
      return;
    }

    const sellOrder = await interactWithBloom(chosenRegion, poolId, "swap", token, val, "sell", preset);
    if (sellOrder?.status === "success") {
      showToast("Sell order sent!");
      showButtonClickFeedback(manualSellBtnPercent, sellText, "sell", "success", true);
    } else if (sellOrder?.status === "timeout") {
      showToast("Error sending order, try switching region!");
      showButtonClickFeedback(manualSellBtnPercent, sellText, "sell", "error", true);
    } else {
      showToast("Failed to send sell order!");
      showButtonClickFeedback(manualSellBtnPercent, sellText, "sell", "error", true);
    }
  });

  manualSellWrapperPercent.appendChild(manualSellInputPercent);
  manualSellWrapperPercent.appendChild(manualSellBtnPercent);

  const manualSellWrapperSol = document.createElement("div");
  Object.assign(manualSellWrapperSol.style, {
    display: "flex",
    alignItems: "center",
    gap: "6px"
  });

  const manualSellInputSol = document.createElement("input");
  styleInput(manualSellInputSol);
  manualSellInputSol.placeholder = "Sell SOL";

  const manualSellBtnSol = document.createElement("button");
  styleButton(manualSellBtnSol, "sell");
  manualSellBtnSol.textContent = sellText;
  manualSellBtnSol.addEventListener("click", async () => {
    showButtonClickFeedback(manualSellBtnSol, sellText, "sell", "pending", true);

    const val = manualSellInputSol.value.trim();
    if (!val || isNaN(val) || val <= 0) {
      showToast("Please enter a valid SOL amount!");
      showButtonClickFeedback(manualSellBtnSol, sellText, "sell", "error", true);
      return;
    }

    const token = await getBloomToken();
    if (!token) {
      showToast("Log in to the Bloom extension first!");
      showButtonClickFeedback(manualSellBtnSol, sellText, "sell", "error", true);
      return;
    }

    const urlParts = window.location.href.split("/meme/");
    let poolId = "";
    if (urlParts.length > 1) {
      poolId = urlParts[1].split("?")[0];
    }
    if (!poolId) {
      showToast("Token not found!");
      showButtonClickFeedback(manualSellBtnSol, sellText, "sell", "error", true);
      return;
    }

    const sellOrder = await interactWithBloom(chosenRegion, poolId, "swap", token, val, "sellamt", preset);
    if (sellOrder?.status === "success") {
      showToast("Sell order sent!");
      showButtonClickFeedback(manualSellBtnSol, sellText, "sell", "success", true);
    } else if (sellOrder?.status === "timeout") {
      showToast("Error sending order, try switching region!");
      showButtonClickFeedback(manualSellBtnSol, sellText, "sell", "error", true);
    } else {
      showToast("Failed to send sell order!");
      showButtonClickFeedback(manualSellBtnSol, sellText, "sell", "error", true);
    }
  });

  const initialsBtn = document.createElement("button");
  styleButton(initialsBtn, "sell", true);
  const initialsText = "Init";
  initialsBtn.textContent = initialsText;
  initialsBtn.addEventListener("click", async () => {
    showButtonClickFeedback(initialsBtn, initialsText, "sell", "pending", true);

    const token = await getBloomToken();
    if (!token) {
      showToast("Log in to the Bloom extension first!");
      showButtonClickFeedback(initialsBtn, initialsText, "sell", "error", true);
      return;
    }

    const urlParts = window.location.href.split("/meme/");
    let poolId = "";
    if (urlParts.length > 1) {
      poolId = urlParts[1].split("?")[0];
    }
    if (!poolId) {
      showToast("Token not found!");
      showButtonClickFeedback(initialsBtn, initialsText, "sell", "error", true);
      return;
    }

    const sellOrder = await interactWithBloom(chosenRegion, poolId, "swap", token, "ini", "sell", preset);
    if (sellOrder?.status === "success") {
      showToast("Sell order sent!");
      showButtonClickFeedback(initialsBtn, initialsText, "sell", "success", true);
    } else if (sellOrder?.status === "timeout") {
      showToast("Error sending order, try switching region!");
      showButtonClickFeedback(initialsBtn, initialsText, "sell", "error", true);
    } else {
      showToast("Failed to send sell order!");
      showButtonClickFeedback(initialsBtn, initialsText, "sell", "error", true);
    }
  });
  sellButtonContainer.appendChild(initialsBtn);

  if (devSellSettings?.btnEnabled) {
    const devSellBtn = document.createElement("button");
    styleButton(devSellBtn, "sell", true);
    const devSellText = "Dev";
    devSellBtn.textContent = devSellText;
    devSellBtn.addEventListener("click", async () => {
      showButtonClickFeedback(devSellBtn, devSellText, "sell", "pending", true);

      const token = await getBloomToken();
      if (!token) {
        showToast("Log in to the Bloom extension first!");
        showButtonClickFeedback(devSellBtn, devSellText, "sell", "error", true);
        return;
      }

      const tokenMint = document.querySelector('.text-textSecondary.truncate')?.textContent;
      if (!tokenMint) {
        showToast("Failed to get token mint!");
        showButtonClickFeedback(devSellBtn, devSellText, "sell", "error", true);
        return;
      }

      const payload = {
        values: {
          'limit-tip': devSellSettings.bundleTip.toString(),
          'limit-slippage': devSellSettings.slippage.toString(),
          'target-type': 'DevSell',
          'target-value': '0',
          'expiry': 24
        }
      }

      const sellOrder = await interactWithBloom(chosenRegion, tokenMint, "limit", token, devSellSettings.amount, "sell", payload);
      if (sellOrder?.status === "success") {
        showToast("Sell order sent!");
        showButtonClickFeedback(devSellBtn, devSellText, "sell", "success", true);
      } else {
        showToast("Failed to send sell order!");
        showButtonClickFeedback(devSellBtn, devSellText, "sell", "error", true);
      }
    });
    sellButtonContainer.appendChild(devSellBtn);
  }

  manualSellWrapperSol.appendChild(manualSellInputSol);
  manualSellWrapperSol.appendChild(manualSellBtnSol);

  manualSellRow.appendChild(manualSellWrapperPercent);
  manualSellRow.appendChild(manualSellWrapperSol);

  sellSide.appendChild(sellButtonContainer);
  sellSide.appendChild(manualSellRow);

  bodyWrapper.appendChild(buySide);
  bodyWrapper.appendChild(sellSide);

  const utilityContainer = document.createElement("div");
  Object.assign(utilityContainer.style, {
    display: "flex",
    gap: "8px",
    width: "90%",
    marginLeft: "auto",
    marginRight: "auto",
    marginTop: "4px",
  });

  const sniperButton = document.createElement("button");
  styleUtilityButton(sniperButton);
  sniperButton.textContent = "Create Sniper Task";
  sniperButton.addEventListener("click", async () => {
    const token = await getBloomToken();
    if (!token) return showToast("Log in to the Bloom extension first!");

    const tokenMint = document.querySelector('.text-textSecondary.truncate')?.textContent;
    if (!tokenMint) return showToast("Failed to get token mint!");

    const snipeOrder = await interactWithBloom(chosenRegion, tokenMint, "snipe", token);
    if (snipeOrder?.status === "success") {
      showToast("Successfully created sniping task!");
    } else if (snipeOrder?.status === "timeout") {
      showToast("Error sending order, try switching region!");
    } else {
      showToast("Failed to create sniping task!");
    }
  });

  const pnlButton = document.createElement("button");
  styleUtilityButton(pnlButton);
  pnlButton.textContent = "Share P&L";
  pnlButton.addEventListener("click", async () => {
    const token = await getBloomToken();
    if (!token) return showToast("Log in to the Bloom extension first!");

    const tokenMint = document.querySelector('.text-textSecondary.truncate')?.textContent;
    if (!tokenMint) return showToast("Failed to get token mint!");

    const pnl = await interactWithBloom(chosenRegion, tokenMint, "pnl", token);
    if (pnl?.status === "success") {
      showToast("Successfully shared P&L!");
    } else if (pnl?.status === "timeout") {
      showToast("Error sending order, try switching region!");
    } else {
      showToast("Failed to share P&L!");
    }
  });

  utilityContainer.appendChild(sniperButton);
  utilityContainer.appendChild(pnlButton);
  bodyWrapper.appendChild(utilityContainer);
}

function styleContainer(el) {
  Object.assign(el.style, {
    position: "fixed",
    top: "100px",
    left: "100px",
    width: "280px",
    minHeight: "220px",
    display: "flex",
    flexDirection: "column",
    background:
      "#1d2040 url(" +
      chrome.runtime.getURL("src/public/assets/images/bg-dark.png") +
      ")",
    backgroundSize: "cover",
    backgroundPosition: "center",
    borderRadius: "10px",
    padding: "0 8px 8px 8px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
    zIndex: 999,
    fontFamily: "Suisse Intl Medium, sans-serif",
    color: "#ffffff",
    border: "1px solid #5e5e68",
    lineHeight: "normal",
  });
}

function styleSideDiv(el) {
  Object.assign(el.style, {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    width: "100%",
    background: "rgba(0, 0, 0, 0.3)",
    borderRadius: "8px",
    padding: "12px",
    border: "1px solid #5e5e68",
  });
}

function styleTitle(el) {
  Object.assign(el.style, {
    fontSize: "14px",
    color: "#ffffff",
    fontWeight: "bold",
    padding: "2px 0",
    borderRadius: "4px",
    textAlign: "left",
  });
}

function styleLabelText(el) {
  Object.assign(el.style, {
    fontSize: "12px",
    fontWeight: "600",
    color: "#ffffff",
    background: "transparent",
    borderRadius: "4px",
    padding: "2px 6px",
    margin: "0",
    display: "inline-block",
  });
}

function styleDropdown(select) {
  Object.assign(select.style, {
    background: "rgba(0, 0, 0, 0.3)",
    color: "#FFFFFF",
    border: "1px solid #5e5e68",
    borderRadius: "5px",
    padding: "6px 28px 6px 10px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "500",
    outline: "none",
    WebkitAppearance: "none",
    appearance: "none",
    backgroundImage: `url('data:image/svg+xml;utf8,<svg fill="%2396FF98" height="14" viewBox="0 0 24 24" width="14" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>')`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center",
    backgroundSize: "12px",
    transition: "all 0.2s ease",
    minWidth: "80px",
    maxWidth: "160px",
  });

  select.addEventListener("mouseenter", () => {
    select.style.borderColor = "#96FF98";
  });
  select.addEventListener("mouseleave", () => {
    if (document.activeElement !== select) {
      select.style.borderColor = "#5e5e68";
    }
  });
  select.addEventListener("focus", () => {
    select.style.borderColor = "#96FF98";
  });
  select.addEventListener("blur", () => {
    select.style.borderColor = "#5e5e68";
  });
}

function styleButton(btn, side, isAmt) {
  const color =
    side === "buy" ? "#00ffc1" : side === "sell" ? "#f93d3d" : "#96FF98";
  const padding = isAmt ? "4px 6px" : "6px";

  Object.assign(btn.style, {
    border: `1px solid ${color}`,
    background: "transparent",
    color,
    borderRadius: "5px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "12px",
    transition: "all 0.2s ease",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding,
    minWidth: "40px",
    textAlign: "center",
    whiteSpace: "nowrap",
    maxWidth: "80px",
  });

  btn.addEventListener("mouseenter", () => {
    btn.style.background = color;
    btn.style.color = "#1d2040";
    btn.style.transform = "translateY(-1px)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "transparent";
    btn.style.color = color;
    btn.style.transform = "translateY(0)";
  });
}

function styleInput(input) {
  Object.assign(input.style, {
    background: "none",
    border: "1px solid #5e5e68",
    borderRadius: "5px",
    color: "#fff",
    fontSize: "12px",
    outline: "none",
    transition: "all 0.2s",
    padding: "6px",
    margin: "0",
    boxSizing: "border-box",
    width: "100%"
  });

  input.addEventListener("focus", () => {
    input.style.border = "1px solid #96FF98";
  });
  input.addEventListener("blur", () => {
    input.style.border = "1px solid #5e5e68";
  });
}

function styleUtilityButton(btn) {
  Object.assign(btn.style, {
    flex: "1",
    border: "1px solid #96FF98",
    background: "transparent",
    color: "#96FF98",
    borderRadius: "5px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "12px",
    transition: "all 0.2s ease",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px",
    textAlign: "center",
    whiteSpace: "nowrap",
    maxWidth: "120px",
  });

  btn.addEventListener("mouseenter", () => {
    btn.style.opacity = "0.8";
    btn.style.transform = "translateY(-1px)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.opacity = "1";
    btn.style.transform = "translateY(0)";
  });
}

function initializePanelDrag(panelRoot, storageKey) {
  let panelDragOffsetX = 0;
  let panelDragOffsetY = 0;
  let panelDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  let panelDragAnimationId;
  let dragOverlay = null;

  const handleMousedown = (evt) => {
    const headerEl = panelRoot.firstChild;
    if (evt.target === headerEl || headerEl.contains(evt.target)) {
      if (isQuickPanelHidden) return;

      panelDragging = true;
      panelDragOffsetX = evt.clientX - panelRoot.getBoundingClientRect().left;
      panelDragOffsetY = evt.clientY - panelRoot.getBoundingClientRect().top;
      lastMouseX = evt.clientX;
      lastMouseY = evt.clientY;
      panelRoot.style.userSelect = "none";

      createDragOverlay();
      initiatePanelDragAnimation();

      document.addEventListener("mousemove", handleMousemove);
      document.addEventListener("mouseup", handleMouseup);
    }
  };

  const handleMousemove = (evt) => {
    if (!panelDragging) return;
    lastMouseX = evt.clientX;
    lastMouseY = evt.clientY;
  };

  const initiatePanelDragAnimation = () => {
    const updatePosition = () => {
      if (!panelDragging) return;

      const { x: scaleX = 1, y: scaleY = 1 } = JSON.parse(panelRoot.dataset.scaleFactors || '{"x":1,"y":1}');

      let left = lastMouseX - panelDragOffsetX;
      let top = lastMouseY - panelDragOffsetY;

      const scaledWidth = panelRoot.offsetWidth * scaleX;
      const scaledHeight = panelRoot.offsetHeight * scaleY;

      const maxLeft = window.innerWidth - scaledWidth;
      const maxTop = window.innerHeight - scaledHeight;

      left = Math.min(Math.max(left, 0), maxLeft);
      top = Math.min(Math.max(top, 0), maxTop);

      panelRoot.style.left = `${left}px`;
      panelRoot.style.top = `${top}px`;

      panelDragAnimationId = requestAnimationFrame(updatePosition);
    };

    stopPanelDragAnimation();
    panelDragAnimationId = requestAnimationFrame(updatePosition);
  };

  const stopPanelDragAnimation = () => {
    if (panelDragAnimationId) {
      cancelAnimationFrame(panelDragAnimationId);
      panelDragAnimationId = null;
    }
  };

  const handleMouseup = async () => {
    panelDragging = false;
    panelRoot.style.userSelect = "";

    document.removeEventListener("mousemove", handleMousemove);
    document.removeEventListener("mouseup", handleMouseup);

    stopPanelDragAnimation();
    removeDragOverlay();

    let { left, top } = panelRoot.style;
    if (!left || left === "auto") {
      left = panelRoot.getBoundingClientRect().left + "px";
    }
    if (!top || top === "auto") {
      top = panelRoot.getBoundingClientRect().top + "px";
    }

    await chrome.storage.local.set({ [storageKey]: { left, top } });
  };

  function createDragOverlay() {
    dragOverlay = document.createElement("div");
    Object.assign(dragOverlay.style, {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      zIndex: 999999,
      cursor: "move",
      background: "transparent"
    });
    document.body.appendChild(dragOverlay);
  }

  function removeDragOverlay() {
    if (dragOverlay && dragOverlay.parentNode) {
      dragOverlay.parentNode.removeChild(dragOverlay);
      dragOverlay = null;
    }
  }

  panelRoot.bloomDragHandler = handleMousedown;
  panelRoot.addEventListener("mousedown", panelRoot.bloomDragHandler);
}

async function restoreBloomPanelPosition(el, storageKey) {
  const { [storageKey]: savedPos } = await chrome.storage.local.get(storageKey);
  if (savedPos) {
    el.style.left = savedPos.left;
    el.style.top = savedPos.top;
  } else {
    el.style.left = "100px";
    el.style.top = "100px";
  }
  el.style.visibility = "visible";
}

function removeBloomQuickPanels() {
  const previousQuickPanels = document.querySelectorAll(`.${quickPanelClassName}`);
  previousQuickPanels.forEach((panel) => {
    panel.remove();
  });
}

async function initializePanelResize(panelRoot, storageKey) {
  let { [storageKey]: savedScale } = await chrome.storage.local.get(storageKey);
  let initialScale = 1.0;
  if (savedScale && typeof savedScale.x === "number") {
    initialScale = parseFloat(savedScale.x) || 1.0;
  }

  const resizeHandle = document.createElement("div");
  Object.assign(resizeHandle.style, {
    position: "absolute",
    width: "32px",
    height: "32px",
    right: "-8px",
    bottom: "-12px",
    cursor: "nwse-resize",
    zIndex: 10000,
    background: `url("${chrome.runtime.getURL("src/public/assets/images/resize.svg")}") no-repeat center center`,
    backgroundSize: "24px",
    overflow: "hidden",
    boxSizing: "border-box",
    borderRadius: "6px",
  });

  const resizeWrapper = document.createElement("div");
  Object.assign(resizeWrapper.style, {
    position: "absolute",
    width: "16px",
    height: "16px",
    right: "0px",
    bottom: "0px",
    overflow: "hidden",
    zIndex: 10000,
  });
  resizeWrapper.appendChild(resizeHandle);
  panelRoot.appendChild(resizeWrapper);

  let isResizing = false;
  let startRect = null;
  let startScale = 1.0;

  function onMouseDown(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    isResizing = true;

    startRect = panelRoot.getBoundingClientRect();
    const { x } = JSON.parse(panelRoot.dataset.scaleFactors);

    startScale = x;

    createResizeOverlay();
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(evt) {
    if (!isResizing) return;

    const currentX = evt.clientX;
    const currentY = evt.clientY;

    const rawScaleX =
      (currentX - startRect.left) / (startRect.width / startScale);
    const rawScaleY =
      (currentY - startRect.top) / (startRect.height / startScale);

    const newScale = Math.min(rawScaleX, rawScaleY);

    const minScale = 0.7;
    if (newScale < minScale) {
      return;
    }
    const maxScale = 2.0;
    if (newScale > maxScale) {
      return;
    }

    panelRoot.dataset.scaleFactors = JSON.stringify({
      x: newScale,
      y: newScale,
    });
    panelRoot.style.transform = `scale(${newScale}, ${newScale})`;
  }

  async function onMouseUp() {
    isResizing = false;
    removeResizeOverlay();
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);

    const { x, y } = JSON.parse(panelRoot.dataset.scaleFactors);
    await chrome.storage.local.set({ [storageKey]: { x, y } });
  }

  let resizeOverlay = null;
  function createResizeOverlay() {
    resizeOverlay = document.createElement("div");
    Object.assign(resizeOverlay.style, {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      zIndex: 999999,
      cursor: "nwse-resize",
      background: "transparent",
    });
    document.body.appendChild(resizeOverlay);
  }

  function removeResizeOverlay() {
    if (resizeOverlay && resizeOverlay.parentNode) {
      resizeOverlay.parentNode.removeChild(resizeOverlay);
      resizeOverlay = null;
    }
  }

  resizeHandle.addEventListener("mousedown", onMouseDown);
}

async function restoreBloomPanelScale(el, storageKey) {
  const { [storageKey]: savedScale } = await chrome.storage.local.get(storageKey);
  let { x, y } = { x: 1, y: 1 };
  if (savedScale) {
    x = savedScale.x;
    y = savedScale.y;
  }
  el.dataset.scaleFactors = JSON.stringify({ x, y });
  if (!isQuickPanelHidden) {
    el.style.transform = `scale(${x}, ${y})`;
    el.style.transformOrigin = "top left";
  }
}

function showButtonClickFeedback(btn, text, side, status, isAmt = false) {
  let newText;
  switch (status) {
    case "pending":
      newText = "...";
      break;
    case "success":
      newText = "✔";
      break;
    case "error":
      newText = "✘";
      break;
  }
  btn.textContent = newText;

  const highlightColor = (side === "buy") ? "#00ffc1" : "#f93d3d";

  btn.style.backgroundColor = highlightColor;
  btn.style.color = "#1d2040";

  setTimeout(() => {
    btn.textContent = text;
    styleButton(btn, side, isAmt);
  }, 1500);
}
