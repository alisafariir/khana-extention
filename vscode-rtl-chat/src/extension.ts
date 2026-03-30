import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

const PATCH_START = "/* khana-rtl-chat:start */";
const PATCH_END = "/* khana-rtl-chat:end */";

function patchCssBlock(): string {
  // Chat UI in VS Code/Cursor can change between versions; we target multiple likely containers.
  // The goal: make natural language content RTL, keep code blocks LTR.
  return [
    PATCH_START,
    "/* This file was patched by Khana RTL Chat extension. */",
    "",
    // Main markdown renderers in chat messages
    [
      ".interactive-session .rendered-markdown",
      ".interactive-session .chat-markdown",
      ".chat-view .rendered-markdown",
      ".chat-view .chat-markdown",
      ".chat-response .rendered-markdown",
      ".chat-response .chat-markdown",
      ".chat-message .rendered-markdown",
      ".chat-message .chat-markdown"
    ].join(",\n") +
      " {",
    "  direction: rtl !important;",
    "  text-align: right !important;",
    "  unicode-bidi: plaintext !important;",
    "}",
    "",
    // Keep code blocks LTR
    [
      ".interactive-session .rendered-markdown pre",
      ".interactive-session .rendered-markdown code",
      ".chat-view .rendered-markdown pre",
      ".chat-view .rendered-markdown code",
      ".chat-response .rendered-markdown pre",
      ".chat-response .rendered-markdown code",
      ".chat-message .rendered-markdown pre",
      ".chat-message .rendered-markdown code"
    ].join(",\n") +
      " {",
    "  direction: ltr !important;",
    "  text-align: left !important;",
    "  unicode-bidi: embed !important;",
    "}",
    "",
    // Input box area (best-effort)
    [
      ".interactive-session .monaco-editor textarea",
      ".chat-view .monaco-editor textarea"
    ].join(",\n") +
      " {",
    "  direction: rtl !important;",
    "  unicode-bidi: plaintext !important;",
    "}",
    PATCH_END,
    ""
  ].join("\n");
}

function stripExistingPatch(css: string): string {
  const start = css.indexOf(PATCH_START);
  const end = css.indexOf(PATCH_END);
  if (start === -1 || end === -1) return css;
  const afterEnd = end + PATCH_END.length;
  const before = css.slice(0, start);
  const after = css.slice(afterEnd);
  return (before + after).replace(/\n{3,}/g, "\n\n");
}

function hasPatch(css: string): boolean {
  return css.includes(PATCH_START) && css.includes(PATCH_END);
}

function readFileUtf8(filePath: string): string {
  return fs.readFileSync(filePath, { encoding: "utf8" });
}

function writeFileUtf8Atomic(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `${path.basename(filePath)}.khana-tmp-${Date.now()}`);
  fs.writeFileSync(tmp, content, { encoding: "utf8" });
  fs.renameSync(tmp, filePath);
}

function backupPathFor(context: vscode.ExtensionContext, workbenchCssPath: string): string {
  const hash = crypto.createHash("sha256").update(workbenchCssPath).digest("hex").slice(0, 12);
  const base = path.basename(workbenchCssPath);
  const storageDir = context.globalStorageUri.fsPath;
  return path.join(storageDir, `${base}.${hash}.khana-backup`);
}

function ensureBackup(context: vscode.ExtensionContext, workbenchCssPath: string): string {
  const storageDir = context.globalStorageUri.fsPath;
  fs.mkdirSync(storageDir, { recursive: true });
  const backupPath = backupPathFor(context, workbenchCssPath);
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(workbenchCssPath, backupPath);
  }
  return backupPath;
}

function formatEnableDisableError(e: unknown, cssPath: string): string {
  const err = e as NodeJS.ErrnoException;
  if (err && (err.code === "EPERM" || err.code === "EACCES")) {
    return [
      "Permission denied while patching Workbench CSS.",
      `File: ${cssPath}`,
      "Fix: Close Cursor/VS Code, then run it as Administrator and try again (or install it in a user-writable folder)."
    ].join("\n");
  }
  return `Failed: ${(e as Error)?.message ?? String(e)}`;
}

