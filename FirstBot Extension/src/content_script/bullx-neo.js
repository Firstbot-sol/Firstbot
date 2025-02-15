const activeObservers = {};
const activeTimeouts = [];
const platform = "bullx-neo";

const buyButtonClassName = "b" + Math.random().toString(36).substring(2, 10);
const sellButtonClassName = "s" + Math.random().toString(36).substring(2, 10);
const snipeButtonClassName = "n" + Math.random().toString(36).substring(2, 10);
const toastClassName = "t" + Math.random().toString(36).substring(2, 10);
const oneClickButtonClassName = "o" + Math.random().toString(36).substring(2, 10);
const walletManagerButtonClassName = "w" + Math.random().toString(36).substring(2, 10);
const topBarClassName = "tb" + Math.random().toString(36).substring(2, 10);
const quickPanelClassName = "qp" + Math.random().toString(36).substring(2, 10);
const buyDivClassName = "bd" + Math.random().toString(36).substring(2, 10);
const sellDivClassName = "sd" + Math.random().toString(36).substring(2, 10);
const headerClassName = "h" + Math.random().toString(36).substring(2, 10);
const bloomToggleClassName = "bt" + Math.random().toString(36).substring(2, 10);

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

let currentPage, quickBuyAmount, apiData, neoVisionEnabled;
chrome.runtime.onMessage.addListener(async function (request) {
  apiData = (await chrome.storage.local.get("bloom.apiData"))?.[
    "bloom.apiData"
  ] || {};
  if (request.shouldWarnAboutUpdate) {
    showToast("A new version of the Bloom Extension is available! Check out how to install it <a href='https://docs.bloombot.app/extension/setup/download-chrome/.zip-file' target='_blank' style='text-decoration: underline; color: #96FF98;'>here</a>", "top-center");
  }
  const sitePreferences = (await chrome.storage.local.get(`bloom.sitePreferences`))?.[`bloom.sitePreferences`] || {};
  removeBloomQuickPanels();
  activeTimeouts.forEach((timeout) => clearTimeout(timeout));
  if (sitePreferences[platform] === false) return;
  quickBuyAmount =
    (await chrome.storage.local.get("bloom.quickBuyAmount"))?.[
    "bloom.quickBuyAmount"
    ] || 0.5;
  localStorage.setItem('bloom.allowedCallbacks', JSON.stringify(apiData.allowedCallbacks || []));
  neoVisionEnabled = (await chrome.storage.local.get("bloom.neoVisionEnabled"))?.["bloom.neoVisionEnabled"] ?? true;
  if (request.event !== "onActivated") {
    if (activeObservers["search"]) {
      activeObservers["search"].forEach((observer) => observer.disconnect());
    }
    if (apiData.searchEnabled) handleSearch();
  }
  if (request.message === "bullx-neo") {
    const token = await getBloomToken();
    if (!token && request.event === "onCompleted") {
      showToast(
        "Log in to the Bloom extension to enhance your experience!",
        "top-center",
      );
    }

    const observers = activeObservers["other"] || [];
    observers.forEach((observer) => observer.disconnect());
    currentPage = "other";
    if (apiData.walletManagerEnabled) handleWalletManager('other');
  } else if (request.message === "bullx-neo-vision") {
    const token = await getBloomToken();
    if (!token && request.event === "onCompleted") {
      showToast(
        "Log in to the Bloom extension to enhance your experience!",
        "top-center",
      );
    }

    const observers = activeObservers["neo-vision"] || [];
    observers.forEach((observer) => observer.disconnect());
    currentPage = request.message;
    if (apiData.walletManagerEnabled) handleWalletManager('neo-vision');
    if (apiData.type === "container") {
      if (apiData.visionButtonsEnabled) handleNeoVisionWithContainers();
    } else {
      if (apiData.visionButtonsEnabled) handleNeoVisionWithParents();
    }
    if (apiData.bloomToggleEnabled) handleBloomToggle();
    if (request.event !== "onActivated") {
      const timeout = setTimeout(() => {
        if (currentPage !== "bullx-neo-vision") return;
        const bloomButtons = document.querySelectorAll(`.${buyButtonClassName}`);
        if (!bloomButtons.length) {
          showToast("No Bloom buttons?", "top-center", true);
          if (apiData.visionButtonsEnabled) {
            chrome.runtime.sendMessage({
              message: "reloadApiData",
            });
          }
        }
      }, 5000)
      activeTimeouts.push(timeout);
    }
  } else if (request.message === "bullx-neo-token") {
    const token = await getBloomToken();
    if (!token && request.event === "onCompleted") {
      showToast(
        "Log in to the Bloom extension to enhance your experience!",
        "top-center",
      );
    }

    const observers = activeObservers["token"] || [];
    observers.forEach((observer) => observer.disconnect());
    currentPage = request.message;
    if (apiData.walletManagerEnabled) handleWalletManager('token');
    if (apiData.tokenButtonsEnabled) handleToken();
    if (apiData.panelEnabled) addBloomQuickPanel();
    if (apiData.oneClickEnabled) handleOneClick();

    if (request.event !== "onActivated") {
      const timeout = setTimeout(() => {
        if (currentPage !== "bullx-neo-token") return;
        const bloomButtons = document.querySelectorAll(`.${buyButtonClassName}, .${sellButtonClassName}`);
        const quickPanel = document.querySelector(`.${quickPanelClassName}`);
        if (!bloomButtons.length || !quickPanel) {
          showToast("No Bloom buttons?", "top-center", true);
          if ((!bloomButtons.length && apiData.tokenButtonsEnabled) || (!quickPanel && apiData.panelEnabled)) {
            chrome.runtime.sendMessage({
              message: "reloadApiData",
            });
          }
        }
      }, 5000)
      activeTimeouts.push(timeout);
    }
  } else if (request.message === "bullx-neo-home") {
    const token = await getBloomToken();
    if (!token && request.event === "onCompleted") {
      showToast(
        "Log in to the Bloom extension to enhance your experience!",
        "top-center",
      );
    }

    const observers = activeObservers["home"] || [];
    observers.forEach((observer) => observer.disconnect());
    currentPage = request.message;
    const tableContainer = await findTableContainer();
    if (tableContainer) {
      if (apiData.walletManagerEnabled) handleWalletManager('home');
      if (apiData.homeEnabled) handleBullxHome();
    }
  } else if (request.message === "quickBuyAmount") {
    quickBuyAmount =
      (await chrome.storage.local.get("bloom.quickBuyAmount"))?.[
      "bloom.quickBuyAmount"
      ] || 0.5;
    if (currentPage === "bullx-neo-home") {
      if (apiData.walletManagerEnabled) handleWalletManager('home', true);
      if (!apiData.homeEnabled) return;
      const cards = findElements(document, apiData.selectors.poolLinkSelector)
      cards.forEach((card) =>
        addDiscoverTrendingBuyButton(card, quickBuyAmount),
      );
    } else if (currentPage === "bullx-neo-vision") {
      const observers = activeObservers["neo-vision"] || [];
      observers.forEach((observer) => observer.disconnect());
      if (apiData.walletManagerEnabled) handleWalletManager('neo-vision', true);
      if (!apiData.visionButtonsEnabled) return;
      if (apiData.type === "container") {
        const cards = findElements(document, apiData.selectors.visionCardSelector);
        cards.forEach((card) => {
          if (neoVisionEnabled) {
            addNeoVisionButtons(card);
          }
        });
      } else {
        handleNeoVisionWithParents();
      }
    } else if (currentPage === "bullx-neo-token") {
      if (apiData.walletManagerEnabled) handleWalletManager('token', true);
    } else {
      if (apiData.walletManagerEnabled) handleWalletManager('other', true);
    }
  } else if (request.message === "reset") {
    if (currentPage === "bullx-neo-token") {
      if (apiData.panelEnabled) addBloomQuickPanel();
    } else if (currentPage === "bullx-neo-vision") {
      apiData = (await chrome.storage.local.get("bloom.apiData"))?.[
        "bloom.apiData"
      ] || {};
      const observers = activeObservers["neo-vision"] || [];
      observers.forEach((observer) => observer.disconnect());
      if (!apiData.visionButtonsEnabled) return;
      if (apiData.type === "container") {
        handleNeoVisionWithContainers();
      } else {
        handleNeoVisionWithParents();
      }
    }
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
        isPool: false,
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

function showToast(message, position = "bottom-right", learnMore = false) {
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
  toast.style.color = apiData.mainColor;
  toast.style.padding = "12px 24px";
  toast.style.borderRadius = "5px";
  toast.style.zIndex = 10000;
  toast.style.fontSize = "14px";
  toast.style.fontWeight = "600";
  toast.style.border = `1px solid ${apiData.mainColor}`;
  toast.classList.add(toastClassName);

  const messageSpan = document.createElement("span");
  messageSpan.innerHTML = message;
  toast.appendChild(messageSpan);

  if (learnMore) {
    const learnMoreButton = document.createElement("button");
    learnMoreButton.textContent = "Learn more";
    learnMoreButton.style.textDecoration = "underline";
    learnMoreButton.style.border = "none";
    learnMoreButton.style.backgroundColor = "transparent";
    learnMoreButton.style.color = apiData.mainColor;
    learnMoreButton.style.marginLeft = "8px";
    learnMoreButton.style.cursor = "pointer";
    learnMoreButton.style.padding = "0";

    learnMoreButton.addEventListener("click", () => {
      chrome.runtime.sendMessage({
        message: "openTab",
        url: chrome.runtime.getURL("src/public/learn_more.html"),
      });
    });

    toast.appendChild(learnMoreButton);
  }

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity 0.5s ease-out";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 500);
  }, (learnMore || position === "top-center") ? 10000 : 3000);
}

function findElement(target, selector) {
  if (selector.type === "querySelector") {
    return target.querySelector(selector.selector);
  } else {
    return document.evaluate(selector.selector, target, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  }
}

function findElements(target, selector) {
  if (selector.type === "querySelector") {
    return Array.from(target.querySelectorAll(selector.selector));
  } else {
    const snapshot = document.evaluate(selector.selector, target, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const elements = [];
    for (let i = 0; i < snapshot.snapshotLength; i++) {
      elements.push(snapshot.snapshotItem(i));
    }
    return elements;
  }
}

// FINDERS

async function findNeoVisionContainer(timeout = 5000) {
  for (let i = 0; i < timeout / 500; i++) {
    const containers = findElements(document, apiData.selectors.visionContainerSelector);
    if (containers.length > 0) return Array.from(containers).map((c) => c.firstElementChild.nextElementSibling);
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function findTableContainer(timeout = 5000) {
  for (let i = 0; i < timeout / 500; i++) {
    const container = findElement(document, apiData.selectors.tableContainerSelector);
    if (container) return container;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function findTableBody(timeout = 5000) {
  for (let i = 0; i < timeout / 500; i++) {
    const container = findElement(document, apiData.selectors.tableBodySelector);
    if (container) return container;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function findTopBar(timeout = 5000) {
  for (let i = 0; i < timeout / 500; i++) {
    const topBar = findElement(document, apiData.selectors.topBarSelector);
    if (topBar) {
      return topBar;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function findBuySellContainer(timeout = 5000) {
  for (let i = 0; i < timeout / 500; i++) {
    const container = findElement(document, apiData.selectors.buySellContainerSelector);
    if (container) {
      return container;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function findOneClickContainer(timeout = 5000) {
  for (let i = 0; i < timeout / 500; i++) {
    const container = findElement(document, apiData.selectors.oneClickContainerSelector);
    if (container) return container;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function findWalletManagerContainer() {
  const container = findElement(document, apiData.selectors.walletManagerContainerSelector);
  if (container) return container;
  return null;
}

async function findSearchContainer(timeout = 5000) {
  for (let i = 0; i < timeout / 500; i++) {
    const container = findElement(document, apiData.selectors.searchContainerSelector);
    if (container) return container;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

// HANDLERS

async function handleOneClick() {
  const container = await findOneClickContainer();
  if (container) {
    addOneClickButtons(container);
  }

  const observer = new MutationObserver((m) => {
    m.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName?.toLowerCase() === "div" && node.classList.contains(apiData.classNames.oneClickContainer)) {
          addOneClickButtons(node);
        } else if (node.nodeName?.toLowerCase() === "div" && node.childNodes.length > 0) {
          const oneClickContainer = findElement(node, apiData.selectors.oneClickContainerSelector);
          if (oneClickContainer) {
            addOneClickButtons(oneClickContainer);
          }
        }
      });
    });
  });

  activeObservers["token"] ? activeObservers["token"].push(observer) : (activeObservers["token"] = [observer]);
  observer.observe(document.body, { childList: true, subtree: true });
}

async function handleBloomToggle() {
  const existingBloomToggle = document.querySelector(`.${bloomToggleClassName}`);
  if (existingBloomToggle) return;

  const header = findElement(document, apiData.selectors.neoVisionHeaderSelector);
  if (!header) return console.log('No header found');

  const bloomToggle = document.createElement("button");
  bloomToggle.classList.add(bloomToggleClassName);
  bloomToggle.innerHTML = `${neoVisionEnabled ? 'Disable' : 'Enable'} Neo Vision Buttons`;
  bloomToggle.style.border = `1px solid ${apiData.mainColor}`;
  bloomToggle.style.borderRadius = "5px";
  bloomToggle.style.backgroundColor = "transparent";
  bloomToggle.style.color = apiData.mainColor;
  bloomToggle.style.padding = "0 10px";
  bloomToggle.style.height = "32px";
  bloomToggle.style.cursor = "pointer";
  bloomToggle.onclick = () => {
    neoVisionEnabled = !neoVisionEnabled;
    chrome.storage.local.set({ 'bloom.neoVisionEnabled': neoVisionEnabled });
    bloomToggle.innerHTML = `${neoVisionEnabled ? 'Disable' : 'Enable'} Neo Vision Buttons`;
    if (neoVisionEnabled) {
      const cards = findElements(document, apiData.selectors.visionCardSelector);
      cards.forEach((card) => addNeoVisionButtons(card));
    } else {
      const memescopeButtons = document.querySelectorAll(`button.${buyButtonClassName}, button.${snipeButtonClassName}`);
      memescopeButtons.forEach((button) => button.remove());
    }
  }
  header.firstElementChild.appendChild(bloomToggle);
}

async function handleWalletManager(page, reload = false) {
  quickBuyAmount =
    (await chrome.storage.local.get("bloom.quickBuyAmount"))?.[
    "bloom.quickBuyAmount"
    ] || 0.5;
  const container = await findWalletManagerContainer();
  if (container) {
    handleWalletManagerContainer(container, reload, page);
  }

  const observer = new MutationObserver((m) => {
    m.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName?.toLowerCase() === "div" && node.childNodes.length > 0) {
          const walletManagerContainer = findElement(node, apiData.selectors.walletManagerContainerSelector);
          if (walletManagerContainer) {
            handleWalletManagerContainer(walletManagerContainer, reload, page);
          }
        }
      });
    });
  });

  activeObservers[page] ? activeObservers[page].push(observer) : (activeObservers[page] = [observer]);
  observer.observe(document.body, { childList: true, subtree: true });
}

async function handleWalletManagerContainer(container, reload = false, page) {
  const allRows = findElements(container, apiData.selectors.walletManagerRowSelector);
  allRows.forEach((row) => addWalletManagerButton(row, reload));

  const modal = container.closest(apiData.closestSelectors.walletManagerModal);
  if (!modal) return;

  modal.classList.remove('max-w-[600px]');

  const observer = new MutationObserver((m) => {
    m.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.classList?.contains(apiData.classNames.walletManagerRow)) {
          addWalletManagerButton(node, reload);
        } else if (node.childNodes.length > 0) {
          const rows = findElements(node, apiData.selectors.walletManagerRowSelector);
          rows.forEach((row) => addWalletManagerButton(row, reload));
        }
      });
    });
  });

  observer.observe(container, { childList: true, subtree: true });
  activeObservers[page] ? activeObservers[page].push(observer) : (activeObservers[page] = [observer]);
}

async function handleSearch() {
  const observer = new MutationObserver((m) => {
    m.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === "DIV" && node.innerHTML.includes('/terminal') && !node.classList.contains(apiData.classNames.visionRow)) {
          const anchors = findElements(node, apiData.selectors.searchAnchorSelector);
          anchors.forEach((anchor) => {
            addSearchButton(anchor);
          });
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  activeObservers["search"] ? activeObservers["search"].push(observer) : (activeObservers["search"] = [observer]);
}

async function handleNeoVisionWithParents() {
  quickBuyAmount =
    (await chrome.storage.local.get("bloom.quickBuyAmount"))?.[
    "bloom.quickBuyAmount"
    ] || 0.5;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (
          node.innerHTML && node.innerHTML.includes('/terminal')
        ) {
          const anchors = findElements(node, apiData.selectors.anchorSelector);
          if (!anchors.length) return;
          const isCard = anchors.length === 1;
          if (isCard && neoVisionEnabled) {
            addNeoVisionButtons(node);
          } else {
            anchors.forEach((anchor) => {
              let currentElement = anchor;
              for (let i = 0; i < apiData.parentCount; i++) {
                const parent = currentElement.parentElement;
                if (parent.children.length > apiData.childrenCount) {
                  break
                } else {
                  currentElement = parent;
                }
              }
              if (neoVisionEnabled) {
                addNeoVisionButtons(currentElement);
              }
            });
          }
        } else if (node.nodeName && node.nodeName.toLowerCase() === "div") {
          const hasMigration = Array.from(node.childNodes).find(
            (child) =>
              child.nodeName?.toLowerCase() === "button" &&
              child.textContent === apiData.texts.visionMigration,
          );
          if (hasMigration && neoVisionEnabled) {
            let currentElement = node;
            for (let i = 0; i < apiData.parentCount; i++) {
              if (currentElement.innerHTML.includes('/terminal')) {
                break
              } else {
                currentElement = currentElement.parentElement;
              }
            }
            if (currentElement) {
              addNeoVisionButtons(currentElement);
            }
          }
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  const cards = findElements(document, apiData.selectors.anchorSelector).map((card) => {
    let currentElement = card;
    for (let i = 0; i < apiData.parentCount; i++) {
      const parent = currentElement.parentElement;
      if (!parent || !parent.children) {
        return null
      }
      if (parent.children.length > apiData.childrenCount) {
        break
      } else {
        currentElement = parent;
      }
    }
    return currentElement;
  }).filter((card) => card !== null);
  cards.forEach((card) => {
    if (neoVisionEnabled) {
      addNeoVisionButtons(card);
    }
  });

  activeObservers["neo-vision"]
    ? activeObservers["neo-vision"].push(observer)
    : (activeObservers["neo-vision"] = [observer]);
}

async function handleNeoVisionWithContainers(idx) {
  const containers = await findNeoVisionContainer();
  if (idx && containers[idx]) {
    handleNeoVisionContainer(containers[idx], idx);
  } else if (containers && containers.length > 0) {
    containers.forEach((container, idx) =>
      handleNeoVisionContainer(container, idx),
    );
  }
}

async function handleNeoVisionContainer(container, idx) {
  quickBuyAmount =
    (await chrome.storage.local.get("bloom.quickBuyAmount"))?.[
    "bloom.quickBuyAmount"
    ] || 0.5;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (
          node.nodeName && node.nodeName.toLowerCase() === "div" && node.classList.contains(apiData.classNames.visionCard)
        ) {
          if (neoVisionEnabled) {
            addNeoVisionButtons(node);
          }
        } else if (node.nodeName && node.nodeName.toLowerCase() === "div") {
          const hasMigration = Array.from(node.childNodes).find(
            (child) =>
              child.nodeName?.toLowerCase() === "button" &&
              child.textContent === apiData.texts.visionMigration,
          );
          if (hasMigration && neoVisionEnabled) {
            const card = node.closest(apiData.closestSelectors.visionCard);
            if (card) {
              addNeoVisionButtons(card);
            }
          }
        }
      });
    });
  });

  observer.observe(container.firstElementChild, {
    childList: true,
    subtree: true,
  });

  const cards = findElements(document, apiData.selectors.visionCardSelector);
  cards.forEach((card) => {
    if (neoVisionEnabled) {
      addNeoVisionButtons(card);
    }
  });

  activeObservers["neo-vision"]
    ? activeObservers["neo-vision"].push(observer)
    : (activeObservers["neo-vision"] = [observer]);

  const containerParent = container.parentElement;
  if (containerParent) {
    const parentObserver = new MutationObserver(() => {
      observer.disconnect();
      parentObserver.disconnect();
      return handleNeoVisionWithContainers(idx);
    });

    parentObserver.observe(containerParent, { childList: true });
    activeObservers["neo-vision"]
      ? activeObservers["neo-vision"].push(parentObserver)
      : (activeObservers["neo-vision"] = [parentObserver]);
  }
}

function handleNeoButton(neoButton, isSell = false) {
  const observer = new MutationObserver((m) => {
    const newNeoButton = isSell ? addSellButton() : addBuyButton();
    observer.disconnect();
    if (newNeoButton) {
      handleNeoButton(newNeoButton, isSell);
    }
  });

  observer.observe(neoButton, { characterData: true, subtree: true });
  activeObservers["token"]
    ? activeObservers["token"].push(observer)
    : (activeObservers["token"] = [observer]);
  return observer;
}

async function handleToken() {
  try {
    const topBar = await findTopBar();
    const buySellContainer = await findBuySellContainer();
    if (!topBar || !buySellContainer) return;
    let migrationContainer = findElement(document, apiData.selectors.orderMigratingSelector);

    const existingBuyButton = document.querySelector(`.${buyButtonClassName}`);
    const existingSnipeButton = document.querySelector(
      `.${snipeButtonClassName}`,
    );

    if (existingBuyButton) existingBuyButton.remove();
    if (existingSnipeButton) existingSnipeButton.remove();

    if (migrationContainer) {
      addSnipingButton(migrationContainer);
    }

    addTopBarButton(topBar);
    handleOrderForm();

    const observer = new MutationObserver(() => {
      const newMigrationContainer = findElement(document, apiData.selectors.orderMigratingSelector);
      if (Boolean(newMigrationContainer) !== Boolean(migrationContainer)) {
        migrationContainer = newMigrationContainer;
        if (migrationContainer) {
          addSnipingButton(migrationContainer);
        } else {
          const snipeButton = document.querySelector(
            `.${snipeButtonClassName}`,
          );
          if (snipeButton) snipeButton.remove();
        }
      }
    });

    observer.observe(buySellContainer, { childList: true, subtree: true });
    activeObservers["token"]
      ? activeObservers["token"].push(observer)
      : (activeObservers["token"] = [observer]);
  } catch (error) {
    console.error("Failed to add Custom Buy button:", error);
  }
}

function handleBuyDiv() {
  const buyDiv = findElement(document, apiData.selectors.buyDivSelector);
  if (!buyDiv) return;
  let neoBuyButton = addBuyButton();
  let neoButtonObserver = neoBuyButton ? handleNeoButton(neoBuyButton) : null;
  const buyDivObserver = new MutationObserver((m) => {
    m.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (
          node.nodeName.toLowerCase() === "div" &&
          (node?.classList?.contains(apiData.classNames.marketOrder) ||
            node?.classList?.contains(apiData.classNames.activeTab))
        ) {
          if (neoButtonObserver) neoButtonObserver.disconnect();
          neoBuyButton = addBuyButton();
          if (neoBuyButton) {
            neoButtonObserver = handleNeoButton(neoBuyButton);
          }
        }
      });
    });
  });

  buyDivObserver.observe(buyDiv, { childList: true, subtree: true });
  activeObservers["token"]
    ? activeObservers["token"].push(buyDivObserver)
    : (activeObservers["token"] = [buyDivObserver]);
}

