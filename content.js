// Default settings
const KHANA_DEFAULTS = {
  fontSize: 100,   // percentage
  lineHeight: 1.8, // unitless
  convertNumbers: false,
  siteSettings: {}, // hostname -> { enabled: boolean }
  forceRtl: false
};

const BASE_CSS_ID = "khana-base-css";
const DYNAMIC_STYLE_ID = "khana-dynamic-style";

// Number conversion helpers
const KHANA_DIGIT_MAP = {
  "0": "\u06F0",
  "1": "\u06F1",
  "2": "\u06F2",
  "3": "\u06F3",
  "4": "\u06F4",
  "5": "\u06F5",
  "6": "\u06F6",
  "7": "\u06F7",
  "8": "\u06F8",
  "9": "\u06F9"
};

function KHANAConvertDigitsToPersian(str) {
  return str.replace(/[0-9]/g, (d) => KHANA_DIGIT_MAP[d] || d);
}

const KHANAProcessedTextNodes = new WeakSet();
let KHANANumberObserver = null;
let KHANANumbersEnabled = false;

const KHANAPersianTextNodes = new WeakSet();
let KHANALangObserver = null;
let KHANAOriginalDir = null;

function KHANAHasPersianChars(str) {
  return /[\u0600-\u06FF]/.test(str);
}

function KHANAMarkLangForTextNode(node) {
  if (!node || KHANAPersianTextNodes.has(node)) return;
  const value = node.nodeValue;
  if (!value || !KHANAHasPersianChars(value)) return;

  const el = node.parentElement;
  if (!el) return;

  // فقط اگر خود المان lang ندارد، آن را fa می‌کنیم
  if (!el.hasAttribute("lang")) {
    el.setAttribute("lang", "fa");
  }

  KHANAPersianTextNodes.add(node);
}

function KHANAWalkAndMarkLang(root) {
  if (!root) return;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue || !KHANAHasPersianChars(node.nodeValue)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let node;
  // eslint-disable-next-line no-cond-assign
  while ((node = walker.nextNode())) {
    KHANAMarkLangForTextNode(node);
  }
}

function isSiteEnabled(settings) {
  try {
    const host = window.location.hostname || "";
    const siteSettings = settings.siteSettings || {};
    const site = siteSettings[host];
    if (!site || typeof site.enabled === "undefined") {
      return true; // پیش‌فرض: برای هر سایت فعال است
    }
    return Boolean(site.enabled);
  } catch (e) {
    return true;
  }
}

function getCurrentSiteConfig(settings) {
  try {
    const host = window.location.hostname || "";
    const siteSettings = settings.siteSettings || {};
    return siteSettings[host] || {};
  } catch (e) {
    return {};
  }
}

// Helper to get merged settings with defaults
function getSettings(callback) {
  chrome.storage.local.get(KHANA_DEFAULTS, (stored) => {
    const settings = {
      ...KHANA_DEFAULTS,
      ...stored
    };
    callback(settings);
  });
}

function injectBaseCss() {
  if (document.getElementById(BASE_CSS_ID)) return;

  const link = document.createElement("link");
  link.id = BASE_CSS_ID;
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = chrome.runtime.getURL("inject.css");

  (document.head || document.documentElement).appendChild(link);
}

function removeBaseCss() {
  const link = document.getElementById(BASE_CSS_ID);
  if (link && link.parentNode) {
    link.parentNode.removeChild(link);
  }
}

// فقط font-family از inject.css اعمال می‌شود؛ font-size و line-height دست‌نخورده می‌مانند.
function updateDynamicStyles() {
  removeDynamicStyles();
}

function removeDynamicStyles() {
  const styleEl = document.getElementById(DYNAMIC_STYLE_ID);
  if (styleEl && styleEl.parentNode) {
    styleEl.parentNode.removeChild(styleEl);
  }
}

function KHANAProcessTextNode(node) {
  if (!node || KHANAProcessedTextNodes.has(node)) return;
  const value = node.nodeValue;
  if (!value || !/[0-9]/.test(value)) return;
  node.nodeValue = KHANAConvertDigitsToPersian(value);
  KHANAProcessedTextNodes.add(node);
}

function KHANAWalkAndConvert(root) {
  if (!root) return;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue || !/[0-9]/.test(node.nodeValue)) {
          return NodeFilter.FILTER_REJECT;
        }
        const el = node.parentElement;
        if (!el) return NodeFilter.FILTER_REJECT;
        if (el.closest(':lang(fa),[lang^="fa"]')) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );

  let node;
  // eslint-disable-next-line no-cond-assign
  while ((node = walker.nextNode())) {
    KHANAProcessTextNode(node);
  }
}

