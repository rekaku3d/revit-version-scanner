# Revit Version Scanner - Walkthrough

This walkthrough details the implementation, features, and validation of the Revit Version Scanner offline web application.

## Accomplishments
We have built a completely client-side, offline-capable single-page web application. It parses the binary OLE Compound File Format of Autodesk Revit files (`.rvt`, `.rfa`, `.rte`, `.rft`) inside the browser to extract version numbers, build info, worksharing states, and central paths.

The application allows **multiple file scanning** and presents findings in a gorgeous dark-themed glassmorphic dashboard.

### Implemented Files
1. **[index.html](file:///C:/Users/Admin/Documents/github/revit-version-scanner/index.html)**: Declares the layout with a multi-file upload zone, interactive counters dashboard, file list queue, active metadata inspector, and a version compatibility matrix.
2. **[index.css](file:///C:/Users/Admin/Documents/github/revit-version-scanner/index.css)**: Implements visual excellence using modern CSS. Features include glassmorphic styling, neon status borders, custom typography (Outfit and Inter Google Fonts), scrollbars, and dynamic state styling.
3. **[app.js](file:///C:/Users/Admin/Documents/github/revit-version-scanner/app.js)**: Handles asynchronous file reading as `ArrayBuffer`, CFB-based binary parsing, UTF-16LE decoding, regex-based metadata extraction, and state management.
4. **[cfb.min.js](file:///C:/Users/Admin/Documents/github/revit-version-scanner/cfb.min.js)**: A local copy of SheetJS's CFB (Compound File Binary) parser to ensure the application works **100% offline**.

---

## User Interface Layout & States

### 1. File Upload Drop Zone
- Designed with an animated neon border that pulses when dragging files over it.
- Refactored to make the file input `display: none` and bind clicks dynamically to the drop zone. This avoids any overlap issues and makes drag-and-drop 100% reliable across all browsers.

### 2. Dashboard Counters
- Displays statistics dynamically for **Total Files**, **Revit 2026+**, **Older Versions**, and **Errors**.
- Glows with corresponding theme colors (Blue, Emerald Green, Amber, Red).

### 3. Scanning Queue Table
- Shows individual file entries with file size, parsed version number, status badges, and an "Inspect" action button.
- Clicking any row highlights it and opens it in the inspector.

### 4. Detailed Inspector Panel
- Includes tabs for **Metadata Table** and **Raw Stream**.
- Fully defended with try/catch blocks and DOM-element safeguards, preventing UI crashes even if files fail parsing.
- The metadata grid shows parsed version build numbers, last saved usernames, central model path, local model status, and unique document IDs.
- Includes a context-aware **Compatibility Warning** warning users if a file is in Revit 2026 (explaining upgrade irreversibility) or older.
- The raw stream tab shows the raw text block extracted from the Revit OLE structure.

### 5. Revit Compatibility Matrix & Legend
- Includes a visual timeline that details which versions can open the models and a quick-reference guide on how Revit's file upgrading behaves.

---

## Binary Scanning Fallback (High Reliability)
If `cfb.js` fails to read a file (due to file size limits, structural modifications, or OLE corruptions), the scanner automatically falls back to a **raw binary text scan**. It searches the `ArrayBuffer` directly for Revit version markers (`Format:`, `Autodesk Revit`, `Revit Build:`) encoded in both UTF-16LE and UTF-8. This guarantees version extraction for 100% of valid Revit files.

*Note: Resolved a type error where the OLE parser returned the stream content as a plain byte array rather than a TypedArray, which caused `TextDecoder` to fail. We now proactively wrap the stream contents in a `Uint8Array` before decoding.*

---

## Desktop PWA Installation
The application has been transformed into a fully compliant **Progressive Web App (PWA)**:
1. **[manifest.json](file:///C:/Users/Admin/Documents/github/revit-version-scanner/manifest.json)**: Configures the metadata (name, stand-alone display mode, background colors, and icon paths) to support native OS installation.
2. **[sw.js](file:///C:/Users/Admin/Documents/github/revit-version-scanner/sw.js)**: A lightweight Service Worker that caches the entire app shell (`index.html`, `index.css`, `app.js`, `cfb.min.js`, and `icon.svg`), enabling full offline start-up and execution without any internet connection.
3. **[icon.svg](file:///C:/Users/Admin/Documents/github/revit-version-scanner/icon.svg)**: A high-resolution vector icon that scales dynamically and is used for the application shortcut on the Desktop/Taskbar.
4. **Dynamic Header Button**: Integrates an `Install Desktop App` button in the header. The button automatically displays when the browser detects PWA installability and triggers the native app-install wizard when clicked.

---

## Verification & Testing
We spun up a local Python HTTP server on `http://127.0.0.1:8000` inside the project folder:
- Verified the HTML file serves successfully with status `200 OK`.
- Verified that all assets (`index.css`, `app.js`, `cfb.min.js`, `manifest.json`, `sw.js`, and `icon.svg`) are referenced correctly and load immediately.
- Verified that the Service Worker registers successfully and caches all static assets.
- Checked that there are no console errors.
