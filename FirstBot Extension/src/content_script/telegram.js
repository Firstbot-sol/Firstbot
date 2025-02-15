let currentObservers = [];
const platform = "telegram";

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

function showToast(message, position = "bottom-right", redirect = false) {
  const previousToasts = document.querySelectorAll(".bloom-toast");
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
  toast.classList.add("bloom-toast");

  const messageSpan = document.createElement("span");
  messageSpan.innerHTML = "🚀 " + message;
  toast.appendChild(messageSpan);

  if (redirect) {
    const learnMoreButton = document.createElement("a");
    learnMoreButton.textContent = "Click to redirect";
    learnMoreButton.style.textDecoration = "underline";
    learnMoreButton.style.border = "none";
    learnMoreButton.style.backgroundColor = "transparent";
    learnMoreButton.style.color = "#96FF98";
    learnMoreButton.style.marginLeft = "8px";
    learnMoreButton.style.cursor = "pointer";
    learnMoreButton.style.padding = "0";
    learnMoreButton.href = "https://web.telegram.org/k";
    learnMoreButton.target = "_self";

    toast.appendChild(learnMoreButton);
  }

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity 0.5s ease-out";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 500);
  }, (redirect || position === "top-center") ? 10000 : 3000);
}

async function interactWithBloom(isAutoBuy, selectedRegion, address, type, authToken, amount, side, selectedPreset) {
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
    if (isAutoBuy) {
      const scraperSettings =
        (await chrome.storage.local.get("bloom.scraperSettings"))?.["bloom.scraperSettings"] || {};
      const skipIfBought = scraperSettings.skipContractIfBought ?? false;
      payload.skip = skipIfBought;
    }
    if (selectedPreset && type === "swap") {
      payload.fee = (side === 'buy' ? selectedPreset.values['buy-fee'] : selectedPreset.values['sell-fee']).toString();
      payload.tip = (side === 'buy' ? selectedPreset.values['buy-tip'] : selectedPreset.values['sell-tip']).toString();
      payload.slippage = (side === 'buy' ? selectedPreset.values['buy-slippage'] : selectedPreset.values['sell-slippage']).toString();
      if (side === 'buy') {
        if (typeof selectedPreset.values['buy-anti-mev'] === 'undefined') {
          payload.antimev = selectedPreset.values['anti-mev'];
        } else {
          payload.antimev = selectedPreset.values['buy-anti-mev'];
        }
      } else {
        if (typeof selectedPreset.values['sell-anti-mev'] === 'undefined') {
          payload.antimev = selectedPreset.values['anti-mev'];
        } else {
          payload.antimev = selectedPreset.values['sell-anti-mev'];
        }
      }
      payload.autotip = selectedPreset.values['auto-tip'];
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

function insertAfter(referenceNode, newNode) {
  referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function insertBefore(referenceNode, newNode) {
  referenceNode.parentNode.insertBefore(newNode, referenceNode);
}

let currentPage, quickBuyAmount, autoBuyAmount, autoBuyStartedAt = 0, seenMessages = [], boughtAddresses = [];
chrome.runtime.onMessage.addListener(async function (request) {
  if (request.shouldWarnAboutUpdate) {
    showToast("A new version of the First Extension is available! Check out how to install it <a href='https://docs.bloombot.app/extension/setup/download-chrome/.zip-file' target='_blank' style='text-decoration: underline; color: #96FF98;'>here</a>", "top-center");
  }
  const sitePreferences = (await chrome.storage.local.get(`bloom.sitePreferences`))?.[`bloom.sitePreferences`] || {};
  if (request.event !== "onActivated") autoBuyStartedAt = 0;
  else if (autoBuyStartedAt && sitePreferences[platform] !== false) autoBuyStartedAt = Date.now();
  removeBloomQuickPanels();
  if (sitePreferences[platform] === false) return;
  if (request.message === "telegram") {
    if (request.event === "onCompleted") {
      const url = window.location.href;
      if (url.includes("/a/")) {
        showToast('Please use the "K" version for the First extension to work!', "top-center", true)
      }
    }
    quickBuyAmount =
      (await chrome.storage.local.get("bloom.quickBuyAmount"))?.["bloom.quickBuyAmount"] || 0.5;
    const scraperSettings =
      (await chrome.storage.local.get("bloom.scraperSettings"))?.["bloom.scraperSettings"] || {};
    autoBuyAmount = scraperSettings.telegramAutoBuyAmount || quickBuyAmount;
    currentPage = "telegram";
    currentObservers.forEach((observer) => observer.disconnect());
    currentObservers = [];
    const titleContainer = await findTitleContainer();
    if (titleContainer) addAutoBuyToggleButton(titleContainer);
    const allMessages = Array.from(document.body.querySelectorAll('div[data-mid]'));
    allMessages.forEach((message) => {
      const messageId = message.getAttribute('data-mid');
      const timestamp = message.getAttribute('data-timestamp');
      if (!messageId) return;
      processMessage(message, messageId, timestamp);
    });
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m?.addedNodes?.forEach(async (node) => {
          if ((node.nodeName === "DIV" && node.classList.contains("sidebar-header") && node.classList.contains("topbar")) || (node.nodeName === "SPAN" && node.classList.contains("peer-title"))) {
            autoBuyStartedAt = 0;
            const titleContainer = await findTitleContainer();
            if (titleContainer) addAutoBuyToggleButton(titleContainer);
            const allMessages = Array.from(document.body.querySelectorAll('div[data-mid]'));
            allMessages.forEach((message) => {
              const messageId = message.getAttribute('data-mid');
              const timestamp = message.getAttribute('data-timestamp');
              if (!messageId) return;
              processMessage(message, messageId, timestamp);
            });
          } else if (node.nodeName === "DIV" && node.classList.contains("bubbles-group")) {
            const allMessages = Array.from(node.querySelectorAll('div[data-mid]'));
            allMessages.forEach((message) => {
              const messageId = message.getAttribute('data-mid');
              const timestamp = message.getAttribute('data-timestamp');
              if (!messageId) return;
              processMessage(message, messageId, timestamp);
            });
          } else if (node.nodeName === "DIV" && node.getAttribute('data-mid')) {
            const messageId = node.getAttribute('data-mid');
            const timestamp = node.getAttribute('data-timestamp');
            if (!messageId) return;
            processMessage(node, messageId, timestamp);
          } else if (node.nodeName === "DIV" && node.classList.contains('bubbles-inner')) {
            const allMessages = Array.from(node.querySelectorAll('div[data-mid]'));
            allMessages.forEach((message) => {
              const messageId = message.getAttribute('data-mid');
              const timestamp = message.getAttribute('data-timestamp');
              if (!messageId) return;
              processMessage(message, messageId, timestamp);
            });
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    currentObservers.push(observer);
  }
  if (request.message === "quickBuyAmount") {
    quickBuyAmount =
      (await chrome.storage.local.get("bloom.quickBuyAmount"))?.[
      "bloom.quickBuyAmount"
      ] || 0.5;
    const scraperSettings =
      (await chrome.storage.local.get("bloom.scraperSettings"))?.["bloom.scraperSettings"] || {};
    autoBuyAmount = scraperSettings.telegramAutoBuyAmount || quickBuyAmount;
    if (currentPage === "telegram") {
      const titleContainer = await findTitleContainer();
      if (!titleContainer) return;
      const allMessages = document.body.querySelectorAll('div[data-mid]');
      allMessages.forEach((message) => {
        const messageId = message.getAttribute('data-mid');
        if (!messageId) return;
        processMessage(message, messageId);
      });
    }
  } else if (request.message === "scraperAmount") {
    const scraperSettings =
      (await chrome.storage.local.get("bloom.scraperSettings"))?.["bloom.scraperSettings"] || {};
    autoBuyAmount = scraperSettings.telegramAutoBuyAmount || quickBuyAmount;
  }
});

async function findTitleContainer(timeout = 5000) {
  for (let i = 0; i < timeout / 500; i++) {
    const container = document.querySelector('div.chat-info-container');
    if (container) return container;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

function processMessage(element, messageId, timestamp) {
  try {
    const existingButtonContainer = element.querySelector(".bloom-button-container");
    if (existingButtonContainer) {
      return;
    }

    const spoilersContainer = element.querySelector(".message.spoilers-container");
    if (!spoilersContainer) {
      return;
    }
    const messageContent = spoilersContainer.querySelector(".translatable-message");
    if (!messageContent) {
      const codeElements = spoilersContainer.querySelectorAll("code");
      codeElements.forEach((codeElement) => {
        transformNode(codeElement);
      });
      return;
    };

    for (const child of Array.from(messageContent.childNodes)) {
      transformNode(child);
    }
  } catch (error) {
    console.error("Failed to add First button:", error);
  }

  async function handleAutoBuy(address) {
    if (autoBuyStartedAt && !seenMessages.includes(messageId)) {
      seenMessages.push(messageId);
      if (timestamp * 1_000 <= autoBuyStartedAt) {
        return;
      }

      const timeElapsed = Date.now() - timestamp * 1_000;
      if (timeElapsed > 30_000) {
        return;
      }

      if (boughtAddresses.includes(address)) {
        return;
      }

      boughtAddresses.push(address);

      const token = await getBloomToken();
      if (!token) {
        return;
      }

      const buyOrder = await interactWithBloom(true, null, address, "swap", token, autoBuyAmount, "buy");
      if (buyOrder?.status === "success") {
        showToast("Order placed successfully!");
      } else if (buyOrder?.error === "already_bought") {
        showToast("Already bought this token!");
      } else if (buyOrder?.status === "timeout") {
        showToast("Error sending order, try switching region!");
      } else {
        showToast("Failed placing order!");
      }
    }
  }

  function transformNode(node) {
    const ADDRESS_REGEX = /\b[1-9A-HJ-NP-Za-km-z]{43,44}\b/g;

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      let match;
      let lastIndex = 0;
      const fragment = document.createDocumentFragment();

      while ((match = ADDRESS_REGEX.exec(text)) !== null) {
        const address = match[0];

        handleAutoBuy(address);
        const start = match.index;
        const end = start + address.length;

        if (start > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
        }

        const addressSpan = document.createElement("span");
        addressSpan.textContent = address;

        const bloomButton = createBloomButton(address);
        addressSpan.appendChild(bloomButton);

        fragment.appendChild(addressSpan);
        lastIndex = end;
      }

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      if (fragment.childNodes.length > 0) {
        node.replaceWith(fragment);
      }
    }
    else if (node.nodeType === Node.ELEMENT_NODE) {
      const nodeName = node.nodeName.toLowerCase();

      if (nodeName === "a") {
        const anchorText = node.textContent || "";
        const textMatches = anchorText.match(ADDRESS_REGEX);

        if (textMatches?.length) {
          textMatches.forEach(async (address) => {

            handleAutoBuy(address);
            const bloomBtn = createBloomButton(address);
            node.insertAdjacentElement("afterend", bloomBtn);
          });
          return;
        }
      } else if (nodeName === "span") {
        if (node.classList.contains("spoiler")) {
          const spoilerText = node.querySelector("span.spoiler-text");
          if (spoilerText) {
            transformNode(spoilerText);
          }
        } else if (node.classList.contains("spoiler-text")) {
          const spoilerText = node.textContent;
          const codeMatches = spoilerText.match(ADDRESS_REGEX);
          if (codeMatches?.length) {
            codeMatches.forEach(async (address) => {
              handleAutoBuy(address);
              const bloomBtn = createBloomButton(address);
              node.parentElement.insertAdjacentElement("afterend", bloomBtn);
            });
          }
        }
      }
      else if (nodeName === "pre") {
        const codeElement = node.querySelector("code");
        if (codeElement) {
          transformNode(codeElement);
        }
      }
      else if (nodeName === "code") {
        const codeText = node.textContent;
        const codeMatches = codeText.match(ADDRESS_REGEX);

        if (codeMatches?.length) {
          codeMatches.forEach(async (address) => {
            if (address === address.toLowerCase()) {
              return;
            }

            handleAutoBuy(address);
            const bloomBtn = createBloomButton(address);
            const targetElement = node.closest('pre');
            (targetElement || node).insertAdjacentElement("afterend", bloomBtn);
          });
          return;
        }
      } else {
        const text = node.textContent;
        const textMatches = text.match(ADDRESS_REGEX);
        if (textMatches?.length) {
          textMatches.forEach(async (address) => {
            handleAutoBuy(address);

            const bloomBtn = createBloomButton(address);
            node.insertAdjacentElement("afterend", bloomBtn);
          });
        }
      }
    }
  }

  function createBloomButton(address) {
    const buttonContainer = document.createElement("span");
    buttonContainer.style.display = "inline-flex";
    buttonContainer.style.gap = "4px";
    buttonContainer.style.marginLeft = "4px";
    buttonContainer.classList.add("bloom-button-container");

    const bloomButton = document.createElement("button");
    bloomButton.classList.add("bloom-buy-qt-btn");

    bloomButton.style.display = "inline-flex";
    bloomButton.style.alignItems = "center";
    bloomButton.style.justifyContent = "center";
    bloomButton.style.gap = "4px";
    bloomButton.style.background = "transparent";
    bloomButton.style.border = "1px solid #96FF98";
    bloomButton.style.borderRadius = "4px";
    bloomButton.style.cursor = "pointer";
    bloomButton.style.color = "white";
    bloomButton.style.padding = "4px 6px";
    bloomButton.style.transition = "all 0.2s ease";

    bloomButton.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="margin-right: 4px;">
<rect width="72" height="72" fill="url(#pattern0_8_20121)"/>
<defs>
<pattern id="pattern0_8_20121" patternContentUnits="objectBoundingBox" width="1" height="1">
<use xlink:href="#image0_8_20121" transform="scale(0.0138889)"/>
</pattern>
<image id="image0_8_20121" width="72" height="72" xlink:href="data:image/png;base64,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"/>
</defs>
</svg>`

    const textSpan = document.createElement("span");
    textSpan.textContent = quickBuyAmount;

    bloomButton.appendChild(textSpan);

    bloomButton.onclick = async (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      const token = await getBloomToken();
      if (!token) {
        return chrome.runtime.sendMessage({
          message: "openTab",
          url: `https://t.me/BloomSolana_bot?start=ref_QT_ca_${address}`,
        });
      }

      const order = await interactWithBloom(false, null, address, "swap", token, quickBuyAmount, "buy", null);
      if (order?.status === "success") {
        showToast("Order placed successfully!");
      } else if (order?.status === "timeout") {
        showToast("Error sending order, try switching region!");
      } else {
        showToast("Failed placing order!");
      }
    };

    const panelButton = document.createElement("button");
    panelButton.classList.add("bloom-panel-btn");
    panelButton.style.display = "inline-flex";
    panelButton.style.alignItems = "center";
    panelButton.style.justifyContent = "center";
    panelButton.style.gap = "4px";
    panelButton.style.background = "transparent";
    panelButton.style.border = "1px solid #96FF98";
    panelButton.style.borderRadius = "4px";
    panelButton.style.cursor = "pointer";
    panelButton.style.color = "white";
    panelButton.style.padding = "4px 6px";
    panelButton.style.transition = "all 0.2s ease";

    panelButton.innerHTML = `
    <svg width="16" height="16.8" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.6158 12.2868C13.6109 12.3565 15.2818 11.5917 16.4435 10.3827C18.5888 8.15279 19.0029 4.41422 16.5326 1.62946L14.6886 2.72176C14.148 3.04231 13.4573 2.85155 13.145 2.29669C12.8386 1.75315 12.4008 1.29498 11.8653 0.990978C9.49341 -0.381804 6.69215 1.27668 5.75952 4.21562C7.68587 3.38551 8.81792 3.42296 9.51208 3.74003H9.51293C9.64022 3.79752 9.75224 3.86459 9.85237 3.93776C10.1654 4.16383 10.4379 4.52126 10.6973 4.86154C11.2114 5.53603 11.6742 6.14316 12.2998 5.52656C12.5679 5.21037 12.4839 4.70341 12.332 4.22782C12.2722 4.03956 12.2017 3.8561 12.1384 3.69099C12.0067 3.34805 11.9055 3.08432 11.9926 3.02141C12.1716 2.89162 13.4157 3.75832 14.0309 5.26524C14.0785 5.37935 14.1209 5.49694 14.1599 5.61889C15.0637 8.54912 13.0576 11.3635 11.6158 12.2868Z" fill="white"/>
      <path d="M3.42924 12.0429C3.32486 12.5638 3.34947 12.9375 3.44451 12.9828C3.49713 13.008 3.57265 12.9532 3.666 12.8504C3.74471 12.7652 3.83638 12.6469 3.93875 12.5149C4.31868 12.0249 4.84594 11.3449 5.4048 11.4567C6.23708 11.705 5.95657 12.4194 5.64476 13.2136C5.4873 13.6146 5.32186 14.0359 5.2877 14.4279C5.25715 14.7554 5.30297 15.1404 5.49815 15.5838C5.78583 16.2344 6.39683 17.0132 7.56876 17.9269C4.62238 18.5671 1.82282 16.9069 1.79481 14.1117C1.79481 14.1021 1.7946 14.0923 1.79439 14.0825C1.79418 14.0727 1.79396 14.0629 1.79396 14.0533C1.79396 13.4453 1.96029 12.8486 2.25731 12.3208C2.56959 11.7659 2.38375 11.0569 1.84318 10.7363L0 9.64403C0.914803 6.69551 3.34777 5.15548 5.82487 5.13894C7.99646 5.125 10.2029 6.28176 11.4503 8.685C9.94996 7.86534 6.57249 7.48904 4.55195 9.75727C3.89597 10.509 3.56077 11.3905 3.42924 12.0429Z" fill="white"/>
      <path d="M17.9006 16.5036C17.3753 16.8276 16.7702 16.987 16.1584 16.987C15.5466 16.987 15.028 17.507 15.028 18.1473V20.3327C11.9187 21.0305 9.28805 19.4382 8.11781 17.0314C7.20725 15.1604 7.17925 12.7964 8.49374 10.6336C8.5523 12.3765 9.92365 15.5672 12.848 16.2292C12.9854 16.2588 13.1212 16.2815 13.2562 16.2971C14.8159 16.4844 16.1423 15.8233 16.1236 15.6012C16.0975 15.4926 15.8157 15.4472 15.4575 15.3896C15.1865 15.3459 14.8718 15.2953 14.591 15.2048C14.0793 15.0402 13.6805 14.7441 13.8629 14.1186C14.1635 13.645 14.6632 13.5862 15.2239 13.5202C15.4088 13.4985 15.6003 13.4759 15.7935 13.4375C16.7932 13.2371 17.8361 12.6108 18.2324 9.46285C20.2462 11.7616 20.2445 15.0803 17.9006 16.5036Z" fill="white"/>
    </svg>
  `;

    panelButton.onclick = async (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      removeBloomQuickPanels();
      addBloomQuickPanel(panelButton, address);
    };

    buttonContainer.appendChild(bloomButton);
    buttonContainer.appendChild(panelButton);
    return buttonContainer;
  }
}

let chosenRegion = "EU1";

async function addBloomQuickPanel(anchorButton, tokenMint) {
  try {
    const {
      'bloom.presets': bloomPresets,
      'bloom.activePreset': activeBloomPreset,
      'bloom.activeRegion': activeRegion
    } = await chrome.storage.local.get([
      "bloom.presets",
      "bloom.activePreset",
      "bloom.activeRegion"
    ]);

    let chosenPreset = null;
    if (Array.isArray(bloomPresets) && bloomPresets.length > 0) {
      if (activeBloomPreset) {
        chosenPreset = bloomPresets.find((p) => p.label === activeBloomPreset) || bloomPresets[0];
      } else {
        chosenPreset = bloomPresets[0];
      }
    }

    if (activeRegion) chosenRegion = activeRegion;

    const container = document.createElement("div");
    container.classList.add("bloomModalContainer");
    styleContainer(container);

    const header = document.createElement("div");
    Object.assign(header.style, {
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
      let presetSelector = null;
      presetSelector = document.createElement("select");
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

      presetSelector.addEventListener("change", async (e) => {
        const newLabel = e.target.value;
        const newPreset = bloomPresets.find((p) => p.label === newLabel);
        if (!newPreset) return;
        await chrome.storage.local.set({ 'bloom.activePreset': newLabel });
        chosenPreset = newPreset;
        updateBloomModalUI(tokenMint, newPreset, bodyWrapper);
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

    document.body.appendChild(container);
    await updateBloomModalUI(tokenMint, chosenPreset, bodyWrapper);

    positionPanel(container, anchorButton);

    const closeHandler = (e) => {
      if (!container.contains(e.target) && !anchorButton.contains(e.target)) {
        container.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  } catch (error) {
    console.error("Failed to inject First popup:", error);
  }
}

function positionPanel(panel, anchorButton) {
  const buttonRect = anchorButton.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  let left = buttonRect.right + 10;
  let top = buttonRect.top;

  if (left + panelRect.width > viewportWidth) {
    left = buttonRect.left - panelRect.width - 10;
  }

  const buttonVerticalCenter = buttonRect.top + buttonRect.height / 2;
  const viewportThird = viewportHeight / 3;

  if (buttonVerticalCenter < viewportThird) {
    top = buttonRect.bottom + 10;
  } else if (buttonVerticalCenter > viewportThird * 2) {
    top = buttonRect.top - panelRect.height - 10;
  } else {
    top = buttonRect.top - (panelRect.height - buttonRect.height) / 2;
  }

  top = Math.max(10, Math.min(viewportHeight - panelRect.height - 10, top));

  Object.assign(panel.style, {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
  });
}

async function updateBloomModalUI(tokenMint, preset, bodyWrapper) {
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
        showToast("Log in to the First extension first!");
        showButtonClickFeedback(btn, text, "buy", "error", true);
        return;
      }

      const buyOrder = await interactWithBloom(false, chosenRegion, tokenMint, "swap", token, amt, "buy", preset);
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
      showToast("Log in to the First extension first!");
      showButtonClickFeedback(manualBuyBtn, buyText, "buy", "error", true);
      return;
    }

    const buyOrder = await interactWithBloom(false, chosenRegion, tokenMint, "swap", token, val, "buy", preset);
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
        showToast("Log in to the First extension first!");
        showButtonClickFeedback(btn, text, "sell", "error", true);
        return;
      }

      const sellOrder = await interactWithBloom(false, chosenRegion, tokenMint, "swap", token, pct, "sell", preset);
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
      showToast("Log in to the First extension first!");
      showButtonClickFeedback(manualSellBtnPercent, sellText, "sell", "error", true);
      return;
    }

    const sellOrder = await interactWithBloom(false, chosenRegion, tokenMint, "swap", token, val, "sell", preset);
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
      showToast("Log in to the First extension first!");
      showButtonClickFeedback(manualSellBtnSol, sellText, "sell", "error", true);
      return;
    }

    const sellOrder = await interactWithBloom(false, chosenRegion, tokenMint, "swap", token, val, "sellamt", preset);
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
      showToast("Log in to the First extension first!");
      showButtonClickFeedback(initialsBtn, initialsText, "sell", "error", true);
      return;
    }

    const tokenMint = window.location.href.split("/").pop();
    if (!tokenMint) {
      showToast("Token not found!");
      showButtonClickFeedback(initialsBtn, initialsText, "sell", "error", true);
      return;
    }

    const sellOrder = await interactWithBloom(false, chosenRegion, tokenMint, "swap", token, "ini", "sell", preset);
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
        showToast("Log in to the First extension first!");
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
    if (!token) return showToast("Log in to the First extension first!");

    const snipeOrder = await interactWithBloom(false, chosenRegion, tokenMint, "snipe", token);
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
    if (!token) return showToast("Log in to the First extension first!");

    const pnl = await interactWithBloom(false, chosenRegion, tokenMint, "pnl", token);
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
    zIndex: 1000,
    fontFamily: "Suisse Intl Medium, sans-serif",
    color: "#ffffff",
    border: "1px solid #5e5e68",
    lineHeight: "normal",
    boxSizing: "border-box",
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
    boxSizing: "border-box",
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
    marginLeft: "4px"
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

function removeBloomQuickPanels() {
  const previousQuickPanels = document.querySelectorAll(".bloomModalContainer");
  previousQuickPanels.forEach((panel) => {
    panel.remove();
  });
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

function addAutoBuyToggleButton(titleContainer) {
  const existingToggleBtn = titleContainer.querySelector(".bloom-auto-buy-toggle");
  if (existingToggleBtn) {
    existingToggleBtn.remove();
  }

  const toggleButton = document.createElement("button");
  toggleButton.classList.add("bloom-auto-buy-toggle");
  toggleButton.style.background = "transparent";
  toggleButton.style.border = "1px solid #96FF98";
  toggleButton.style.color = "#96FF98";
  toggleButton.style.cursor = "pointer";
  toggleButton.style.borderRadius = "4px";
  toggleButton.style.fontWeight = "600";
  toggleButton.style.fontSize = "12px";
  toggleButton.style.display = "inline-flex";
  toggleButton.style.alignItems = "center";
  toggleButton.style.justifyContent = "center";
  toggleButton.style.padding = "4px 8px";
  toggleButton.style.marginLeft = "8px";
  toggleButton.style.whiteSpace = "nowrap";

  toggleButton.addEventListener("mouseenter", () => {
    toggleButton.style.background = "rgba(238, 167, 237, 0.1)";
  });
  toggleButton.addEventListener("mouseleave", () => {
    toggleButton.style.background = "transparent";
  });

  updateToggleButtonText(toggleButton);

  toggleButton.addEventListener("click", (ev) => {
    ev.stopPropagation();
    ev.preventDefault();

    if (autoBuyStartedAt) {
      autoBuyStartedAt = 0;
    } else {
      autoBuyStartedAt = Date.now();
    }
    updateToggleButtonText(toggleButton);
    if (autoBuyStartedAt) {
      showToast(`Auto Buy started with ${autoBuyAmount} SOL!`);
    } else {
      showToast("Auto Buy stopped!");
    }
  });

  insertBefore(titleContainer.firstChild, toggleButton);

  function updateToggleButtonText(btn) {
    if (autoBuyStartedAt) {
      btn.textContent = "Stop Auto Buy";
    } else {
      btn.textContent = "Start Auto Buy";
    }
  }
}
