import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
const MAIN_PATCH_START = "// khana-rtl-chat:start";
const MAIN_PATCH_END = "// khana-rtl-chat:end";
const RUNTIME_FILE_NAME = "khana-rtl-runtime.js";

function mainPatchBlock(): string {
  return [
    MAIN_PATCH_START,
    `try { require("./${RUNTIME_FILE_NAME}"); } catch (e) { console.error("[khana-rtl-chat] runtime load failed", e); }`,
    MAIN_PATCH_END
  ].join("\n");
}

function stripMainPatch(content: string): string {
  const start = content.indexOf(MAIN_PATCH_START);
  const end = content.indexOf(MAIN_PATCH_END);
  if (start === -1 || end === -1) return content;
  return (content.slice(0, start) + content.slice(end + MAIN_PATCH_END.length)).replace(/\n{3,}/g, "\n\n");
}

function hasMainPatch(content: string): boolean {
  return content.includes(MAIN_PATCH_START) && content.includes(MAIN_PATCH_END);
}

function injectMainPatch(content: string): string {
  const stripped = stripMainPatch(content);
  const block = `${mainPatchBlock()}\n`;
  const useStrict = stripped.indexOf('"use strict";');
  if (useStrict !== -1) {
    const afterStrict = stripped.indexOf("\n", useStrict);
    if (afterStrict !== -1) {
      return `${stripped.slice(0, afterStrict + 1)}${block}${stripped.slice(afterStrict + 1)}`;
    }
  }
  return `${block}\n${stripped}`;
}

/** Main-process hook: inject motcke/cursor-ext-rtl parity renderer (embedded at enable time). */
function runtimeJsContent(rendererSource: string): string {
  const scriptLit = JSON.stringify(rendererSource);

  return [
    "/* khana-rtl-chat runtime — all WebContents (windows + webviews) */",
    "(function () {",
    '  var KEY = "__khana_rtl_runtime_loaded__";',
    "  if (globalThis[KEY]) return;",
    "  globalThis[KEY] = true;",
    "",
    "  var electron;",
    "  try { electron = require(\"electron\"); } catch (e) { return; }",
    "  var app = electron.app;",
    "  var BrowserWindow = electron.BrowserWindow;",
    "  if (!app) return;",
    "",
    "  var rendererScript = " + scriptLit + ";",
    "",
    "  var hooked = Object.create(null);",
    "",
    "  function shouldSkipWebContents(wc) {",
    "    try {",
    "      if (!wc || wc.isDestroyed()) return true;",
    "      var u = wc.getURL();",
    "      if (u && u.indexOf(\"devtools://\") === 0) return true;",
    "    } catch (e) {}",
    "    return false;",
    "  }",
    "",
    "  function injectOnce(wc) {",
    "    if (shouldSkipWebContents(wc)) return;",
    "    var id = wc.id;",
    "    if (hooked[id]) return;",
    "    hooked[id] = true;",
    "",
    "    function run() {",
    "      try {",
    "        wc.executeJavaScript(rendererScript, true).catch(function () {});",
    "      } catch (e) {}",
    "    }",
    "",
    "    wc.on(\"dom-ready\", run);",
    "    wc.on(\"did-finish-load\", run);",
    "    wc.on(\"did-navigate\", run);",
    "    setTimeout(run, 0);",
    "    setTimeout(run, 500);",
    "    setTimeout(run, 1500);",
    "    setTimeout(run, 4000);",
    "  }",
    "",
    "  function hookAllExisting() {",
    "    try {",
    "      if (electron.webContents && typeof electron.webContents.getAllWebContents === \"function\") {",
    "        electron.webContents.getAllWebContents().forEach(injectOnce);",
    "      }",
    "    } catch (e) {}",
    "    try {",
    "      if (BrowserWindow && typeof BrowserWindow.getAllWindows === \"function\") {",
    "        BrowserWindow.getAllWindows().forEach(function (win) {",
    "          try {",
    "            if (win && !win.isDestroyed() && win.webContents) injectOnce(win.webContents);",
    "          } catch (e) {}",
    "        });",
    "      }",
    "    } catch (e) {}",
    "  }",
    "",
    "  function start() {",
    "    hookAllExisting();",
    "    setInterval(hookAllExisting, 5000);",
    "    try {",
    "      app.on(\"web-contents-created\", function (_e, wc) {",
    "        injectOnce(wc);",
    "      });",
    "    } catch (e) {}",
    "    try {",
    "      if (BrowserWindow) {",
    "        app.on(\"browser-window-created\", function (_e, win) {",
    "          try {",
    "            if (win && !win.isDestroyed() && win.webContents) injectOnce(win.webContents);",
    "          } catch (e) {}",
    "        });",
    "      }",
    "    } catch (e) {}",
    "  }",
    "",
    "  if (app.isReady && app.isReady()) start();",
    "  else app.once(\"ready\", start);",
    "})();"
  ].join("\n");
}

