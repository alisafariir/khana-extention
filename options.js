const DEFAULTS = {
  fontSize: 100,
  lineHeight: 1.8,
  convertNumbers: false,
  forceRtl: false
};

document.addEventListener("DOMContentLoaded", () => {
  const fontSizeRange = document.getElementById("font-size-range");
  const fontSizeLabel = document.getElementById("font-size-label");
  const lineHeightRange = document.getElementById("line-height-range");
  const lineHeightLabel = document.getElementById("line-height-label");
  const convertNumbersToggle = document.getElementById("convert-numbers-toggle");
  const forceRtlToggle = document.getElementById("force-rtl-toggle");

  if (
    !fontSizeRange ||
    !fontSizeLabel ||
    !lineHeightRange ||
    !lineHeightLabel ||
    !convertNumbersToggle ||
    !forceRtlToggle
  ) {
    return;
  }

  function setFontSizeUI(value) {
    fontSizeRange.value = String(value);
    fontSizeLabel.textContent = `${value}%`;
  }

  function setLineHeightUI(value) {
    lineHeightRange.value = String(value);
    lineHeightLabel.textContent = value.toFixed(2).replace(/\.00$/, "");
  }

  function setConvertNumbersUI(enabled) {
    convertNumbersToggle.checked = Boolean(enabled);
  }

  function setForceRtlUI(enabled) {
    forceRtlToggle.checked = Boolean(enabled);
  }

  // Initialize from storage
  chrome.storage.local.get(DEFAULTS, (stored) => {
    const fontSize = stored.fontSize ?? DEFAULTS.fontSize;
    const lineHeight = stored.lineHeight ?? DEFAULTS.lineHeight;
    const convertNumbers = stored.convertNumbers ?? DEFAULTS.convertNumbers;
    const forceRtl = stored.forceRtl ?? DEFAULTS.forceRtl;

    setFontSizeUI(fontSize);
    setLineHeightUI(lineHeight);
    setConvertNumbersUI(convertNumbers);
    setForceRtlUI(forceRtl);
  });

  fontSizeRange.addEventListener("input", () => {
    const value = parseInt(fontSizeRange.value, 10) || DEFAULTS.fontSize;
    setFontSizeUI(value);
    chrome.storage.local.set({ fontSize: value });
  });

  lineHeightRange.addEventListener("input", () => {
    const value = parseFloat(lineHeightRange.value) || DEFAULTS.lineHeight;
    setLineHeightUI(value);
    chrome.storage.local.set({ lineHeight: value });
  });

  convertNumbersToggle.addEventListener("change", () => {
    const enabled = convertNumbersToggle.checked;
    chrome.storage.local.set({ convertNumbers: enabled });
  });

  forceRtlToggle.addEventListener("change", () => {
    const enabled = forceRtlToggle.checked;
    chrome.storage.local.set({ forceRtl: enabled });
  });
});
