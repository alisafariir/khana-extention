# خوانا RTL Chat (برای Cursor / VS Code)

[English README](./README.md)

این اکستنشن نمایش راست‌به‌چپ (RTL) را در چت Cursor / VS Code فعال می‌کند؛ با یک patch قابل برگشت روی فایل‌های اجرای خود ادیتور.

## این اکستنشن چه کاری انجام می‌دهد؟

- فایل `main.js` در مسیر نصب ادیتور را patch می‌کند.
- فایل runtime به نام `khana-rtl-runtime.js` کنار `main.js` می‌سازد.
- هنگام اجرای ادیتور، runtime روی پنجره‌های چت CSS/JS تزریق می‌کند:
  - متن طبیعی چت RTL می‌شود.
  - کدبلاک‌ها، diff و Monaco editor به صورت LTR می‌مانند.
  - جهت متن به صورت هوشمند تشخیص داده می‌شود (فارسی/عربی/عبری RTL، متن لاتین LTR).

## دستورات

- `Khana: Enable RTL for Chat`
- `Khana: Disable RTL for Chat`
- `Khana: Toggle RTL Chat`
- `Khana: RTL Chat Patch Status`
- `Khana: RTL Chat Diagnostics`

## دکمه پایین ادیتور (Status Bar)

- یک دکمه پایین ادیتور نمایش داده می‌شود:
  - `RTL: ON`
  - `RTL: OFF`
- با کلیک روی آن، بین ON/OFF سوییچ می‌کند.

## نصب

### نصب از VSIX

1. ساخت VSIX:
   - `cd "E:/Projects/khana-extention/vscode-rtl-chat"`
   - `npm_config_registry=https://registry.npmjs.org/ npx --yes @vscode/vsce package`
2. در Cursor / VS Code:
   - Command Palette را باز کن.
   - دستور `Extensions: Install from VSIX...` را اجرا کن.
   - فایل خروجی (مثلا `khana-1.1.1.vsix`) را انتخاب کن.

### فعال‌سازی اولیه

1. دستور `Khana: Enable RTL for Chat` را اجرا کن.
2. ادیتور Reload می‌شود.
3. دوباره چت را باز کن (هم پیام‌های قبلی و هم جدید باید اعمال شوند).

## جزئیات فنی

### فایل‌هایی که تغییر می‌کنند

- `<editor-install>/resources/app/out/main.js` (افزودن loader)
- `<editor-install>/resources/app/out/khana-rtl-runtime.js` (runtime تولیدشده)

بکاپ‌ها در فضای داخلی extension ذخیره می‌شوند، نه کنار فایل‌های نصب.

### Markerهای patch در `main.js`

- `// khana-rtl-chat:start`
- `// khana-rtl-chat:end`

در Disable این بلاک حذف می‌شود و فایل runtime هم پاک می‌شود.

### رفتار runtime

- به lifecycle پنجره‌های Electron وصل می‌شود.
- با `webContents.insertCSS(...)` استایل تزریق می‌کند.
- با `webContents.executeJavaScript(...)` تشخیص جهت متن را اجرا می‌کند.
- روی `dom-ready` و `did-finish-load` و چند retry کوتاه دوباره اعمال می‌کند.

## رفع مشکل (Troubleshooting)

### خطای Permission (`EPERM` / `EACCES`)

اگر ادیتور در `C:\Program Files\...` نصب شده باشد، ویندوز ممکن است نوشتن را بلاک کند حتی در حالت Administrator.

پیشنهاد:

- نسخه per-user ادیتور را نصب کن (مثلا زیر `%LOCALAPPDATA%\Programs\...`).
- قبل از Enable همه پنجره‌های ادیتور را کامل ببند.

### RTL اعمال نمی‌شود

1. دستور `Khana: RTL Chat Diagnostics` را اجرا کن.
2. خروجی را در Output ببین:
   - چه مسیرهای `main.js` پیدا شده
   - کدام `[PATCHED]` هستند
   - فایل runtime ساخته شده یا نه
3. در صورت نیاز خروجی را ارسال کن تا runtime/selector دقیق‌تر شود.

### بعد از آپدیت ادیتور

ممکن است آپدیت، `main.js` را بازنویسی کند.

- دوباره `Khana: Enable RTL for Chat` را اجرا کن.

## محدودیت‌ها

- این روش فایل‌های نصب ادیتور را تغییر می‌دهد (مشابه custom CSS/JS loader).
- سیاست‌های امنیتی سیستم‌عامل در مسیرهای قفل‌شده می‌تواند patch را محدود کند.
- DOM داخلی چت در نسخه‌های مختلف Cursor/VS Code ممکن است تغییر کند و نیاز به بروزرسانی runtime داشته باشد.

