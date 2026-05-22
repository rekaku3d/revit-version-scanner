# 🔍 Revit File Version Scanner

A premium, glassmorphic **online web app** to quickly scan multiple Autodesk Revit files (`.rvt`, `.rfa`, `.rte`, `.rft`) in the browser. It extracts version, build, worksharing status, and central paths without requiring a Revit installation. Files are processed entirely client-side — nothing is uploaded to any server.

🌐 **Live at**: [https://revitversionscan.pages.dev](https://revitversionscan.pages.dev)

---

## ✨ Features

- **⚡ Multi-File Drag-and-Drop**: Drop multiple Revit files at once to queue and parse them concurrently in real-time.
- **🔒 100% Client-Side & Private**: All file reading and binary parsing are executed locally in the browser using the HTML5 File API. Your BIM models never leave your computer.
- **💻 Installable PWA**: Install as a desktop app with one click via the browser's install prompt. Uses a **network-first** Service Worker strategy so it always serves the latest content.
- **🧠 Hybrid Parsing Engine**:
  - **OLE Storage Extraction**: Uses `cfb.js` to extract the `BasicFileInfo` stream from the OLE compound binary format.
  - **Raw Binary Scanning Fallback**: Falls back to direct `ArrayBuffer` byte scanning if OLE headers are corrupted, ensuring high extraction rates.
- **📊 Modern Dashboard & Inspector**:
  - Live counters for Total, Revit 2026+, Older Versions, and Errors.
  - Interactive file list queue with highlight-to-inspect.
  - Metadata inspector showing build numbers, last saved username, central paths, local/central status, and unique document IDs.
  - Revit version timeline and backward compatibility matrix.

---

## 🌐 Online Usage

Simply visit **[https://revitversionscan.pages.dev](https://revitversionscan.pages.dev)** in any modern browser — no installation required.

To install as a desktop app:
1. Open the site in Chrome or Edge.
2. Click the **"Install Desktop App"** button in the top-right header.
3. A shortcut is added to your desktop/start menu for quick access.

---

## 💻 Running Locally

### Option 1 — One-Click Launcher (Windows)
Double-click **`Revit Scanner Server.bat`** in the project folder. It starts a local Python HTTP server and opens the browser automatically at `http://127.0.0.1:8000`.

### Option 2 — Manual CLI
```bash
python -m http.server 8000 --bind 127.0.0.1
```
Then navigate to `http://127.0.0.1:8000`.

---

## 📂 Project Structure

| File | Purpose |
|---|---|
| `index.html` | App layout — drop zone, queue table, inspector panels |
| `index.css` | Glassmorphic dark theme, animations, responsive layout |
| `app.js` | Binary parsing, SW registration, reactive UI logic |
| `cfb.min.js` | Client-side OLE Compound File Binary parser |
| `sw.js` | Service Worker — network-first caching strategy |
| `manifest.json` | PWA metadata (`start_url: "/"`, `scope: "/"`) |
| `icon.svg` | High-res vector app icon |
| `troubleshooting.md` | Deployment error log and fixes |
| `Revit Scanner Server.bat` | Local dev server launcher |

---

## ⚙️ How It Works

Revit files use Microsoft's OLE Compound File Binary (CFB) format. The app:
1. Reads files via HTML5 `FileReader` as `ArrayBuffer`.
2. Parses the OLE container using `cfb.js` to find the `BasicFileInfo` stream.
3. Decodes the stream with `TextDecoder('utf-16le')` (UTF-8 fallback).
4. Extracts metadata fields using regex:

| Field | Pattern |
|---|---|
| Version | `Format:\s*(\d+)` |
| Build | `Build:\s*([^\r\n]*)` |
| Central Path | `Central Path:\s*([^\r\n]*)` |
| Worksharing | `Worksharing:\s*([^\r\n]*)` |
| Last Saved Path | `Last Saved Path:\s*([^\r\n]*)` |

5. Falls back to raw binary scan if OLE parsing fails.

---

## 🚀 Deployment

Hosted on **Cloudflare Pages**, auto-deployed from the `main` branch of [github.com/rekaku3d/revit-version-scanner](https://github.com/rekaku3d/revit-version-scanner) on every push.

---

## 🛠️ Developed By
Developed by **Rekaku Developer** · Licensed under the MIT License.
