const presetListContainer = document.getElementById("presetList");
const presetNameInput = document.getElementById("presetName");
const buyAmountsInput = document.getElementById("buyAmounts");
const sellPercentsInput = document.getElementById("sellPercents");
const buyFeeInput = document.getElementById("buyFee");
const buyTipInput = document.getElementById("buyTip");
const buySlippageInput = document.getElementById("buySlippage");
const sellFeeInput = document.getElementById("sellFee");
const sellTipInput = document.getElementById("sellTip");
const sellSlippageInput = document.getElementById("sellSlippage");
const savePresetButton = document.getElementById("savePreset");
const loadDefaultsButton = document.getElementById("loadDefaults");
const antiMevBuyButtons = document.querySelectorAll('#antiMevBuyOn, #antiMevBuyOff');
const antiMevSellButtons = document.querySelectorAll('#antiMevSellOn, #antiMevSellOff');
const autoTipButtons = document.querySelectorAll('#autoTipOn, #autoTipOff');
const tabButtons = document.querySelectorAll('.tabButton');
const containers = document.querySelectorAll('.settingsContainer');
const limitBuyTipInput = document.getElementById("limitBuyTip");
const limitSellTipInput = document.getElementById("limitSellTip");
const limitBuySlippageInput = document.getElementById("limitBuySlippage");
const limitSellSlippageInput = document.getElementById("limitSellSlippage");
const devSellOnBtn = document.getElementById("devSellOn");
const devSellOffBtn = document.getElementById("devSellOff");
const devSellBtnOn = document.getElementById("devSellBtnOn");
const devSellBtnOff = document.getElementById("devSellBtnOff");
const devSellSlippage = document.getElementById("devSellSlippage");
const devSellBundleTip = document.getElementById("devSellBundleTip");
const devSellAmount = document.getElementById("devSellAmount");
const sitePreferencesListEl = document.getElementById("sitePreferencesList");
const saveSitePreferencesBtn = document.getElementById("saveSitePreferences");

