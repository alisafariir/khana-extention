const KHANA_POPUP_DEFAULTS = {
  siteSettings: {}
};

function getCurrentHost(callback) {
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.url) {
        callback(null);
        return;
      }
      try {
        const url = new URL(tab.url);
        callback(url.hostname);
      } catch (e) {
        callback(null);
      }
    });
  } catch (e) {
    callback(null);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("enabled-toggle");
  const statusLabel = document.getElementById("status-label");
  const siteForceRtlToggle = document.getElementById("site-force-rtl-toggle");

  if (!toggle || !statusLabel || !siteForceRtlToggle) return;

  getCurrentHost((host) => {
    if (!host) {
      toggle.disabled = true;
      statusLabel.textContent = "نامشخص";
      return;
    }

    chrome.storage.local.get(KHANA_POPUP_DEFAULTS, (stored) => {
      const siteSettings = stored.siteSettings || {};
      const site = siteSettings[host] || {};
      const enabled = site.enabled !== false; // پیش‌فرض برای هر سایت: فعال
      const forceRtl = Boolean(site.forceRtl);

      toggle.checked = enabled;
      siteForceRtlToggle.checked = forceRtl;
      statusLabel.textContent = enabled ? "فعال در این سایت" : "غیرفعال در این سایت";
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

          // به صورت صریح به تب فعلی پیام بده تا تنظیمات دوباره اعمال شوند
          try {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              const tab = tabs && tabs[0];
              if (!tab || tab.id == null) return;
              chrome.tabs.sendMessage(tab.id, { type: "khana-reapply" });
            });
          } catch (e) {
            // نادیده بگیر
          }
        });
      });
    });

    siteForceRtlToggle.addEventListener("change", () => {
      const forceRtl = siteForceRtlToggle.checked;

      chrome.storage.local.get(KHANA_POPUP_DEFAULTS, (stored) => {
        const siteSettings = stored.siteSettings || {};
        const current = siteSettings[host] || {};

        siteSettings[host] = {
          ...current,
          forceRtl
        };

        chrome.storage.local.set({ siteSettings }, () => {
          try {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              const tab = tabs && tabs[0];
              if (!tab || tab.id == null) return;
              chrome.tabs.sendMessage(tab.id, { type: "khana-reapply" });
            });
          } catch (e) {
            // نادیده بگیر
          }
        });
      });
    });
  });
});