function handleSellDiv() {
  const sellDiv = findElement(document, apiData.selectors.sellDivSelector);
  if (!sellDiv) return;
  let neoSellButton = addSellButton();
  let neoSellButtonObserver = neoSellButton
    ? handleNeoButton(neoSellButton, true)
    : null;
  const sellDivObserver = new MutationObserver((m) => {
    m.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (
          node.nodeName.toLowerCase() === "div" &&
          (node?.classList?.contains(apiData.classNames.marketOrder) ||
            node?.classList?.contains(apiData.classNames.activeTab))
        ) {
          if (neoSellButtonObserver) neoSellButtonObserver.disconnect();
          neoSellButton = addSellButton();
          if (neoSellButton) {
            neoSellButtonObserver = handleNeoButton(neoSellButton, true);
          }
        }
      });
    });
  });

  sellDivObserver.observe(sellDiv, { childList: true, subtree: true });
  activeObservers["token"]
    ? activeObservers["token"].push(sellDivObserver)
    : (activeObservers["token"] = [sellDivObserver]);
}

function handleOrderForm() {
  const customTab = findElement(document, apiData.selectors.customTabSelector);
  if (!customTab) return;
  const orderForm = customTab.parentElement;
  if (!orderForm) return;
  let buyObserver = handleBuyDiv();
  let sellObserver = handleSellDiv();
  const orderFormObserver = new MutationObserver((m) => {
    m.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (
          node.nodeName.toLowerCase() === "div" &&
          node?.classList?.contains(apiData.classNames.activeTab) &&
          node?.firstElementChild?.classList?.contains(apiData.classNames.marketBuy)
        ) {
          if (buyObserver) buyObserver.disconnect();
          buyObserver = handleBuyDiv();
        }
        if (
          node.nodeName.toLowerCase() === "div" &&
          node?.classList?.contains(apiData.classNames.activeTab) &&
          node?.firstElementChild?.classList?.contains(apiData.classNames.marketSell)
        ) {
          if (sellObserver) sellObserver.disconnect();
          sellObserver = handleSellDiv();
        }
      });
      mutation.removedNodes.forEach((node) => {
        if (
          node.nodeName.toLowerCase() === "div" &&
          node?.classList?.contains(apiData.classNames.activeTab) &&
          node?.firstElementChild?.classList?.contains(apiData.classNames.marketBuy)
        ) {
          if (buyObserver) buyObserver.disconnect();
          buyObserver = null;
        }
        if (
          node.nodeName.toLowerCase() === "div" &&
          node?.classList?.contains(apiData.classNames.activeTab) &&
          node?.firstElementChild?.classList?.contains(apiData.classNames.marketSell)
        ) {
          if (sellObserver) sellObserver.disconnect();
          sellObserver = null;
        }
      });
    });
  });

  orderFormObserver.observe(orderForm.parentElement, {
    childList: true,
    subtree: true,
  });
  activeObservers["token"]
    ? activeObservers["token"].push(orderFormObserver)
    : (activeObservers["token"] = [orderFormObserver]);
}

