# 🔍 Revit File Version Scanner (Offline PWA)

A premium, glassmorphic, and completely offline Progressive Web App (PWA) to quickly scan multiple Autodesk Revit files (`.rvt`, `.rfa`, `.rte`, `.rft`) inside the browser. It extracts version, build, worksharing status, and central paths without requiring a Revit installation.

---

## ✨ Features

- **⚡ Multi-File Drag-and-Drop**: Drop multiple Revit files at once to queue and parse them concurrently in real-time.
- **🔒 100% Client-Side & Private**: All file reading and binary parsing are executed locally in the browser using the HTML5 File API. Your BIM models never leave your computer.
- **💻 Desktop Installation (PWA)**: Register it as a desktop application with one click. It caches all files locally using a Service Worker so it runs fully offline.
- **🧠 Hybrid Parsing Engine**:
  - **OLE Storage Extraction**: Utilizes an offline-optimized `cfb.js` parser to extract the `BasicFileInfo` stream from the compound binary format.
  - **Raw Binary Scanning Fallback**: Dynamically falls back to direct `ArrayBuffer` byte scanning if the OLE headers are corrupted or modified, ensuring 100% extraction rates.
- **📊 Modern Dashboard & Inspector**:
  - Interactive counters for Total, Revit 2026+, Older Versions, and Errors.
  - Interactive file list queue with highlight-to-inspect functionality.
  - A metadata inspector panel showing build numbers, last saved username, central paths, local status, and unique document IDs.
  - Timeline layout showing Revit support & backward compatibility info.

---

## 🚀 How to Run Locally

### 1. One-Click Launcher (Windows)
Double-click the **`Revit Scanner Server.bat`** file on your Desktop or in the project root folder. It will:
- Start a local Python HTTP server on port 8000.
- Open your browser automatically to `http://127.0.0.1:8000`.

### 2. Manual Command Line
Open a terminal in the project directory and run:
```bash
python -m http.server 8000 --bind 127.0.0.1
```
Then navigate to `http://127.0.0.1:8000` in your web browser.

---

## 🖥️ Installing as a Desktop App (PWA)
Once the app is running on your local server:
1. Look for the **"Install Desktop App"** button in the top-right of the header.
2. Click it to install the application natively on your computer.
3. A shortcut icon will be added to your desktop/start menu, allowing you to use it like a native app anytime, even without an internet connection.

---

## 📂 Project Structure

- **`index.html`** – Clean, semantic structure with the upload drop-zone, queue table, and detailed inspector panels.
- **`index.css`** – Modern, responsive design system utilizing glassmorphism, glowing borders, custom scrollbars, and Outfit/Inter typography.
- **`app.js`** – Binary array buffer parsing, regex key extraction, service worker registration, and reactive UI logic.
- **`cfb.min.js`** – Client-side library for parsing OLE Compound Document formats locally.
- **`sw.js`** – Service worker managing offline caching.
- **`manifest.json`** – PWA manifest metadata.
- **`icon.svg`** – High-res vector artwork used as the app logo and shortcut icon.
- **`Revit Scanner Server.bat`** – One-click launcher for the Python server.

---

## ⚙️ How it Works under the Hood

Revit files are structured using Microsoft's OLE Compound File Binary (CFB) format. This app parses the binary structure:
1. It reads the files using HTML5 `FileReader` as an `ArrayBuffer`.
2. It extracts the raw binary data stream named `BasicFileInfo`.
3. It decodes the stream using `TextDecoder('utf-16le')` (with a fallback to `utf-8` if needed).
4. It extracts structured fields using regex patterns:
   - **Version Format**: `Format:\s*(\d+)`
   - **Revit Build**: `Build:\s*([^\r\n]*)`
   - **Central Model Path**: `Central Path:\s*([^\r\n]*)`
   - **Worksharing State**: `Worksharing:\s*([^\r\n]*)`
   - **Last Saved Path**: `Last Saved Path:\s*([^\r\n]*)`

---

## 🛠️ Developed By
Developed by **Rekaku Developer**.
Licensed under the MIT License.