function enableLangDetection() {
  if (!document.body) return;

  // یک‌بار روی محتوای موجود اعمال می‌کنیم
  KHANAWalkAndMarkLang(document.body);

  if (KHANALangObserver) return;

  KHANALangObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
        KHANAMarkLangForTextNode(mutation.target);
      } else if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            KHANAMarkLangForTextNode(node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            KHANAWalkAndMarkLang(node);
          }
        });
      }
    }
  });

  KHANALangObserver.observe(document.body, {
    characterData: true,
    childList: true,
    subtree: true
  });
}

function disableLangDetection() {
  if (KHANALangObserver) {
    KHANALangObserver.disconnect();
    KHANALangObserver = null;
  }
}

function enableNumberConversion() {
  if (KHANANumbersEnabled) return;
  KHANANumbersEnabled = true;

  // Initial pass over existing Persian content
  document
    .querySelectorAll(':lang(fa),[lang^="fa"]')
    .forEach((el) => KHANAWalkAndConvert(el));

  if (KHANANumberObserver || !document.body) return;

  KHANANumberObserver = new MutationObserver((mutations) => {
    if (!KHANANumbersEnabled) return;

    for (const mutation of mutations) {
      if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
        const el = mutation.target.parentElement;
        if (el && el.closest(':lang(fa),[lang^="fa"]')) {
          KHANAProcessTextNode(mutation.target);
        }
      } else if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const el = node.parentElement;
            if (el && el.closest(':lang(fa),[lang^="fa"]')) {
              KHANAProcessTextNode(node);
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node;
            if (el.matches(':lang(fa),[lang^="fa"]') || el.closest(':lang(fa),[lang^="fa"]')) {
              KHANAWalkAndConvert(el);
            }
          }
        });
      }
    }
  });

  KHANANumberObserver.observe(document.body, {
    characterData: true,
    childList: true,
    subtree: true
  });
}

function disableNumberConversion() {
  KHANANumbersEnabled = false;
  if (KHANANumberObserver) {
    KHANANumberObserver.disconnect();
    KHANANumberObserver = null;
  }
}

function applySettings(settings) {
  if (!isSiteEnabled(settings)) {
    removeBaseCss();
    removeDynamicStyles();
    disableNumberConversion();
    disableLangDetection();

    // بازگرداندن جهت اولیه صفحه
    if (KHANAOriginalDir !== null && document.documentElement) {
      if (KHANAOriginalDir === "") {
        document.documentElement.removeAttribute("dir");
      } else {
        document.documentElement.setAttribute("dir", KHANAOriginalDir);
      }
    }
    return;
  }

  injectBaseCss();
  updateDynamicStyles();

  // همیشه روی سایت‌های فعال، متن فارسی را تشخیص می‌دهیم و lang را fa می‌کنیم
  enableLangDetection();

  // جهت صفحه (ترکیب تنظیم سراسری و تنظیم مخصوص هر سایت)
  if (document.documentElement) {
    if (KHANAOriginalDir === null) {
      KHANAOriginalDir = document.documentElement.getAttribute("dir") || "";
    }

    const siteConfig = getCurrentSiteConfig(settings);
    const effectiveForceRtl =
      typeof siteConfig.forceRtl !== "undefined"
        ? siteConfig.forceRtl
        : settings.forceRtl;

    if (effectiveForceRtl) {
      document.documentElement.setAttribute("dir", "rtl");
    } else if (KHANAOriginalDir !== null) {
      if (KHANAOriginalDir === "") {
        document.documentElement.removeAttribute("dir");
      } else {
        document.documentElement.setAttribute("dir", KHANAOriginalDir);
      }
    }
  }

  if (settings.convertNumbers) {
    enableNumberConversion();
  } else {
    disableNumberConversion();
  }
}

// Initial load
(function initKHANA() {
  // Ensure DOM is ready enough to inject styles
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      getSettings(applySettings);
    });
  } else {
    getSettings(applySettings);
  }

  // React to changes from popup or options
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    getSettings(applySettings);
  });

  // Optional explicit re-apply trigger from popup
  try {
    chrome.runtime.onMessage.addListener((message) => {
      if (message && message.type === "khana-reapply") {
        getSettings(applySettings);
      }
    });
  } catch (e) {
    // ignore
  }
})();