async function handleBullxHome() {
  const tableBody = await findTableBody();
  if (tableBody) {
    quickBuyAmount =
      (await chrome.storage.local.get("bloom.quickBuyAmount"))?.[
      "bloom.quickBuyAmount"
      ] || 0.5;
    const cards = Array.from(tableBody.querySelectorAll(apiData.selectors.tableRowSelector.selector));
    cards.forEach((card) => addDiscoverTrendingBuyButton(card, quickBuyAmount));
    const observer = new MutationObserver((m) => {
      const addedRows = Array.from(m)
        .map((m) => Array.from(m.addedNodes))
        .flat()
        .filter((r) => r.classList?.contains(apiData.classNames.tableRow));
      addedRows.forEach((row) =>
        addDiscoverTrendingBuyButton(row, quickBuyAmount),
      );
    });

    observer.observe(tableBody, { childList: true, subtree: true });
    activeObservers["home"]
      ? activeObservers["home"].push(observer)
      : (activeObservers["home"] = [observer]);
  }
}

// INJECTORS

function addSnipingButton(migrationContainer) {
  const migrationText = Array.from(
    migrationContainer.querySelectorAll("p"),
  ).filter((p) => p.textContent.includes(apiData.texts.tokenMigration))?.[0];
  if (!migrationText) return;

  const bloomButton = document.createElement("button");
  bloomButton.innerHTML = "Create Sniper Task";
  bloomButton.type = "button";
  bloomButton.classList.add(snipeButtonClassName);
  for (const className of apiData.buttonClasses) {
    bloomButton.classList.add(className);
  }
  bloomButton.style.marginTop = "6px";
  bloomButton.style.marginBottom = "-24px";
  bloomButton.style.border = `1px solid ${apiData.mainColor}`;

  bloomButton.onclick = async function () {
    const url = new URL(window.location.href);
    const tokenMint = url.searchParams.get("address");
    if (!tokenMint) return showToast("Token not found");

    const token = await getBloomToken();
    if (!token) {
      return chrome.runtime.sendMessage({
        message: "openTab",
        url: `https://t.me/BloomSolana_bot?start=ref_QT_sniper_${tokenMint}`,
      });
    }

    const order = await interactWithBloom(null, tokenMint, "snipe", token);
    if (order?.status === "success") {
      showToast("Order placed successfully!");
    } else if (order?.status === "timeout") {
      showToast("Error sending order, try switching region!");
    } else {
      showToast("Failed placing order!");
    }
  };

  insertBefore(migrationText, bloomButton);
}