function readFileUtf8(filePath: string): string {
  return fs.readFileSync(filePath, { encoding: "utf8" });
}

const CURSOR_EXT_RTL_RENDERER_REL = path.join("resources", "cursor-ext-rtl-parity.js");

/** motcke/cursor-ext-rtl/resources/rtl.js parity (bundled under resources/). */
function loadCursorExtRtlParity(context: vscode.ExtensionContext): string {
  const p = path.join(context.extensionPath, CURSOR_EXT_RTL_RENDERER_REL);
  if (!fs.existsSync(p)) {
    throw new Error(`Missing ${CURSOR_EXT_RTL_RENDERER_REL} (extension package incomplete).`);
  }
  return readFileUtf8(p);
}

function writeFileUtf8Atomic(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `${path.basename(filePath)}.khana-tmp-${Date.now()}`);
  fs.writeFileSync(tmp, content, { encoding: "utf8" });
  fs.renameSync(tmp, filePath);
}

function backupPathFor(context: vscode.ExtensionContext, mainJsPath: string): string {
  const storageDir = context.globalStorageUri.fsPath;
  const key = Buffer.from(mainJsPath).toString("base64").replace(/[/+=]/g, "_");
  return path.join(storageDir, `${path.basename(mainJsPath)}.${key}.khana-backup`);
}

function ensureBackup(context: vscode.ExtensionContext, mainJsPath: string): string {
  const storageDir = context.globalStorageUri.fsPath;
  fs.mkdirSync(storageDir, { recursive: true });
  const backupPath = backupPathFor(context, mainJsPath);
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(mainJsPath, backupPath);
  }
  return backupPath;
}

function formatEnableDisableError(e: unknown, cssPath: string): string {
  const err = e as NodeJS.ErrnoException;
  if (err && (err.code === "EPERM" || err.code === "EACCES")) {
    return [
      "Permission denied while patching Cursor/VS Code app files.",
      `File: ${cssPath}`,
      "Fix: Close Cursor/VS Code, then run it as Administrator and try again (or install it in a user-writable folder)."
    ].join("\n");
  }
  return `Failed: ${(e as Error)?.message ?? String(e)}`;
}

function candidateMainJsPaths(execPath: string): string[] {
  const exeDir = path.dirname(execPath);
  return [
    path.normalize(path.join(exeDir, "resources", "app", "out", "main.js")),
    path.normalize(path.join(exeDir, "..", "resources", "app", "out", "main.js"))
  ];
}

function allMainJsNearExec(execPath: string): string[] {
  const exeDir = path.dirname(execPath);
  const roots = [path.join(exeDir, "resources", "app", "out"), path.join(exeDir, "..", "resources", "app", "out")];
  const found = new Set<string>();
  for (const root of roots) {
    try {
      if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) continue;
      const stack: string[] = [root];
      while (stack.length) {
        const dir = stack.pop()!;
        let entries: fs.Dirent[] = [];
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) {
            if (e.name === "node_modules" || e.name === ".git" || e.name === "extensions") continue;
            stack.push(full);
            continue;
          }
          if (!e.isFile()) continue;
          if (e.name === "main.js") {
            found.add(path.normalize(full));
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return Array.from(found);
}

function findMainJsPaths(): string[] {
  const execPath = process.execPath;
  const found = new Set<string>();
  for (const p of candidateMainJsPaths(execPath)) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) found.add(path.normalize(p));
    } catch {}
  }
  for (const p of allMainJsNearExec(execPath)) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) found.add(path.normalize(p));
    } catch {}
  }
  return Array.from(found);
}

async function showInfo(message: string): Promise<void> {
  await vscode.window.showInformationMessage(message);
}

async function showError(message: string): Promise<void> {
  await vscode.window.showErrorMessage(message);
}

