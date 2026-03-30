const KHANA_POPUP_DEFAULTS = {
  siteSettings: {},
  forceRtl: false,
  convertNumbers: false
};

function getCurrentTab(callback) {
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      callback(tabs && tabs[0] || null);
    });
  } catch (e) {
    callback(null);
  }
}

function getCurrentHost(callback) {
  getCurrentTab((tab) => {
    if (!tab || !tab.url) {
      callback(null, tab);
      return;
    }
    try {
      const url = new URL(tab.url);
      callback(url.hostname, tab);
    } catch (e) {
      callback(null, tab);
    }
  });
}

function isNormalWebUrl(url) {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("enabled-toggle");
  const statusLabel = document.getElementById("status-label");
  const siteForceRtlToggle = document.getElementById("site-force-rtl-toggle");
  const pickRtlSectionBtn = document.getElementById("pick-rtl-section-btn");

  const rtlSelectorsList = document.getElementById("rtl-selectors-list");
  const siteConvertNumbersToggle = document.getElementById("site-convert-numbers-toggle");
  const defaultForceRtlToggle = document.getElementById("default-force-rtl-toggle");
  const defaultConvertNumbersToggle = document.getElementById("default-convert-numbers-toggle");

  if (!toggle || !statusLabel || !siteForceRtlToggle || !pickRtlSectionBtn || !rtlSelectorsList ||
      !siteConvertNumbersToggle || !defaultForceRtlToggle || !defaultConvertNumbersToggle) return;

  function renderRtlSelectors(host, list) {
    rtlSelectorsList.innerHTML = "";
    if (!list || list.length === 0) return;
    const title = document.createElement("div");
    title.textContent = "بخش‌های راست‌چین شده برای این سایت:";
    title.style.marginBottom = "4px";
    rtlSelectorsList.appendChild(title);
    list.forEach((sel) => {
      const item = document.createElement("div");
      item.className = "item";
      const span = document.createElement("span");
      span.className = "sel";
      span.title = sel;
      span.textContent = sel;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "remove";
      btn.textContent = "×";
      btn.title = "حذف";
      btn.addEventListener("click", () => {
        chrome.storage.local.get(KHANA_POPUP_DEFAULTS, (stored) => {
          const siteSettings = stored.siteSettings || {};
          const site = siteSettings[host] || {};
          const arr = (site.rtlSelectors || []).filter((s) => s !== sel);
          siteSettings[host] = { ...site, rtlSelectors: arr };
          chrome.storage.local.set({ siteSettings }, () => {
            renderRtlSelectors(host, arr);
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              const t = tabs && tabs[0];
              if (t && t.id != null) chrome.tabs.sendMessage(t.id, { type: "khana-reapply" });
            });
          });
        });
      });
      item.appendChild(span);
      item.appendChild(btn);
      rtlSelectorsList.appendChild(item);
    });
  }

  getCurrentHost((host, tab) => {
    if (!host) {
      toggle.disabled = true;
      pickRtlSectionBtn.disabled = true;
      statusLabel.textContent = "نامشخص";
      return;
    }
    if (!isNormalWebUrl(tab && tab.url)) {
      pickRtlSectionBtn.disabled = true;
    }

    function reapplyToCurrentTab() {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const t = tabs && tabs[0];
          if (t && t.id != null) chrome.tabs.sendMessage(t.id, { type: "khana-reapply" });
        });
      } catch (e) {}
    }

    chrome.storage.local.get(KHANA_POPUP_DEFAULTS, (stored) => {
      const siteSettings = stored.siteSettings || {};
      const site = siteSettings[host] || {};
      const enabled = site.enabled !== false;
      const forceRtl = Boolean(site.forceRtl);
      const convertNumbers = typeof site.convertNumbers !== "undefined" ? site.convertNumbers : stored.convertNumbers;
      const rtlSelectors = site.rtlSelectors || [];

      toggle.checked = enabled;
      siteForceRtlToggle.checked = forceRtl;
      siteConvertNumbersToggle.checked = Boolean(convertNumbers);
      defaultForceRtlToggle.checked = Boolean(stored.forceRtl);
      defaultConvertNumbersToggle.checked = Boolean(stored.convertNumbers);
      statusLabel.textContent = enabled ? "فعال در این سایت" : "غیرفعال در این سایت";
      renderRtlSelectors(host, rtlSelectors);
    });

    toggle.addEventListener("change", () => {
      const enabled = toggle.checked;

      chrome.storage.local.get(KHANA_POPUP_DEFAULTS, (stored) => {
        const siteSettings = stored.siteSettings || {};
        const current = siteSettings[host] || {};

        siteSettings[host] = {
          ...current,
          enabled
        };

        chrome.storage.local.set({ siteSettings }, () => {
          statusLabel.textContent = enabled ? "فعال در این سایت" : "غیرفعال در این سایت";
          reapplyToCurrentTab();
        });
      });
    });

    siteForceRtlToggle.addEventListener("change", () => {
      const forceRtl = siteForceRtlToggle.checked;
      chrome.storage.local.get(KHANA_POPUP_DEFAULTS, (stored) => {
        const siteSettings = stored.siteSettings || {};
        const current = siteSettings[host] || {};
        siteSettings[host] = { ...current, forceRtl };
        chrome.storage.local.set({ siteSettings }, reapplyToCurrentTab);
      });
    });

    siteConvertNumbersToggle.addEventListener("change", () => {
      const convertNumbers = siteConvertNumbersToggle.checked;
      chrome.storage.local.get(KHANA_POPUP_DEFAULTS, (stored) => {
        const siteSettings = stored.siteSettings || {};
        const current = siteSettings[host] || {};
        siteSettings[host] = { ...current, convertNumbers };
        chrome.storage.local.set({ siteSettings }, reapplyToCurrentTab);
      });
    });

    defaultForceRtlToggle.addEventListener("change", () => {
      chrome.storage.local.set({ forceRtl: defaultForceRtlToggle.checked }, reapplyToCurrentTab);
    });
    defaultConvertNumbersToggle.addEventListener("change", () => {
      chrome.storage.local.set({ convertNumbers: defaultConvertNumbersToggle.checked }, reapplyToCurrentTab);
    });

    pickRtlSectionBtn.addEventListener("click", () => {
      getCurrentTab((t) => {
        if (!t || t.id == null || !isNormalWebUrl(t.url)) return;
        chrome.tabs.sendMessage(t.id, { type: "khana-start-picker" }, () => {
          if (chrome.runtime.lastError) {
            pickRtlSectionBtn.textContent = "صفحه را رفرش کنید و دوباره امتحان کنید";
            setTimeout(() => { pickRtlSectionBtn.textContent = "انتخاب بخش صفحه برای راست‌چین"; }, 2000);
          }
        });
      });
    });
  });
});