function addBuyButton() {
  const neoBuyButton = findElement(document, apiData.selectors.neoBuyButtonSelector);
  if (!neoBuyButton) return;
  if (neoBuyButton.innerHTML.includes("Add Funds")) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(addBuyButton());
      }, 1000);
    });
  };
  const parentDiv = neoBuyButton.parentElement;
  if (!parentDiv) return neoBuyButton;
  const buyDiv = findElement(document, apiData.selectors.buyDivSelector);
  if (!buyDiv) return neoBuyButton;
  let activeTab = findElement(document, apiData.selectors.activeTabSelector);
  const currentBloomButtons = document.querySelectorAll(
    `.${buyButtonClassName}`,
  );

  currentBloomButtons.forEach((button) => button.remove());

  if (!activeTab || activeTab.getAttribute(apiData.tabNameAttribute) === "DCA") {
    return neoBuyButton;
  }

  parentDiv.style.flexDirection = "column";

  const bloomButton = neoBuyButton.cloneNode(true);
  bloomButton.classList.add(buyButtonClassName);
  bloomButton.style.marginTop = "6px";
  bloomButton.style.setProperty("border", `1px solid ${apiData.mainColor}`, "important");
  bloomButton.style.setProperty("background-color", `${apiData.hoverBackgroundColor}`, "important");

  bloomButton.onclick = async function (event) {
    event.preventDefault();
    event.stopPropagation();

    const url = new URL(window.location.href);
    const tokenMint = url.searchParams.get("address");
    if (!tokenMint) return showToast("Token not found");

    const token = await getBloomToken();
    if (!token) {
      return chrome.runtime.sendMessage({
        message: "openTab",
        url: `https://t.me/BloomSolana_bot?start=ref_QT_ca_${tokenMint}`,
      });
    }

    const amtInput = findElement(buyDiv, apiData.selectors.amtInputSelector);
    if (!amtInput) return showToast("Invalid amount!");
    const amount = amtInput.value;
    if (!amount || isNaN(parseFloat(amount)))
      return showToast("Invalid amount!");

    activeTab = findElement(document, apiData.selectors.activeTabSelector);
    if (!activeTab) return;
    const tabName = activeTab.getAttribute(apiData.tabNameAttribute);
    if (tabName === apiData.tabNames.limit) {
      const limitSettings = (await chrome.storage.local.get("bloom.limitSettings"))?.["bloom.limitSettings"] || {};
      if (!Object.keys(limitSettings).length) {
        return showToast("Please set up limit settings first!");
      }

      const token = await getBloomToken();
      if (!token) {
        return chrome.runtime.sendMessage({
          message: "openTab",
          url: `https://t.me/BloomSolana_bot?start=ref_QT_ca_${tokenMint}`,
        });
      }

      const orderTrigger = findElement(buyDiv, apiData.selectors.orderTriggerSelector);
      if (!orderTrigger) return showToast("Failed to get order trigger!");
      const targetValueInput = findElement(orderTrigger, apiData.selectors.targetValueSelector);
      if (!targetValueInput) return showToast("Failed to get target value!");
      const targetValue = targetValueInput.value;
      if (!targetValue || isNaN(parseFloat(targetValue))) return showToast("Invalid target value!");
      const targetTypeDiv = findElement(orderTrigger, apiData.selectors.targetTypeDivSelector);
      if (!targetTypeDiv) return showToast("Failed to get target type!");
      const targetType = findElement(targetTypeDiv, apiData.selectors.targetTypeSelector);
      if (!targetType) return showToast("Failed to get target type!");
      const targetTypeValue = targetType.textContent;
      if (!targetTypeValue) return showToast("Failed to get target type!");
      const orderType = targetTypeValue === apiData.texts.targetTypePrice ? "Price" : targetTypeValue === apiData.texts.targetTypeMcap ? "MarketCap" : null;
      if (!orderType) return showToast("Invalid target type!");

      const expiryHours = 24;

      const additionalPayload = {
        values: {
          'limit-tip': limitSettings.limitBuyTip,
          'limit-slippage': limitSettings.limitBuySlippage,
          'target-type': orderType,
          'target-value': targetValue,
          'expiry': expiryHours,
        }
      }

      const order = await interactWithBloom(null, tokenMint, "limit", token, amount, "buy", additionalPayload);
      if (order?.status === "success") {
        showToast("Order placed successfully!");
      } else {
        showToast("Failed placing order!");
      }
    } else if (tabName === apiData.tabNames.market) {
      const order = await interactWithBloom(null, tokenMint, "swap", token, amount, "buy");
      if (order?.status === "success") {
        showToast("Order placed successfully!");
      } else if (order?.status === "timeout") {
        showToast("Error sending order, try switching region!");
      } else {
        showToast("Failed placing order!");
      }
    } else {
      return showToast("Unsupported tab!");
    }
  };

  insertAfter(neoBuyButton, bloomButton);
  return neoBuyButton;
}

