const DEFAULTS = {
  fontSize: 100,
  lineHeight: 1.8
};

document.addEventListener("DOMContentLoaded", () => {
  const fontSizeRange = document.getElementById("font-size-range");
  const fontSizeLabel = document.getElementById("font-size-label");
  const lineHeightRange = document.getElementById("line-height-range");
  const lineHeightLabel = document.getElementById("line-height-label");

  if (!fontSizeRange || !fontSizeLabel || !lineHeightRange || !lineHeightLabel) return;

  function setFontSizeUI(value) {
    fontSizeRange.value = String(value);
    fontSizeLabel.textContent = `${value}%`;
  }

  function setLineHeightUI(value) {
    lineHeightRange.value = String(value);
    lineHeightLabel.textContent = value.toFixed(2).replace(/\.00$/, "");
  }

  chrome.storage.local.get(DEFAULTS, (stored) => {
    setFontSizeUI(stored.fontSize ?? DEFAULTS.fontSize);
    setLineHeightUI(stored.lineHeight ?? DEFAULTS.lineHeight);
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
});
