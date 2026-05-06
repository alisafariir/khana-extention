# Changelog

## 1.1.0

- Switch from workbench CSS patching to `main.js` runtime patching (`khana-rtl-runtime.js`) for better Cursor chat compatibility.
- Add runtime-based per-element RTL/LTR auto direction handling.
- Keep code blocks and Monaco content LTR while natural language chat is auto-directed.

## 1.0.1

- Improve Cursor selector coverage for `.composer-human-ai-pair-container` and `.markdown-root`.

## 1.0.2

- Expand Workbench CSS discovery (electron-sandbox + recursive scan).
- Add diagnostics command to list which CSS files were patched.

## 0.1.0

- Initial release: enable/disable/status commands to patch Workbench CSS for RTL chat rendering.