function addSellButton() {
  try {
    const neoSellButton = findElement(document, apiData.selectors.neoSellButtonSelector);
    if (!neoSellButton) return;
    const parentDiv = neoSellButton.parentElement;
    if (!parentDiv) return;
    const sellDiv = findElement(document, apiData.selectors.sellDivSelector);
    if (!sellDiv) return;
    let activeTab = findElement(document, apiData.selectors.activeTabSelector);
    const currentBloomButtons = document.querySelectorAll(
      `.${sellButtonClassName}`,
    );
    currentBloomButtons.forEach((button) => button.remove());

    if (!activeTab || activeTab.getAttribute("data-node-key") === "DCA") {
      return neoSellButton;
    }

    parentDiv.style.flexDirection = "column";

    const bloomButton = neoSellButton.cloneNode(true);
    bloomButton.classList.add(sellButtonClassName);
    bloomButton.style.marginTop = "6px";
    bloomButton.style.setProperty("border", `1px solid ${apiData.mainColor}`, "important");
    bloomButton.style.setProperty("background-color", `${apiData.hoverBackgroundColor}`, "important");
    const firstSpan = bloomButton.querySelector("span");
    if (firstSpan) {
      firstSpan.textContent = "Sell";
    }

    const lastDiv = findElement(bloomButton, apiData.selectors.lastDivSelector);
    if (!lastDiv) return;
    const amtContainer = findElement(sellDiv, apiData.selectors.amtContainerSelector);
    if (!amtContainer) return;
    const amtInput = findElement(amtContainer, apiData.selectors.amtInputSelector);
    if (amtInput) {
      if (bloomButton.disabled && amtInput.value > 0) {
        bloomButton.disabled = false;
      }
      lastDiv.innerHTML = `${amtInput.value || 0} %`;

      const observer = new MutationObserver(() => {
        if (bloomButton.disabled && amtInput.value > 0) {
          bloomButton.disabled = false;
        }
        lastDiv.innerHTML = `${amtInput.value || 0} %`;
      });
      observer.observe(amtInput, {
        attributes: true,
        attributeFilter: ["value"],
      });

      amtInput.addEventListener("input", () => {
        if (bloomButton.disabled && amtInput.value > 0) {
          bloomButton.disabled = false;
        }
        lastDiv.innerHTML = `${amtInput.value || 0} %`;
      });
    }

    bloomButton.onclick = async function (event) {
      event.preventDefault();
      event.stopPropagation();

      const url = new URL(window.location.href);
      const tokenMint = url.searchParams.get("address");
      if (!tokenMint) return showToast("Token not found");

      const token = await getBloomToken();
      if (!token) {
        return chrome.runtime.sendMessage({
          message: "openTab",
          url: `https://t.me/BloomSolana_bot?start=ref_QT_ca_${tokenMint}`,
        });
      }

      const amount = amtInput.value;
      if (!amount || isNaN(parseFloat(amount)))
        return showToast("Invalid amount!");

      activeTab = findElement(document, apiData.selectors.activeTabSelector);
      if (!activeTab) return;
      const tabName = activeTab.getAttribute(apiData.tabNameAttribute);
      if (tabName === apiData.tabNames.limit) {
        const limitSettings = (await chrome.storage.local.get("bloom.limitSettings"))?.["bloom.limitSettings"] || {};
        if (!Object.keys(limitSettings).length) {
          return showToast("Please set up limit settings first!");
        }

        const token = await getBloomToken();
        if (!token) {
          return chrome.runtime.sendMessage({
            message: "openTab",
            url: `https://t.me/BloomSolana_bot?start=ref_QT_ca_${tokenMint}`,
          });
        }

        const orderTrigger = findElement(sellDiv, apiData.selectors.orderTriggerSelector);
        if (!orderTrigger) return showToast("Failed to get order trigger!");
        const targetValueInput = findElement(orderTrigger, apiData.selectors.targetValueSelector);
        if (!targetValueInput) return showToast("Failed to get target value!");
        const targetValue = targetValueInput.value;
        if (!targetValue || isNaN(parseFloat(targetValue))) return showToast("Invalid target value!");
        const targetTypeDiv = findElement(orderTrigger, apiData.selectors.targetTypeDivSelector);
        if (!targetTypeDiv) return showToast("Failed to get target type!");
        const targetType = findElement(targetTypeDiv, apiData.selectors.targetTypeSelector);
        if (!targetType) return showToast("Failed to get target type!");
        const targetTypeValue = targetType.textContent;
        if (!targetTypeValue) return showToast("Failed to get target type!");
        const orderType = targetTypeValue === apiData.texts.targetTypePrice ? "Price" : targetTypeValue === apiData.texts.targetTypeMcap ? "MarketCap" : null;
        if (!orderType) return showToast("Invalid target type!");

        const expiryHours = 24;

        const additionalPayload = {
          values: {
            'limit-tip': limitSettings.limitSellTip,
            'limit-slippage': limitSettings.limitSellSlippage,
            'target-type': orderType,
            'target-value': targetValue,
            'expiry': expiryHours,
          }
        }

        const order = await interactWithBloom(null, tokenMint, "limit", token, amount, "sell", additionalPayload);
        if (order?.status === "success") {
          showToast("Order placed successfully!");
        } else {
          showToast("Failed placing order!");
        }
      } else if (tabName === apiData.tabNames.market) {

        const order = await interactWithBloom(null, tokenMint, "swap", token, amount, "sell");
        if (order?.status === "success") {
          showToast("Order placed successfully!");
        } else if (order?.status === "timeout") {
          showToast("Error sending order, try switching region!");
        } else {
          showToast("Failed placing order!");
        }
      } else {
        return showToast("Unsupported tab!");
      }
    };

    insertAfter(neoSellButton, bloomButton);
    return neoSellButton;
  } catch (error) {
    console.error("Failed to add Sell button:", error);
  }
}

