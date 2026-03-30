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

const KHANA_RTL_ATTR = "data-khana-rtl";
let KHANARtlSelectorsObserver = null;
let KHANAPickerActive = false;
let KHANAPickerOverlay = null;

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

function KHANABuildSelector(el) {
  if (!el || el === document.documentElement) return null;
  const esc = (v) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(v) : v.replace(/([^\w-])/g, "\\$1"));
  if (el.id && el.id.trim() && document.querySelectorAll("#" + esc(el.id)).length === 1) {
    return "#" + esc(el.id);
  }
  const tag = el.tagName.toLowerCase();
  const classes = typeof el.className === "string"
    ? el.className.trim().split(/\s+/).filter((c) => c.length)
    : [];
  if (classes.length) {
    return tag + "." + esc(classes[0]);
  }
  return tag;
}

function KHANAApplyRtlToSelectors(selectors) {
  if (!selectors || !Array.isArray(selectors) || selectors.length === 0) return;
  selectors.forEach((sel) => {
    try {
      document.querySelectorAll(sel).forEach((el) => {
        el.setAttribute("dir", "rtl");
        el.setAttribute(KHANA_RTL_ATTR, "1");
      });
    } catch (e) {
      // selector نامعتبر
    }
  });
}

function KHANAClearRtlFromSelectors() {
  document.querySelectorAll("[" + KHANA_RTL_ATTR + "='1']").forEach((el) => {
    el.removeAttribute("dir");
    el.removeAttribute(KHANA_RTL_ATTR);
  });
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

function applyRtlSelectorsAndObserve(selectors) {
  KHANAClearRtlFromSelectors();
  if (!selectors || selectors.length === 0) {
    stopRtlSelectorsObserver();
    return;
  }
  stopRtlSelectorsObserver();
  KHANAApplyRtlToSelectors(selectors);
  if (!document.body) return;
  KHANARtlSelectorsObserver = new MutationObserver(() => {
    KHANAApplyRtlToSelectors(selectors);
  });
  KHANARtlSelectorsObserver.observe(document.body, { childList: true, subtree: true });
}

function stopRtlSelectorsObserver() {
  if (KHANARtlSelectorsObserver) {
    KHANARtlSelectorsObserver.disconnect();
    KHANARtlSelectorsObserver = null;
  }
}

function applySettings(settings) {
  const siteConfig = getCurrentSiteConfig(settings);
  const enabled = isSiteEnabled(settings);

  if (!enabled) {
    removeBaseCss();
    removeDynamicStyles();
    disableNumberConversion();
    disableLangDetection();
  } else {
    injectBaseCss();
    updateDynamicStyles();
    enableLangDetection();

    const effectiveConvertNumbers =
      typeof siteConfig.convertNumbers !== "undefined"
        ? siteConfig.convertNumbers
        : settings.convertNumbers;
    if (effectiveConvertNumbers) {
      enableNumberConversion();
    } else {
      disableNumberConversion();
    }
  }

  // جهت صفحه و بخش‌های انتخاب‌شده همیشه اعمال می‌شوند (حتی بدون اعمال فونت سراسری)
  if (document.documentElement) {
    if (KHANAOriginalDir === null) {
      KHANAOriginalDir = document.documentElement.getAttribute("dir") || "";
    }
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

  const rtlSelectors = siteConfig.rtlSelectors || [];
  applyRtlSelectorsAndObserve(rtlSelectors);
}

function KHANAShowToast(msg) {
  const id = "khana-toast";
  let el = document.getElementById(id);
  if (el) el.remove();
  el = document.createElement("div");
  el.id = id;
  el.textContent = msg;
  el.style.cssText = "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#0f172a;color:#e5e7eb;padding:10px 16px;border-radius:8px;font-family:system-ui,sans-serif;font-size:13px;z-index:2147483647;box-shadow:0 4px 12px rgba(0,0,0,0.3);";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function KHANAStartPicker() {
  if (KHANAPickerActive) return;
  KHANAPickerActive = true;
  if (KHANAPickerOverlay) KHANAPickerOverlay.remove();
  KHANAPickerOverlay = document.createElement("div");
  KHANAPickerOverlay.id = "khana-picker-overlay";
  KHANAPickerOverlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.25);z-index:2147483646;display:flex;align-items:center;justify-content:center;cursor:crosshair;pointer-events:none;";
  const instr = document.createElement("div");
  instr.style.cssText = "pointer-events:auto;background:#0f172a;color:#e5e7eb;padding:16px 24px;border-radius:12px;font-family:system-ui,sans-serif;font-size:14px;text-align:center;max-width:280px;";
  instr.textContent = "روی قسمتی از صفحه کلیک کنید که می‌خواهید همیشه راست‌چین شود";
  KHANAPickerOverlay.appendChild(instr);
  document.body.appendChild(KHANAPickerOverlay);

  function onPick(e) {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target;
    if (target === KHANAPickerOverlay || target.closest("#khana-picker-overlay")) return;
    const el = target.nodeType === 1 ? target : target.parentElement;
    if (!el || el === document.documentElement) return;

    const selector = KHANABuildSelector(el);
    if (!selector) return;

    const host = window.location.hostname || "";
    chrome.storage.local.get({ siteSettings: {} }, (stored) => {
      const siteSettings = stored.siteSettings || {};
      const site = siteSettings[host] || {};
      const list = site.rtlSelectors || [];
      if (!list.includes(selector)) list.push(selector);
      siteSettings[host] = { ...site, rtlSelectors: list };
      chrome.storage.local.set({ siteSettings }, () => {
        KHANAPickerOverlay.remove();
        KHANAPickerOverlay = null;
        KHANAPickerActive = false;
        document.removeEventListener("click", onPick, true);
        getSettings(applySettings);
        KHANAShowToast("ذخیره شد. این بخش از این به بعد راست‌چین نمایش داده می‌شود.");
      });
    });
  }
  document.addEventListener("click", onPick, true);
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
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || !message.type) return;
      if (message.type === "khana-reapply") {
        getSettings(applySettings);
      } else if (message.type === "khana-start-picker") {
        KHANAStartPicker();
        sendResponse({ ok: true });
      }
      return true;
    });
  } catch (e) {
    // ignore
  }
})();
