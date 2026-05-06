# Khana RTL Chat (VS Code / Cursor)

[نسخه فارسی / Persian README](./README.fa.md)

Khana RTL Chat enables RTL rendering in Cursor / VS Code chat surfaces by applying a reversible runtime patch to the editor app files.

## What this extension does

- Patches `main.js` in the installed editor app directory.
- Writes a runtime file named `khana-rtl-runtime.js` next to `main.js`.
- On app startup, runtime injects CSS and JS into chat windows:
  - RTL for natural language chat text.
  - LTR for code blocks, diff/code widgets, and Monaco editor content.
  - Auto direction per text node (RTL for Persian/Arabic/Hebrew text, LTR for pure Latin text).

## Commands

- `Khana: Enable RTL for Chat`
- `Khana: Disable RTL for Chat`
- `Khana: Toggle RTL Chat`
- `Khana: RTL Chat Patch Status`
- `Khana: RTL Chat Diagnostics`

## Status bar

- A status bar item is shown:
  - `RTL: ON`
  - `RTL: OFF`
- Click it to toggle between ON/OFF quickly.

## Installation

### Install from VSIX

1. Build/package VSIX:
   - `cd "E:/Projects/khana-extention/vscode-rtl-chat"`
   - `npm_config_registry=https://registry.npmjs.org/ npx --yes @vscode/vsce package`
2. In Cursor / VS Code:
   - Open command palette.
   - Run `Extensions: Install from VSIX...`
   - Select the generated file (for example `khana-1.1.1.vsix`).

### First enable flow

1. Run `Khana: Enable RTL for Chat`.
2. Editor reloads.
3. Open chat again (existing and new messages should both be affected).

## Technical details

### Files modified by the extension

- `<editor-install>/resources/app/out/main.js` (patched with loader block)
- `<editor-install>/resources/app/out/khana-rtl-runtime.js` (generated runtime)

Backups are stored in extension global storage and not alongside install files.

### Patch markers in `main.js`

The extension inserts markers:

- `// khana-rtl-chat:start`
- `// khana-rtl-chat:end`

Disable removes this block and deletes runtime file if present.

### Runtime behavior

- Hooks app/browser-window lifecycle.
- Injects CSS with `webContents.insertCSS(...)`.
- Runs a direction-detection script with `webContents.executeJavaScript(...)`.
- Re-applies on key events (`dom-ready` / `did-finish-load`) and short delayed retries.

## Troubleshooting

### Permission denied (`EPERM` / `EACCES`)

If your editor is installed under `C:\Program Files\...`, Windows can block writes even when running as admin.

Recommended:

- Use per-user install path (for example under `%LOCALAPPDATA%\Programs\...`).
- Close all editor windows completely before enabling.

### RTL still not applied

1. Run `Khana: RTL Chat Diagnostics`.
2. Check output panel:
   - Which `main.js` paths were found.
   - Which are `[PATCHED]`.
   - Whether runtime file exists.
3. If needed, share diagnostics output to refine selectors/runtime hooks.

### After editor update

Updates can overwrite `main.js`.

- Run `Khana: Enable RTL for Chat` again.

## Limitations

- This approach modifies installed app files (similar to custom CSS/JS loaders).
- Platform security policies can still block patching in locked system locations.
- Internal chat DOM can change across Cursor/VS Code versions, which may require runtime updates.

