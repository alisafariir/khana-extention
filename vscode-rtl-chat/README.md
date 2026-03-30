# Khana RTL Chat (VS Code / Cursor)

This is a VS Code-compatible extension that **enables RTL direction for chat markdown** by applying a **reversible patch** to the installed Workbench CSS file.

## Commands

- `Khana: Enable RTL for Chat`
- `Khana: Disable RTL for Chat`
- `Khana: RTL Chat Patch Status`

## Notes / Limitations

- This works by modifying the installed editor files (similar to “custom CSS loader” extensions). It may require elevated permissions depending on where VS Code/Cursor is installed.
- After updates, the editor may restore/replace Workbench files; you may need to re-enable the patch.
- The exact chat UI selectors can change between versions; the patch uses multiple best-effort selectors.