function isRtlEnabled(mainPaths: string[]): boolean {
  if (mainPaths.length === 0) return false;
  return mainPaths.some((p) => {
    try {
      return hasMainPatch(readFileUtf8(p));
    } catch {
      return false;
    }
  });
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("Khana RTL Chat");
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

  function refreshStatusBar(): void {
    const enabled = isRtlEnabled(findMainJsPaths());
    statusBar.text = enabled ? "$(symbol-keyword) RTL: ON" : "$(symbol-keyword) RTL: OFF";
    statusBar.tooltip = "Khana RTL Chat toggle";
    statusBar.command = "khanaRtlChat.toggle";
    statusBar.show();
  }

  const enable = vscode.commands.registerCommand("khanaRtlChat.enable", async () => {
    const mainPaths = findMainJsPaths();
    if (mainPaths.length === 0) {
      await showError(
        "Could not locate main.js. This method requires access to VS Code/Cursor installation files."
      );
      return;
    }

    try {
      let changed = 0;
      for (const mainJsPath of mainPaths) {
        const current = readFileUtf8(mainJsPath);
        const next = injectMainPatch(current);
        const runtimePath = path.join(path.dirname(mainJsPath), RUNTIME_FILE_NAME);
        ensureBackup(context, mainJsPath);
        if (next !== current) {
          writeFileUtf8Atomic(mainJsPath, next);
          changed++;
        }
        writeFileUtf8Atomic(runtimePath, runtimeJsContent(loadCursorExtRtlParity(context)));
      }

      refreshStatusBar();
      // Do not await showInformationMessage — it can wait until the toast dismisses and delays reload.
      void showInfo(
        changed === 0 ? "RTL runtime was already enabled. Reloading…" : `Enabled RTL runtime in ${changed} main.js file(s). Reloading…`
      );
      await vscode.commands.executeCommand("workbench.action.reloadWindow");
    } catch (e) {
      const first = mainPaths[0] ?? "unknown";
      await showError(`Failed to enable patch: ${formatEnableDisableError(e, first)}`);
      refreshStatusBar();
    }
  });

  const disable = vscode.commands.registerCommand("khanaRtlChat.disable", async () => {
    const mainPaths = findMainJsPaths();
    if (mainPaths.length === 0) {
      await showError("Could not locate main.js.");
      return;
    }

    try {
      let changed = 0;
      for (const mainJsPath of mainPaths) {
        const current = readFileUtf8(mainJsPath);
        const next = stripMainPatch(current);
        if (next !== current) {
          writeFileUtf8Atomic(mainJsPath, next);
          changed++;
        }
        const runtimePath = path.join(path.dirname(mainJsPath), RUNTIME_FILE_NAME);
        try {
          if (fs.existsSync(runtimePath)) fs.unlinkSync(runtimePath);
        } catch {
          // ignore runtime delete failures
        }
      }

      refreshStatusBar();
      void showInfo(
        changed === 0 ? "RTL was off. Reloading…" : `Disabled RTL runtime in ${changed} main.js file(s). Reloading…`
      );
      await vscode.commands.executeCommand("workbench.action.reloadWindow");
    } catch (e) {
      const first = mainPaths[0] ?? "unknown";
      await showError(`Failed to disable patch: ${formatEnableDisableError(e, first)}`);
      refreshStatusBar();
    }
  });

  const toggle = vscode.commands.registerCommand("khanaRtlChat.toggle", async () => {
    if (isRtlEnabled(findMainJsPaths())) {
      await vscode.commands.executeCommand("khanaRtlChat.disable");
    } else {
      await vscode.commands.executeCommand("khanaRtlChat.enable");
    }
    refreshStatusBar();
  });

  const status = vscode.commands.registerCommand("khanaRtlChat.status", async () => {
    const mainPaths = findMainJsPaths();
    if (mainPaths.length === 0) {
      await showError("Could not locate main.js.");
      return;
    }
    try {
      const patchedCount = mainPaths.reduce((acc, p) => acc + (hasMainPatch(readFileUtf8(p)) ? 1 : 0), 0);
      const runtimeCount = mainPaths.reduce((acc, p) => {
        const runtimePath = path.join(path.dirname(p), RUNTIME_FILE_NAME);
        return acc + (fs.existsSync(runtimePath) ? 1 : 0);
      }, 0);
      await showInfo(`RTL runtime: ${patchedCount}/${mainPaths.length} patched | runtime file: ${runtimeCount}/${mainPaths.length}`);
    } catch (e) {
      await showError(`Failed to read status: ${(e as Error)?.message ?? String(e)}`);
    }
  });

  const diagnostics = vscode.commands.registerCommand("khanaRtlChat.diagnostics", async () => {
    const mainPaths = findMainJsPaths();
    output.clear();
    output.appendLine(`execPath: ${process.execPath}`);
    output.appendLine(`Found ${mainPaths.length} main.js file(s).`);
    output.appendLine("");
    for (const p of mainPaths.sort()) {
      const runtimePath = path.join(path.dirname(p), RUNTIME_FILE_NAME);
      const patched = hasMainPatch(readFileUtf8(p));
      const runtimeExists = fs.existsSync(runtimePath);
      output.appendLine(`- ${patched ? "[PATCHED]" : "[ ]"} ${p}`);
      output.appendLine(`  runtime: ${runtimeExists ? "[OK]" : "[ ]"} ${runtimePath}`);
      output.appendLine(`  backup: ${fs.existsSync(backupPathFor(context, p)) ? "[OK]" : "[ ]"} ${backupPathFor(context, p)}`);
      output.appendLine("");
    }
    output.show(true);
    await showInfo("Opened diagnostics output.");
    refreshStatusBar();
  });

  refreshStatusBar();
  context.subscriptions.push(output, statusBar, enable, disable, toggle, status, diagnostics);
}

export function deactivate() {}