function addNeoVisionButtons(card) {
  try {
    if (card.nodeName.toLowerCase() === 'html') return;
    const migrationContainer = Array.from(card.querySelectorAll("button")).find(
      (button) => button.textContent === apiData.texts.visionMigration,
    );

    const existingBuyButton = card.querySelector(`.${buyButtonClassName}`);
    const existingSnipeButton = card.querySelector(`.${snipeButtonClassName}`);

    if (existingBuyButton) existingBuyButton.remove();
    if (existingSnipeButton) existingSnipeButton.remove();

    const poolLink = findElement(card, apiData.selectors.poolLinkSelector);
    if (!poolLink) return;
    const poolUrl = new URL(poolLink.href);
    const tokenMint = poolUrl.searchParams.get("address");
    if (!tokenMint) return;

    let actionArea = findElement(card, apiData.selectors.actionAreaSelector);
    if (migrationContainer) {
      actionArea = migrationContainer;
    }
    if (!actionArea) return;

    if (migrationContainer) {
      addNeoVisionSnipingButton(actionArea, tokenMint);
    } else {
      for (const className of (apiData.spanClassesToAdd)) {
        try {
          actionArea.classList.add(className);
        } catch { }
      }
      for (const className of (apiData.spanClassesToRemove)) {
        try {
          actionArea.classList.remove(className);
        } catch { }
      }
      addNeoVisionBuyButton(actionArea, tokenMint);
    }
  } catch (error) {
    console.error("Failed to add Bloom button:", error);
  }
}

function addSearchButton(searchCard) {
  const existingBuyButton = searchCard.querySelector(`.${buyButtonClassName}`);
  if (existingBuyButton) existingBuyButton.remove();

  const bloomButton = document.createElement("button");
  bloomButton.innerHTML = apiData.texts.quickBuy;
  bloomButton.type = "button";
  bloomButton.classList.add(buyButtonClassName);
  for (const className of apiData.buttonClasses) {
    bloomButton.classList.add(className);
  }
  bloomButton.style.border = `1px solid ${apiData.mainColor}`;
  bloomButton.style.marginLeft = "18px";
  bloomButton.style.zIndex = 1000;
  bloomButton.style.backgroundColor = apiData.backgroundColor;

  bloomButton.onclick = async function (event) {
    event.preventDefault();
    event.stopPropagation();

    const poolLink = new URL(searchCard.href);
    const tokenMint = poolLink.searchParams.get("address");
    if (!tokenMint) return showToast("Token not found");

    const token = await getBloomToken();
    if (!token) {
      return chrome.runtime.sendMessage({
        message: "openTab",
        url: `https://t.me/BloomSolana_bot?start=ref_QT_ca_${tokenMint}`,
      });
    }

    const order = await interactWithBloom(null, tokenMint, "swap", token, quickBuyAmount, "buy");
    if (order?.status === "success") {
      showToast("Order placed successfully!");
    } else {
      showToast("Failed placing order!");
    }
  }

  searchCard.appendChild(bloomButton);
}

function addNeoVisionSnipingButton(actionArea, tokenMint) {
  const buttonText = apiData.texts.visionSnipe;

  const bloomButton = document.createElement("button");
  bloomButton.innerHTML = buttonText;
  bloomButton.type = "button";
  bloomButton.classList.add(snipeButtonClassName);
  for (const className of apiData.buttonClasses) {
    bloomButton.classList.add(className);
  }
  bloomButton.style.border = `1px solid ${apiData.mainColor}`;
  bloomButton.style.margin = "0px 6px";
  bloomButton.style.zIndex = 1000;
  bloomButton.style.backgroundColor = apiData.backgroundColor;

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

    const order = await interactWithBloom(null, tokenMint, "snipe", token);
    if (order?.status === "success") {
      showToast("Order placed successfully!");
    } else if (order?.status === "timeout") {
      showToast("Error sending order, try switching region!");
    } else {
      showToast("Failed placing order!");
    }
  };

  insertBefore(actionArea, bloomButton);
}

function addNeoVisionBuyButton(actionArea, tokenMint) {
  const bloomButton = document.createElement("button");
  bloomButton.innerHTML = apiData.texts.quickBuy;
  bloomButton.type = "button";
  bloomButton.classList.add(buyButtonClassName);
  for (const className of apiData.buttonClasses) {
    bloomButton.classList.add(className);
  }
  bloomButton.style.border = `1px solid ${apiData.mainColor}`;
  bloomButton.style.margin = "0px 6px";
  bloomButton.style.zIndex = 1000;
  bloomButton.style.backgroundColor = apiData.backgroundColor;

  bloomButton.onclick = async function (event) {
    event.preventDefault();
    event.stopPropagation();

    const token = await getBloomToken();
    if (!token) {
      return chrome.runtime.sendMessage({
        message: "openTab",
        url: `https://t.me/BloomSolana_bot?start=ref_QT_ca_${tokenMint}`,
      });
    }

    const order = await interactWithBloom(null, tokenMint, "swap", token, quickBuyAmount, "buy");
    if (order?.status === "success") {
      showToast("Order placed successfully!");
    } else if (order?.status === "timeout") {
      showToast("Error sending order, try switching region!");
    } else {
      showToast("Failed placing order!");
    }
  };

  insertBefore(actionArea, bloomButton);
}

