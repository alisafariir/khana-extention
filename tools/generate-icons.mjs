import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(process.cwd());
const BROWSER_DIR = path.join(ROOT, "browser-extension");
const VSCODE_DIR = path.join(ROOT, "vscode-rtl-chat");

const SOURCE = path.join(BROWSER_DIR, "icon.png");
const BROWSER_OUT_DIR = path.join(BROWSER_DIR, "icons");
const VSCODE_OUT = path.join(VSCODE_DIR, "icon.png");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function writePngSquare(inputPath, outputPath, size) {
  await sharp(inputPath)
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Source icon not found at: ${SOURCE}`);
  }

  ensureDir(BROWSER_OUT_DIR);

  const browserSizes = [16, 32, 48, 128];
  await Promise.all(
    browserSizes.map((s) =>
      writePngSquare(SOURCE, path.join(BROWSER_OUT_DIR, `icon-${s}.png`), s)
    )
  );

  // VS Code expects a PNG icon (commonly 128x128). We overwrite vscode-rtl-chat/icon.png
  await writePngSquare(SOURCE, VSCODE_OUT, 128);

  // Keep original 1024x1024 in browser-extension/icon.png as the source.
  process.stdout.write(
    `Generated browser icons in ${path.relative(ROOT, BROWSER_OUT_DIR)} and VSCode icon at ${path.relative(
      ROOT,
      VSCODE_OUT
    )}\n`
  );
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + "\n");
  process.exit(1);
});