function candidateWorkbenchCssPaths(execPath: string): string[] {
  // Examples:
  // - VS Code (Windows): <install>\Code.exe
  //   resources\app\out\vs\workbench\workbench.desktop.main.css
  // - Cursor (Windows): <install>\Cursor.exe
  //   resources\app\out\vs\workbench\workbench.desktop.main.css
  const exeDir = path.dirname(execPath);
  const candidates: string[] = [];

  // typical stable install layout
  candidates.push(
    path.join(exeDir, "resources", "app", "out", "vs", "workbench", "workbench.desktop.main.css")
  );

  // some builds keep CSS under "out/vs/workbench"
  candidates.push(
    path.join(exeDir, "resources", "app", "out", "vs", "workbench", "workbench.web.main.css")
  );

  // Insiders-like or alternate layouts
  candidates.push(
    path.join(exeDir, "..", "resources", "app", "out", "vs", "workbench", "workbench.desktop.main.css")
  );
  candidates.push(
    path.join(exeDir, "..", "resources", "app", "out", "vs", "workbench", "workbench.web.main.css")
  );

  return Array.from(new Set(candidates.map((p) => path.normalize(p))));
}

function findWorkbenchCssPath(): string | null {
  const execPath = process.execPath;
  for (const p of candidateWorkbenchCssPaths(execPath)) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

async function showInfo(message: string): Promise<void> {
  await vscode.window.showInformationMessage(message);
}

async function showError(message: string): Promise<void> {
  await vscode.window.showErrorMessage(message);
}

export function activate(context: vscode.ExtensionContext) {
  const enable = vscode.commands.registerCommand("khanaRtlChat.enable", async () => {
    const cssPath = findWorkbenchCssPath();
    if (!cssPath) {
      await showError(
        "Could not locate Workbench CSS. This method requires access to VS Code/Cursor installation files."
      );
      return;
    }

    try {
      const css = readFileUtf8(cssPath);
      if (hasPatch(css)) {
        await showInfo("RTL Chat patch is already enabled.");
        return;
      }

      ensureBackup(context, cssPath);
      const next = stripExistingPatch(css).replace(/\s*$/, "\n\n") + patchCssBlock();
      writeFileUtf8Atomic(cssPath, next);
      await showInfo("Enabled RTL Chat patch. Please reload the window.");
      await vscode.commands.executeCommand("workbench.action.reloadWindow");
    } catch (e) {
      await showError(`Failed to enable patch: ${formatEnableDisableError(e, cssPath)}`);
    }
  });

  const disable = vscode.commands.registerCommand("khanaRtlChat.disable", async () => {
    const cssPath = findWorkbenchCssPath();
    if (!cssPath) {
      await showError("Could not locate Workbench CSS.");
      return;
    }

    try {
      const css = readFileUtf8(cssPath);
      if (!hasPatch(css)) {
        await showInfo("RTL Chat patch is not enabled.");
        return;
      }

      ensureBackup(context, cssPath);
      const next = stripExistingPatch(css);
      writeFileUtf8Atomic(cssPath, next);
      await showInfo("Disabled RTL Chat patch. Please reload the window.");
      await vscode.commands.executeCommand("workbench.action.reloadWindow");
    } catch (e) {
      await showError(`Failed to disable patch: ${formatEnableDisableError(e, cssPath)}`);
    }
  });

  const status = vscode.commands.registerCommand("khanaRtlChat.status", async () => {
    const cssPath = findWorkbenchCssPath();
    if (!cssPath) {
      await showError("Could not locate Workbench CSS.");
      return;
    }
    try {
      const css = readFileUtf8(cssPath);
      const enabled = hasPatch(css);
      const backup = fs.existsSync(backupPathFor(context, cssPath));
      await showInfo(
        `RTL Chat patch: ${enabled ? "ENABLED" : "DISABLED"} | Backup: ${backup ? "YES" : "NO"}`
      );
    } catch (e) {
      await showError(`Failed to read status: ${(e as Error)?.message ?? String(e)}`);
    }
  });

  context.subscriptions.push(enable, disable, status);
}

export function deactivate() {}