document.addEventListener("DOMContentLoaded", async () => {
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      containers.forEach((c) => c.classList.remove('activeTab'));

      btn.classList.add('active');
      const targetTab = document.getElementById(btn.dataset.tab);
      targetTab.classList.add('activeTab');
    });
  });

  await loadPresets();
  await loadScraperSettings();
  await loadLimitSettings();

  buildSitePreferencesToggles();
  await loadSitePreferences();

  const exportAllSettingsBtn = document.getElementById("exportAllSettings");
  const importAllSettingsBtn = document.getElementById("importAllSettings");
  const importFileInput = document.getElementById("importFileInput");

  if (exportAllSettingsBtn) {
    exportAllSettingsBtn.addEventListener("click", exportAllSettings);
  }
  if (importAllSettingsBtn) {
    importAllSettingsBtn.addEventListener("click", () => {
      importFileInput.click();
    });
  }
  if (importFileInput) {
    importFileInput.addEventListener("change", handleImportFile);
  }

  const devSellButtons = [devSellOnBtn, devSellOffBtn];
  devSellButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      devSellButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      handleDevSellInputsEnabled();
    });
  });

  const devSellBtnButtons = [devSellBtnOn, devSellBtnOff];
  devSellBtnButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      devSellBtnButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      handleDevSellInputsEnabled();
    });
  });

  function handleDevSellInputsEnabled() {
    const isDevSellOn = devSellOnBtn.classList.contains("active");
    const isDevSellBtnOn = devSellBtnOn.classList.contains("active");
    const eitherOn = isDevSellOn || isDevSellBtnOn;

    devSellSlippage.disabled = !eitherOn;
    devSellBundleTip.disabled = !eitherOn;
    devSellAmount.disabled = !eitherOn;

    const devSellSettingsInputs = document.getElementById("devSellSettingsInputs");
    if (!eitherOn) {
      devSellSettingsInputs.classList.add("disabled");
    } else {
      devSellSettingsInputs.classList.remove("disabled");
    }
  }

  handleDevSellInputsEnabled();

  document.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
      createOrUpdatePreset();
    }
  });

  savePresetButton.addEventListener("click", createOrUpdatePreset);
  loadDefaultsButton.addEventListener("click", loadDefaults);

  document.querySelectorAll('.presetToggle').forEach(toggle => {
    const buttons = toggle.querySelectorAll('.toggleBtn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  });

  autoTipButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      autoTipButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document
    .getElementById("saveScraperSettings")
    .addEventListener("click", saveScraperSettings);

  document
    .getElementById("saveLimitSettings")
    .addEventListener("click", saveLimitSettings);

  document
    .getElementById("saveDevSellSettings")
    .addEventListener("click", saveDevSellSettings);

  if (saveSitePreferencesBtn) {
    saveSitePreferencesBtn.addEventListener("click", saveSitePreferences);
  }
});

function getSupportedSites() {
  return [{
    name: "Ape Pro",
    value: "apepro"
  }, {
    name: "Ave.Ai",
    value: "ave"
  }, {
    name: "Axiom",
    value: "axiom"
  }, {
    name: "BullX Neo",
    value: "bullx-neo"
  }, {
    name: "Dexscreener",
    value: "dexscreener"
  }, {
    name: "Discord Web",
    value: "discord"
  }, {
    name: "Telegram Web",
    value: "telegram"
  }, {
    name: "Gmgn",
    value: "gmgn"
  }, {
    name: "Photon",
    value: "photon"
  }, {
    name: "Pumpfun",
    value: "pumpfun"
  }, {
    name: "Solscan",
    value: "solscan"
  }, {
    name: "Twitter",
    value: "twitter"
  }];
}

function buildSitePreferencesToggles() {
  const sites = getSupportedSites();
  sitePreferencesListEl.innerHTML = "";
  sites.forEach(site => {
    const wrapper = document.createElement("div");
    wrapper.classList.add("presetToggle");
    wrapper.style.maxHeight = "25px";

    const label = document.createElement("label");
    label.textContent = site.name;

    const toggleBtns = document.createElement("div");
    toggleBtns.classList.add("toggleButtons");

    const onBtn = document.createElement("button");
    onBtn.classList.add("toggleBtn");
    onBtn.dataset.value = "on";
    onBtn.dataset.site = site.value;
    onBtn.textContent = "On";

    const offBtn = document.createElement("button");
    offBtn.classList.add("toggleBtn");
    offBtn.dataset.value = "off";
    offBtn.dataset.site = site.value;
    offBtn.textContent = "Off";

    toggleBtns.appendChild(onBtn);
    toggleBtns.appendChild(offBtn);

    wrapper.appendChild(label);
    wrapper.appendChild(toggleBtns);

    sitePreferencesListEl.appendChild(wrapper);

    [onBtn, offBtn].forEach(btn => {
      btn.addEventListener("click", () => {
        onBtn.classList.remove("active");
        offBtn.classList.remove("active");
        btn.classList.add("active");
      });
    });
  });
}

async function loadSitePreferences() {
  const stored = await chrome.storage.local.get("bloom.sitePreferences");
  const prefs = stored["bloom.sitePreferences"] || {};

  getSupportedSites().forEach(site => {
    const isEnabled = typeof prefs[site.value] === "boolean" ? prefs[site.value] : true;
    const onBtn = document.querySelector(`.toggleBtn[data-site="${site.value}"][data-value="on"]`);
    const offBtn = document.querySelector(`.toggleBtn[data-site="${site.value}"][data-value="off"]`);
    if (onBtn && offBtn) {
      if (isEnabled) {
        onBtn.classList.add("active");
        offBtn.classList.remove("active");
      } else {
        offBtn.classList.add("active");
        onBtn.classList.remove("active");
      }
    }
  });
}

async function saveSitePreferences() {
  const prefs = {};
  getSupportedSites().forEach(site => {
    const onBtn = document.querySelector(`.toggleBtn[data-site="${site.value}"][data-value="on"]`);
    const offBtn = document.querySelector(`.toggleBtn[data-site="${site.value}"][data-value="off"]`);
    if (!onBtn || !offBtn) return;

    const isOn = onBtn.classList.contains("active");
    prefs[site.value] = isOn;
  });

  await chrome.storage.local.set({ "bloom.sitePreferences": prefs });
  showToast("Site preferences saved successfully!");
}

async function createOrUpdatePreset() {
  let stored = await chrome.storage.local.get("bloom.presets");
  let bloomPresets = stored['bloom.presets'] || [];
  const label = presetNameInput.value.trim();
  if (!label) {
    showToast("Please enter a valid preset label", true);
    return;
  }

  let buyAmountsArr = [];
  if (buyAmountsInput.value.trim()) {
    buyAmountsArr = buyAmountsInput.value.split(",").map((val) => {
      try {
        const num = parseFloat(val.trim());
        if (isNaN(num)) {
          throw new Error("Invalid number");
        }
        return num;
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  }

  let sellPercentsArr = [];
  if (sellPercentsInput.value.trim()) {
    sellPercentsArr = sellPercentsInput.value.split(",").map((val) => {
      try {
        const num = parseFloat(val.trim());
        if (isNaN(num)) {
          throw new Error("Invalid number");
        }
        return num;
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  }
  const buyFee = parseFloat(buyFeeInput.value);
  if (isNaN(buyFee)) {
    showToast("Please enter a valid buy fee", true);
    return;
  }
  const buyTip = parseFloat(buyTipInput.value);
  if (isNaN(buyTip)) {
    showToast("Please enter a valid buy tip", true);
    return;
  }
  const buySlippage = parseFloat(buySlippageInput.value);
  if (isNaN(buySlippage)) {
    showToast("Please enter a valid buy slippage", true);
    return;
  }
  const sellFee = parseFloat(sellFeeInput.value);
  if (isNaN(sellFee)) {
    showToast("Please enter a valid sell fee", true);
    return;
  }
  const sellTip = parseFloat(sellTipInput.value);
  if (isNaN(sellTip)) {
    showToast("Please enter a valid sell tip", true);
    return;
  }
  const sellSlippage = parseFloat(sellSlippageInput.value);
  if (isNaN(sellSlippage)) {
    showToast("Please enter a valid sell slippage", true);
    return;
  }

  const newPreset = {
    label: label,
    values: {
      "buy-amounts": buyAmountsArr,
      "sell-percents": sellPercentsArr,
      "buy-fee": buyFee,
      "buy-tip": buyTip,
      "buy-slippage": buySlippage,
      "sell-fee": sellFee,
      "sell-tip": sellTip,
      "sell-slippage": sellSlippage,
      "buy-anti-mev": document.querySelector('#antiMevBuyOn.active, #antiMevBuyOff.active').dataset.value === 'on',
      "sell-anti-mev": document.querySelector('#antiMevSellOn.active, #antiMevSellOff.active').dataset.value === 'on',
      "auto-tip": document.querySelector('#autoTipOn.active, #autoTipOff.active').dataset.value === 'on'
    },
  };
  let idx = bloomPresets.findIndex((p) => p.label === label);
  if (idx >= 0) {
    bloomPresets[idx] = newPreset;
  } else {
    bloomPresets.push(newPreset);
  }
  await chrome.storage.local.set({ 'bloom.presets': bloomPresets });
  await loadPresets();
  showToast("Preset saved successfully!");
  clearInputs();
}

async function loadPresets() {
  presetListContainer.innerHTML = "";
  let { 'bloom.presets': bloomPresets } = await chrome.storage.local.get("bloom.presets");
  if (!Array.isArray(bloomPresets)) {
    bloomPresets = [];
  }

  if (bloomPresets.length === 0) {
    presetListContainer.innerHTML = "<div class='noPresetsMsg'>No presets found. Create one above.</div>";
    return;
  }

  bloomPresets.forEach((pst, index) => {
    const card = document.createElement("div");
    card.classList.add("presetCard");

    if (pst.values["anti-mev"]) {
      pst.values["buy-anti-mev"] = pst.values["anti-mev"];
      pst.values["sell-anti-mev"] = pst.values["anti-mev"];
      delete pst.values["anti-mev"];
    }

    const content = document.createElement("div");
    content.classList.add("presetContent");
    content.innerHTML = `
      <div style="font-size: 16px; color: #96FF98; margin-bottom: 6px;">
        ${pst.label}
      </div>
      <div style="font-size: 12px; color: #dddf; margin-bottom: 2px;">
        Buy Amounts: [${(pst.values["buy-amounts"] || []).join(", ")}]
      </div>
      <div style="font-size: 12px; color: #dddf; margin-bottom: 2px;">
        Sell %: [${(pst.values["sell-percents"] || []).join(", ")}]
      </div>
      <div style="font-size: 12px; color: #dddf;">
        Anti-MEV (Buy|Sell): 
        ${pst.values["buy-anti-mev"] ? "On" : "Off"} | 
        ${pst.values["sell-anti-mev"] ? "On" : "Off"}
      </div>
    `;

    const actions = document.createElement("div");
    actions.classList.add("presetActions");

    const deleteBtn = document.createElement("button");
    deleteBtn.classList.add("presetButton", "deleteBtn");
    deleteBtn.textContent = "Del";
    deleteBtn.title = "Delete this preset permanently";
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const confirmed = confirm(
        `Do you really want to delete preset: "${pst.label}"?`
      );
      if (!confirmed) return;
      bloomPresets.splice(index, 1);
      await chrome.storage.local.set({ 'bloom.presets': bloomPresets });
      await loadPresets();
      showToast(`Preset "${pst.label}" deleted`);
    });

    actions.appendChild(deleteBtn);
    card.appendChild(content);
    card.appendChild(actions);

    card.onclick = () => {
      loadIntoForm(pst);
    };
    presetListContainer.appendChild(card);
  });
}

function loadIntoForm(preset) {
  presetNameInput.value = preset.label;
  buyAmountsInput.value = (preset.values["buy-amounts"] || []).join(", ");
  sellPercentsInput.value = (preset.values["sell-percents"] || []).join(", ");
  buyFeeInput.value = preset.values["buy-fee"];
  buyTipInput.value = preset.values["buy-tip"];
  buySlippageInput.value = preset.values["buy-slippage"];
  sellFeeInput.value = preset.values["sell-fee"];
  sellTipInput.value = preset.values["sell-tip"];
  sellSlippageInput.value = preset.values["sell-slippage"];

  const antiMevBuyValue = preset.values["buy-anti-mev"] ?? false;
  antiMevBuyButtons.forEach(btn => {
    btn.classList.toggle('active',
      (btn.dataset.value === 'on' && antiMevBuyValue) ||
      (btn.dataset.value === 'off' && !antiMevBuyValue)
    );
  });

  const antiMevSellValue = preset.values["sell-anti-mev"] ?? false;
  antiMevSellButtons.forEach(btn => {
    btn.classList.toggle('active',
      (btn.dataset.value === 'on' && antiMevSellValue) ||
      (btn.dataset.value === 'off' && !antiMevSellValue)
    );
  });

  const autoTipValue = preset.values["auto-tip"] ?? true;
  autoTipButtons.forEach(btn => {
    btn.classList.toggle('active',
      (btn.dataset.value === 'on' && autoTipValue) ||
      (btn.dataset.value === 'off' && !autoTipValue)
    );
  });

  showToast(`Preset "${preset.label}" loaded for editing`);
}

function clearInputs() {
  presetNameInput.value = "";
  buyAmountsInput.value = "";
  sellPercentsInput.value = "";
  buyFeeInput.value = "";
  buyTipInput.value = "";
  buySlippageInput.value = "";
  sellFeeInput.value = "";
  sellTipInput.value = "";
  sellSlippageInput.value = "";
}

async function loadDefaults() {
  let { 'bloom.presets': bloomPresets } = await chrome.storage.local.get("bloom.presets");
  if (!Array.isArray(bloomPresets)) {
    bloomPresets = [];
  }

  presetNameInput.value = `Preset ${bloomPresets.length + 1}`;
  buyAmountsInput.value = "0.5, 1, 2, 5, 10";
  sellPercentsInput.value = "10, 20, 50, 100";
  buyFeeInput.value = 0.005;
  buyTipInput.value = 0.01;
  buySlippageInput.value = 20;
  sellFeeInput.value = 0.005;
  sellTipInput.value = 0.01;
  sellSlippageInput.value = 20;

  antiMevBuyButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === 'on');
  });
  antiMevSellButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === 'on');
  });
  autoTipButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === 'on');
  });

  showToast("Default values loaded");
}