function addDiscoverTrendingBuyButton(card) {
  try {
    const existingBuyButton = card.querySelector(`.${buyButtonClassName}`);
    if (existingBuyButton) {
      existingBuyButton.remove();
    }

    let actionArea = findElements(card, apiData.selectors.actionAreaSelector).find((b) => b.classList.contains(apiData.classNames.discoverTrendingActionArea));
    let currentNode = card;
    while (!actionArea && currentNode) {
      const sibling = currentNode.nextElementSibling;
      if (sibling && sibling.classList.contains(apiData.classNames.discoverTrendingSibling)) {
        actionArea = findElement(sibling, apiData.selectors.actionAreaSelector);
      }
      currentNode = sibling;
    }

    if (!actionArea) return;
    const buttonClass = buyButtonClassName;

    const bloomButton = document.createElement("button");

    bloomButton.innerHTML = apiData.texts.quickBuy;
    bloomButton.type = "button";
    bloomButton.classList.add(buttonClass);
    for (const className of apiData.buttonClasses) {
      bloomButton.classList.add(className);
    }

    bloomButton.style.border = `1px solid ${apiData.mainColor}`;
    bloomButton.style.margin = "0px 6px";
    bloomButton.style.zIndex = 1000;

    const poolLink = card.href;
    if (!poolLink) return;
    const poolUrl = new URL(poolLink);
    const tokenMint = poolUrl.searchParams.get("address");
    if (!tokenMint) return;

    bloomButton.onclick = async function (event) {
      event.preventDefault();
      event.stopPropagation();

      const token = await getBloomToken();
      if (!token) {
        return chrome.runtime.sendMessage({
          message: "openTab",
          url: `https://t.me/BloomSolana_bot?start=ref_QT_ca_${tokenMint}`,
        });
      }

      const order = await interactWithBloom(null, tokenMint, "swap", token, quickBuyAmount, "buy");
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

function addTopBarButton(topBar) {
  const existingBloomButton = document.querySelector(`.${topBarClassName}`);
  if (existingBloomButton) return;

  const lastDiv = topBar?.lastElementChild;
  if (!lastDiv) return;

  const buttonDiv = document.createElement("div");
  buttonDiv.classList.add(
    "flex",
    "items-center",
    "justify-center",
    "text-xs",
    "rounded",
    "p-1",
  );

  const bloomButton = document.createElement("button");
  bloomButton.innerHTML = apiData.texts.tokenTopBar;
  bloomButton.type = "button";
  bloomButton.classList.add(topBarClassName);
  for (const className of apiData.buttonClasses) {
    bloomButton.classList.add(className);
  }
  bloomButton.style.border = `1px solid ${apiData.mainColor}`;

  buttonDiv.appendChild(bloomButton);

  bloomButton.onclick = function () {
    const url = new URL(window.location.href);
    const tokenMint = url.searchParams.get("address");
    if (!tokenMint) return showToast("Token not found");

    chrome.runtime.sendMessage({
      message: "openTab",
      url: `https://t.me/BloomSolana_bot?start=ref_QT_ca_${tokenMint}`,
    });
  };

  insertAfter(lastDiv, buttonDiv);
}

function addOneClickButtons(container) {
  const existingOneClickButtons = Array.from(container.querySelectorAll(`.${oneClickButtonClassName}`));
  existingOneClickButtons.forEach((button) => {
    button.remove();
  });

  let bloomBuyDiv = container.querySelector(`.${buyDivClassName}`);
  let bloomSellDiv = container.querySelector(`.${sellDivClassName}`);

  const style = document.createElement("style");
  style.textContent = `
    .${oneClickButtonClassName} {
      border: 1px solid ${apiData.mainColor};
      color: ${apiData.mainColor};
      z-index: 1000;
      &:hover {
        background-color: ${apiData.mainColor};
        color: hsl(var(--twc-grey-900) / var(--twc-grey-900-opacity, var(--tw-text-opacity)))
      }
    }
  `;

  const oneClickButtons = Array.from(container.querySelectorAll("button"));
  oneClickButtons.forEach((button) => {
    const clonedButton = button.cloneNode(true);
    clonedButton.classList.add(oneClickButtonClassName);
    const isBuy = !button.textContent.includes('%');
    if (bloomBuyDiv && isBuy) {
      bloomBuyDiv.appendChild(clonedButton);
    } else if (bloomSellDiv && !isBuy) {
      bloomSellDiv.appendChild(clonedButton);
    } else {
      const parent = button.parentElement;
      if (!parent) return;
      if (isBuy) {
        bloomBuyDiv = parent.cloneNode(false);
        bloomBuyDiv.classList.add(buyDivClassName);
        bloomBuyDiv.appendChild(style);
        insertAfter(parent, bloomBuyDiv);
        bloomBuyDiv.appendChild(clonedButton);
      } else {
        bloomSellDiv = parent.cloneNode(false);
        bloomSellDiv.classList.add(sellDivClassName);
        bloomSellDiv.appendChild(style);
        insertAfter(parent, bloomSellDiv);
        bloomSellDiv.appendChild(clonedButton);
      }
    }

    clonedButton.onclick = async function (event) {
      event.preventDefault();
      event.stopPropagation();

      const url = new URL(window.location.href);
      const tokenMint = url.searchParams.get("address");
      if (!tokenMint) return showToast("Token not found");

      const token = await getBloomToken();
      if (!token) {
        return chrome.runtime.sendMessage({
          message: "openTab",
          url: `https://t.me/BloomSolana_bot?start=ref_QT_ca_${tokenMint}`,
        });
      }

      const isBuy = !button.textContent.includes('%');
      const amount = button.textContent.replace('%', '');
      const floatAmount = parseFloat(amount);

      if (isNaN(floatAmount) || floatAmount <= 0) {
        showToast("Please enter a valid amount!");
        return;
      }

      const order = await interactWithBloom(null, tokenMint, "swap", token, floatAmount, isBuy ? "buy" : "sell");
      if (order?.status === "success") {
        showToast("Order placed successfully!");
      } else if (order?.status === "timeout") {
        showToast("Error sending order, try switching region!");
      } else {
        showToast("Failed placing order!");
      }
    }
  });
}

function addWalletManagerButton(row, reload = false) {
  const existingWalletManagerButton = row.querySelector(`.${walletManagerButtonClassName}`);
  if (existingWalletManagerButton && !reload) return;
  else if (existingWalletManagerButton) existingWalletManagerButton.remove();

  const button = findElement(row, apiData.selectors.walletManagerButtonSelector);
  if (!button) return;

  const clonedButton = button.cloneNode(true);
  clonedButton.classList.add(walletManagerButtonClassName);
  clonedButton.style.border = `1px solid ${apiData.mainColor}`;
  const svg = clonedButton.querySelector('svg');
  const text = document.createElement('p');
  text.textContent = apiData.texts.tokenTopBar;
  const span = clonedButton.querySelector('span');
  span.textContent = apiData.texts.quickBuy;
  insertBefore(svg, text);
  svg.remove();
  clonedButton.style.margin = '0px 4px';
  clonedButton.onclick = async function (event) {
    event.preventDefault();
    event.stopPropagation();

    const poolLink = row.querySelector('a[href*="/terminal"]');
    if (!poolLink) return showToast("Token not found!");
    const poolUrl = new URL(poolLink.href);
    const tokenMint = poolUrl.searchParams.get("address");
    if (!tokenMint) return showToast("Token not found!");

    const token = await getBloomToken();
    if (!token) {
      return chrome.runtime.sendMessage({
        message: "openTab",
        url: `https://t.me/BloomSolana_bot?start=ref_QT_ca_${tokenMint}`,
      });
    }

    const order = await interactWithBloom(null, tokenMint, "swap", token, quickBuyAmount, "buy");
    if (order?.status === "success") {
      showToast("Order placed successfully!");
    } else if (order?.status === "timeout") {
      showToast("Error sending order, try switching region!");
    } else {
      showToast("Failed placing order!");
    }
  };

  insertBefore(button, clonedButton);
}

let isQuickPanelHidden = false;
let chosenRegion = "EU1";

async function addBloomQuickPanel() {
  try {
    function getRandomNumber(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function addRandomChildren(parent) {
      const randomElementTypes = [
        "div", "span", "main", "p", "section", "article", "i", "aside",
        "footer", "nav", "header", "strong", "em"
      ];
      const randomChildCount = getRandomNumber(4, 9);
      for (let i = 0; i < randomChildCount; i++) {
        const randomType =
          randomElementTypes[Math.floor(Math.random() * randomElementTypes.length)];
        const child = document.createElement(randomType);
        child.style.display = "none";
        parent.appendChild(child);
      }
    }

    function createRandomNestedWrappers(container) {
      let currentNode = container;
      const randomDepth = getRandomNumber(3, 8);
      const randomWrappableElements = [
        "div", "section", "article", "main", "nav",
        "span", "header", "footer", "aside"
      ];

      for (let i = 0; i < randomDepth; i++) {
        const wrapType =
          randomWrappableElements[Math.floor(Math.random() * randomWrappableElements.length)];
        const wrapper = document.createElement(wrapType);
        addRandomChildren(wrapper);
        wrapper.style.display = "block";
        wrapper.appendChild(currentNode);
        currentNode = wrapper;
      }

      return currentNode;
    }

    function insertAtRandomIndex(parent, elementToInsert) {
      const children = Array.from(parent.childNodes).filter(
        (node) => node.nodeType === 1
      );

      const insertIndex = getRandomNumber(0, children.length);
      if (children.length === 0 || insertIndex >= children.length) {
        parent.appendChild(elementToInsert);
      } else {
        parent.insertBefore(elementToInsert, children[insertIndex]);
      }
    }

    const {
      "bloom.presets": bloomPresets,
      "bloom.activePreset": activeBloomPreset,
      [`bloom.hiddenState.${platform}`]: hiddenState,
      'bloom.activeRegion': activeRegion
    } = await chrome.storage.local.get([
      "bloom.presets",
      "bloom.activePreset",
      `bloom.hiddenState.${platform}`,
      'bloom.activeRegion'
    ]);

    const base64BgDark = await loadBgDarkAsBase64();

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

    addRandomChildren(container);

    container.style.pointerEvents = "none";
    container.style.visibility = "hidden";

    styleContainer(container, base64BgDark);

    const header = document.createElement("div");
    header.classList.add(headerClassName);
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
      borderBottom: `1px solid ${apiData.panelBorderBottomColor}`
    });

    const headerLeft = document.createElement("div");
    Object.assign(headerLeft.style, {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flex: "1"
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
        await chrome.storage.local.set({ "bloom.activePreset": newLabel });
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
        url: chrome.runtime.getURL("src/public/bloom_settings.html")
      });
    });
    header.appendChild(settingsBtn);

    const bodyWrapper = document.createElement("div");
    Object.assign(bodyWrapper.style, {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      padding: "0 4px"
    });

    container.appendChild(header);
    container.appendChild(bodyWrapper);

    let main = document.querySelector("main") || document.body;

    removeBloomQuickPanels();

    const randomWrappedContainer = createRandomNestedWrappers(container);

    insertAtRandomIndex(main, randomWrappedContainer);

    await updateBloomModalUI(chosenPreset, bodyWrapper);

    await new Promise((resolve) => requestAnimationFrame(resolve));
    const containerHeight = container.offsetHeight;

    if (hiddenState) {
      container.style.transition = "none";
      const originalTransition = "bottom 0.3s ease, right 0.3s ease";
      const showMargin = 72;
      const bottomPos = -(containerHeight - showMargin);

      container.style.inset = "";
      container.style.top = "auto";
      container.style.left = "auto";
      container.style.bottom = bottomPos + "px";
      container.style.right = "20px";

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
  const showMargin = 72;
  const hoverMargin = 96;

  isQuickPanelHidden = Boolean(initialHiddenState);

  container.style.transition = originalTransition;

  const header = container.querySelector(`.${headerClassName}`);
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

  header.appendChild(minimizeBtn);

  if (!isQuickPanelHidden) {
    initializePanelDrag(container, header, `bloom.positionBeforeHide.${platform}`);
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

        initializePanelDrag(container, header, `bloom.positionBeforeHide.${platform}`);
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

      const url = new URL(window.location.href);
      const tokenMint = url.searchParams.get("address");
      if (!tokenMint) {
        showToast("Token not found");
        showButtonClickFeedback(btn, text, "buy", "error", true);
        return;
      }

      const buyOrder = await interactWithBloom(null, tokenMint, "swap", token, amt, "buy", preset);
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

    const url = new URL(window.location.href);
    const tokenMint = url.searchParams.get("address");
    if (!tokenMint) {
      showToast("Token not found");
      showButtonClickFeedback(manualBuyBtn, buyText, "buy", "error", true);
      return;
    }

    const buyOrder = await interactWithBloom(chosenRegion, tokenMint, "swap", token, val, "buy", preset);
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
    boxSizing: "border-box",
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

      const url = new URL(window.location.href);
      const tokenMint = url.searchParams.get("address");
      if (!tokenMint) {
        showToast("Token not found");
        showButtonClickFeedback(btn, text, "sell", "error", true);
        return;
      }

      const sellOrder = await interactWithBloom(chosenRegion, tokenMint, "swap", token, pct, "sell", preset);
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

    const url = new URL(window.location.href);
    const tokenMint = url.searchParams.get("address");
    if (!tokenMint) {
      showToast("Token not found");
      showButtonClickFeedback(manualSellBtnPercent, sellText, "sell", "error", true);
      return;
    }

    const sellOrder = await interactWithBloom(chosenRegion, tokenMint, "swap", token, val, "sell", preset);
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

    const url = new URL(window.location.href);
    const tokenMint = url.searchParams.get("address");
    if (!tokenMint) {
      showToast("Token not found");
      showButtonClickFeedback(manualSellBtnSol, sellText, "sell", "error", true);
      return;
    }

    const sellOrder = await interactWithBloom(chosenRegion, tokenMint, "swap", token, val, "sellamt", preset);
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

    const url = new URL(window.location.href);
    const tokenMint = url.searchParams.get("address");
    if (!tokenMint) {
      showToast("Token not found!");
      showButtonClickFeedback(initialsBtn, initialsText, "sell", "error", true);
      return;
    }

    const sellOrder = await interactWithBloom(chosenRegion, tokenMint, "swap", token, "ini", "sell", preset);
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

      const url = new URL(window.location.href);
      const tokenMint = url.searchParams.get("address");
      if (!tokenMint) {
        showToast("Token not found!");
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

    const url = new URL(window.location.href);
    const tokenMint = url.searchParams.get("address");
    if (!tokenMint) return showToast("Token not found");

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

    const url = new URL(window.location.href);
    const tokenMint = url.searchParams.get("address");
    if (!tokenMint) return showToast("Token not found");

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

function styleContainer(el, base64BgDark) {
  Object.assign(el.style, {
    position: "fixed",
    top: "100px",
    left: "100px",
    width: "280px",
    minHeight: "220px",
    display: "flex",
    flexDirection: "column",
    background: "#1d2040 url(" + base64BgDark + ")",
    backgroundSize: "cover",
    backgroundPosition: "center",
    borderRadius: "10px",
    padding: "0 8px 8px 8px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
    zIndex: 1000,
    fontFamily: "Suisse Intl Medium, sans-serif",
    color: "#ffffff",
    border: `1px solid ${apiData.panelBorderBottomColor}`,
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
    border: `1px solid ${apiData.panelBorderBottomColor}`,
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
    border: `1px solid ${apiData.panelBorderBottomColor}`,
    borderRadius: "5px",
    padding: "6px 28px 6px 10px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "500",
    outline: "none",
    WebkitAppearance: "none",
    appearance: "none",
    backgroundImage: `url('data:image/svg+xml;utf8,<svg fill="%23${apiData.mainColor.replace('#', '')}" height="14" viewBox="0 0 24 24" width="14" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>')`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center",
    backgroundSize: "12px",
    transition: "all 0.2s ease",
    minWidth: "80px",
    maxWidth: "160px",
  });

  select.addEventListener("mouseenter", () => {
    select.style.borderColor = apiData.mainColor;
  });
  select.addEventListener("mouseleave", () => {
    if (document.activeElement !== select) {
      select.style.borderColor = apiData.panelBorderBottomColor;
    }
  });
  select.addEventListener("focus", () => {
    select.style.borderColor = apiData.mainColor;
  });
  select.addEventListener("blur", () => {
    select.style.borderColor = apiData.panelBorderBottomColor;
  });
}

function styleButton(btn, side, isAmt) {
  const color =
    side === "buy" ? "#00ffc1" : side === "sell" ? "#f93d3d" : apiData.mainColor;
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
    border: `1px solid ${apiData.panelBorderBottomColor}`,
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
    input.style.border = `1px solid ${apiData.mainColor}`;
  });
  input.addEventListener("blur", () => {
    input.style.border = `1px solid ${apiData.panelBorderBottomColor}`;
  });
}

function styleUtilityButton(btn) {
  Object.assign(btn.style, {
    flex: "1",
    border: `1px solid ${apiData.mainColor}`,
    background: "transparent",
    color: apiData.mainColor,
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

function initializePanelDrag(panelRoot, handleEl, storageKey) {
  let panelDragOffsetX = 0;
  let panelDragOffsetY = 0;
  let panelDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  let panelDragAnimationId;
  let dragOverlay = null;

  const handleMousedown = (evt) => {
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

    evt.preventDefault();
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

  handleEl.addEventListener("mousedown", handleMousedown);
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

async function loadBgDarkAsBase64() {
  const response = await fetch(chrome.runtime.getURL("src/public/assets/images/bg-dark.png"));
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(blob);
  });
}

async function loadResizeSvg() {
  const response = await fetch(chrome.runtime.getURL("src/public/assets/images/resize.svg"));
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(blob);
  });
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

  const resizeSvg = await loadResizeSvg();

  const resizeHandle = document.createElement("div");
  Object.assign(resizeHandle.style, {
    position: "absolute",
    width: "32px",
    height: "32px",
    right: "-8px",
    bottom: "-12px",
    cursor: "nwse-resize",
    zIndex: 10000,
    background: `url("${resizeSvg}") no-repeat center center`,
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