function showToast(message, isError = false) {
  const existingToasts = document.querySelectorAll(".toast");
  existingToasts.forEach((t) => t.remove());

  const toast = document.createElement("div");
  toast.classList.add("toast");

  if (isError) {
    toast.style.borderColor = "#ff6b6b";
    toast.style.color = "#ff6b6b";
    toast.textContent = "⚠️ " + message;
  } else {
    toast.style.borderColor = "#96FF98";
    toast.style.color = "#96FF98";
    toast.textContent = "🚀 " + message;
  }

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity 0.5s ease-out";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

async function saveScraperSettings() {
  const discordAutoBuyAmountInput = document.getElementById("discordAutoBuyAmount");
  const telegramAutoBuyAmountInput = document.getElementById("telegramAutoBuyAmount");

  const discordAutoBuyVal = parseFloat(discordAutoBuyAmountInput.value);
  const telegramAutoBuyVal = parseFloat(telegramAutoBuyAmountInput.value);
  const skipContract = document.querySelector("#skipContractOn.active, #skipContractOff.active")?.dataset.value === "on";

  if (isNaN(discordAutoBuyVal)) {
    showToast("Please enter a valid Discord Auto Buy Amount", true);
    return;
  }

  if (isNaN(telegramAutoBuyVal)) {
    showToast("Please enter a valid Telegram Auto Buy Amount", true);
    return;
  }

  const scraperSettings = {
    discordAutoBuyAmount: discordAutoBuyVal,
    telegramAutoBuyAmount: telegramAutoBuyVal,
    skipContractIfBought: skipContract,
  };

  await chrome.storage.local.set({ "bloom.scraperSettings": scraperSettings });
  await chrome.runtime.sendMessage({ message: "scraperAmount" });
  showToast("Scraper settings saved successfully!");
}

async function loadScraperSettings() {
  const stored = await chrome.storage.local.get("bloom.scraperSettings");
  const scraperSettings = stored["bloom.scraperSettings"] || {};

  const discordAutoBuyInput = document.getElementById("discordAutoBuyAmount");
  const telegramAutoBuyInput = document.getElementById("telegramAutoBuyAmount");
  const skipContractOnBtn = document.getElementById("skipContractOn");
  const skipContractOffBtn = document.getElementById("skipContractOff");

  discordAutoBuyInput.value = scraperSettings.discordAutoBuyAmount ?? "";
  telegramAutoBuyInput.value = scraperSettings.telegramAutoBuyAmount ?? "";

  const skipIsOn = scraperSettings.skipContractIfBought ?? false;
  skipContractOnBtn.classList.toggle("active", skipIsOn);
  skipContractOffBtn.classList.toggle("active", !skipIsOn);
}

async function saveLimitSettings() {
  const limitBuyTipVal = parseFloat(limitBuyTipInput.value);
  const limitSellTipVal = parseFloat(limitSellTipInput.value);
  const limitBuySlippageVal = parseFloat(limitBuySlippageInput.value);
  const limitSellSlippageVal = parseFloat(limitSellSlippageInput.value);

  if (isNaN(limitBuyTipVal) || limitBuyTipVal <= 0) {
    showToast("Please enter a valid Limit Buy Tip", true);
    return;
  }
  if (isNaN(limitSellTipVal) || limitSellTipVal <= 0) {
    showToast("Please enter a valid Limit Sell Tip", true);
    return;
  }
  if (isNaN(limitBuySlippageVal) || limitBuySlippageVal <= 0) {
    showToast("Please enter a valid Limit Buy Slippage", true);
    return;
  }
  if (isNaN(limitSellSlippageVal) || limitSellSlippageVal <= 0) {
    showToast("Please enter a valid Limit Sell Slippage", true);
    return;
  }

  const limitSettings = {
    limitBuyTip: limitBuyTipVal,
    limitSellTip: limitSellTipVal,
    limitBuySlippage: limitBuySlippageVal,
    limitSellSlippage: limitSellSlippageVal
  };

  await chrome.storage.local.set({ "bloom.limitSettings": limitSettings });
  showToast("Limit settings saved successfully!");
}

async function saveDevSellSettings() {
  const devSellEnabled = devSellOnBtn.classList.contains("active");
  const devSellBtnEnabled = devSellBtnOn.classList.contains("active");
  const eitherEnabled = devSellEnabled || devSellBtnEnabled;

  const devSellSlippageVal = parseFloat(devSellSlippage.value);
  const devSellBundleTipVal = parseFloat(devSellBundleTip.value);
  const devSellAmountVal = parseFloat(devSellAmount.value);

  if (eitherEnabled) {
    if (isNaN(devSellSlippageVal)) {
      showToast("Please enter a valid Dev Sell Slippage", true);
      return;
    }
    if (isNaN(devSellBundleTipVal)) {
      showToast("Please enter a valid Dev Sell Bundle Tip", true);
      return;
    }
    if (isNaN(devSellAmountVal)) {
      showToast("Please enter a valid Dev Sell Amount", true);
      return;
    }
  }

  const devSellSettings = {
    enabled: devSellEnabled,
    btnEnabled: devSellBtnEnabled,
    slippage: eitherEnabled ? devSellSlippageVal : null,
    bundleTip: eitherEnabled ? devSellBundleTipVal : null,
    amount: eitherEnabled ? devSellAmountVal : null
  };

  await chrome.storage.local.set({ "bloom.devSellSettings": devSellSettings });
  showToast("Dev sell settings saved successfully!");
}

async function loadLimitSettings() {
  const stored = await chrome.storage.local.get("bloom.limitSettings");
  const limitSettings = stored["bloom.limitSettings"] || {};

  if (typeof limitSettings.limitBuyTip !== "undefined") {
    limitBuyTipInput.value = limitSettings.limitBuyTip;
  }
  if (typeof limitSettings.limitSellTip !== "undefined") {
    limitSellTipInput.value = limitSettings.limitSellTip;
  }
  if (typeof limitSettings.limitBuySlippage !== "undefined") {
    limitBuySlippageInput.value = limitSettings.limitBuySlippage;
  }
  if (typeof limitSettings.limitSellSlippage !== "undefined") {
    limitSellSlippageInput.value = limitSettings.limitSellSlippage;
  }

  const devStored = await chrome.storage.local.get("bloom.devSellSettings");
  const devSellSettings = devStored["bloom.devSellSettings"] || {};

  const isEnabled = devSellSettings.enabled ?? false;
  const btnEnabled = devSellSettings.btnEnabled ?? false;

  devSellOnBtn.classList.toggle("active", isEnabled);
  devSellOffBtn.classList.toggle("active", !isEnabled);

  devSellBtnOn.classList.toggle("active", btnEnabled);
  devSellBtnOff.classList.toggle("active", !btnEnabled);

  const eitherEnabled = isEnabled || btnEnabled;
  if (eitherEnabled) {
    devSellSlippage.value = devSellSettings.slippage ?? "";
    devSellBundleTip.value = devSellSettings.bundleTip ?? "";
    devSellAmount.value = devSellSettings.amount ?? "";
  }

  devSellSlippage.disabled = !eitherEnabled;
  devSellBundleTip.disabled = !eitherEnabled;
  devSellAmount.disabled = !eitherEnabled;

  const devSellSettingsInputs = document.getElementById("devSellSettingsInputs");
  if (!eitherEnabled) {
    devSellSettingsInputs.classList.add("disabled");
  } else {
    devSellSettingsInputs.classList.remove("disabled");
  }
}

async function exportAllSettings() {
  try {
    const presetData = await chrome.storage.local.get("bloom.presets");
    const scraperData = await chrome.storage.local.get("bloom.scraperSettings");
    const limitData = await chrome.storage.local.get("bloom.limitSettings");
    const devSellData = await chrome.storage.local.get("bloom.devSellSettings");
    const sitePrefsData = await chrome.storage.local.get("bloom.sitePreferences");

    const allData = {
      "bloom.presets": presetData["bloom.presets"] || [],
      "bloom.scraperSettings": scraperData["bloom.scraperSettings"] || {},
      "bloom.limitSettings": limitData["bloom.limitSettings"] || {},
      "bloom.devSellSettings": devSellData["bloom.devSellSettings"] || {},
      "bloom.sitePreferences": sitePrefsData["bloom.sitePreferences"] || {}
    };

    const jsonStr = JSON.stringify(allData, null, 2);
    downloadToFile(jsonStr, "bloom_settings.json", "application/json");
    showToast("All settings exported successfully!");
  } catch (err) {
    console.error("Error exporting settings:", err);
    showToast("Failed to export settings", true);
  }
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const importedJson = JSON.parse(e.target.result);
      await importAllSettings(importedJson);
      showToast("All settings imported successfully!");
      await loadPresets();
      await loadScraperSettings();
      await loadLimitSettings();
      await loadSitePreferences();
    } catch (err) {
      console.error("Failed to import settings:", err);
      showToast("Failed to import settings: " + err.message, true);
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

async function importAllSettings(jsonData) {
  const {
    "bloom.presets": presets,
    "bloom.scraperSettings": scraperSettings,
    "bloom.limitSettings": limitSettings,
    "bloom.devSellSettings": devSellSettings,
    "bloom.sitePreferences": sitePreferences
  } = jsonData;

  if (typeof presets !== "undefined") {
    if (!Array.isArray(presets)) {
      showToast("Import error: 'bloom.presets' must be an array. Skipping preset import.", true);
    } else {
      const validPresets = [];
      for (const preset of presets) {
        if (!preset || typeof preset !== "object") {
          showToast("Import error: One preset is not an object. Skipping it.", true);
          continue;
        }
        if (!preset.label || typeof preset.label !== "string") {
          showToast("Import error: One preset is missing a 'label' string. Skipping it.", true);
          continue;
        }
        if (!preset.values || typeof preset.values !== "object") {
          showToast(`Import error: Preset "${preset.label}" is missing 'values'. Skipping it.`, true);
          continue;
        }
        if ("anti-mev" in preset.values) {
          const oldVal = preset.values["anti-mev"];
          preset.values["buy-anti-mev"] = oldVal;
          preset.values["sell-anti-mev"] = oldVal;
          delete preset.values["anti-mev"];
        }
        if ("sell-initials" in preset.values) {
          delete preset.values["sell-initials"];
        }
        validPresets.push(preset);
      }
      if (validPresets.length) {
        await chrome.storage.local.set({ "bloom.presets": validPresets });
      }
    }
  }

  if (typeof scraperSettings !== "undefined") {
    if (!scraperSettings || typeof scraperSettings !== "object") {
      showToast("Import error: 'bloom.scraperSettings' must be an object. Skipping.", true);
    } else {
      const validScraperSettings = {};
      if (
        typeof scraperSettings.discordAutoBuyAmount === "number" &&
        !isNaN(scraperSettings.discordAutoBuyAmount)
      ) {
        validScraperSettings.discordAutoBuyAmount = scraperSettings.discordAutoBuyAmount;
      } else if (typeof scraperSettings.discordAutoBuyAmount !== "undefined") {
        showToast("Import error: 'discordAutoBuyAmount' invalid. Skipping this field.", true);
      }
      if (
        typeof scraperSettings.telegramAutoBuyAmount === "number" &&
        !isNaN(scraperSettings.telegramAutoBuyAmount)
      ) {
        validScraperSettings.telegramAutoBuyAmount = scraperSettings.telegramAutoBuyAmount;
      } else if (typeof scraperSettings.telegramAutoBuyAmount !== "undefined") {
        showToast("Import error: 'telegramAutoBuyAmount' invalid. Skipping this field.", true);
      }
      if (typeof scraperSettings.skipContractIfBought === "boolean") {
        validScraperSettings.skipContractIfBought = scraperSettings.skipContractIfBought;
      } else if (typeof scraperSettings.skipContractIfBought !== "undefined") {
        showToast("Import error: 'skipContractIfBought' invalid. Skipping this field.", true);
      }
      if (Object.keys(validScraperSettings).length) {
        await chrome.storage.local.set({ "bloom.scraperSettings": validScraperSettings });
        await chrome.runtime.sendMessage({ message: "scraperAmount" });
      }
    }
  }

  if (typeof limitSettings !== "undefined") {
    if (!limitSettings || typeof limitSettings !== "object") {
      showToast("Import error: 'bloom.limitSettings' must be an object. Skipping.", true);
    } else {
      const validLimitSettings = {};
      const keys = ["limitBuyTip", "limitSellTip", "limitBuySlippage", "limitSellSlippage"];
      for (const key of keys) {
        if (typeof limitSettings[key] === "number" && !isNaN(limitSettings[key])) {
          validLimitSettings[key] = limitSettings[key];
        } else if (typeof limitSettings[key] !== "undefined") {
          showToast(`Import error: '${key}' invalid. Skipping.`, true);
        }
      }
      if (Object.keys(validLimitSettings).length) {
        await chrome.storage.local.set({ "bloom.limitSettings": validLimitSettings });
      }
    }
  }

  if (typeof devSellSettings !== "undefined") {
    if (!devSellSettings || typeof devSellSettings !== "object") {
      showToast("Import error: 'bloom.devSellSettings' must be an object. Skipping.", true);
    } else {
      const validDevSellSettings = {};
      if (typeof devSellSettings.enabled === "boolean") {
        validDevSellSettings.enabled = devSellSettings.enabled;
        if (devSellSettings.enabled) {
          for (const key of ["slippage", "bundleTip", "amount"]) {
            if (typeof devSellSettings[key] === "number" && !isNaN(devSellSettings[key])) {
              validDevSellSettings[key] = devSellSettings[key];
            } else if (typeof devSellSettings[key] !== "undefined") {
              showToast(`Import error: 'devSellSettings.${key}' invalid. Skipping.`, true);
            }
          }
        }
      } else if (typeof devSellSettings.enabled !== "undefined") {
        showToast("Import error: 'devSellSettings.enabled' must be boolean. Skipping entire devSellSettings.", true);
      }
      if (Object.keys(validDevSellSettings).length) {
        await chrome.storage.local.set({ "bloom.devSellSettings": validDevSellSettings });
      }
    }
  }

  if (typeof sitePreferences !== "undefined") {
    if (!sitePreferences || typeof sitePreferences !== "object") {
      showToast("Import error: 'bloom.sitePreferences' must be an object. Skipping.", true);
    } else {
      const validPrefs = {};
      for (const site of Object.keys(sitePreferences)) {
        if (typeof sitePreferences[site] === "boolean") {
          validPrefs[site] = sitePreferences[site];
        } else {
          showToast(`Import error: preference for '${site}' is not boolean. Skipping.`, true);
        }
      }
      if (Object.keys(validPrefs).length) {
        await chrome.storage.local.set({ "bloom.sitePreferences": validPrefs });
      }
    }
  }
}

function downloadToFile(content, filename, contentType) {
  const a = document.createElement("a");
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = filename;
  a.click();
}