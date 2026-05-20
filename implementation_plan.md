# Revit Version Scanner - Implementation Plan

This plan details the design and implementation of a lightweight, beautiful, and completely offline-capable web application that can scan multiple Autodesk Revit files (`.rvt`, `.rfa`, `.rte`, `.rft`) concurrently to extract and display their version and other metadata.

## Goal
To build a single-page web app that runs fully client-side (offline) and determines if uploaded Revit files are saved in Revit 2026 or an older version (e.g., Revit 2025, 2024, etc.).

## Architecture
The application will be composed of three static files located in a local directory:
1. **`index.html`**: Structured semantic markup containing:
   - A multi-file drag-and-drop zone.
   - A batch summary dashboard showing counts (Total, Revit 2026, Older, Errors).
   - An interactive file queue table/list showing file name, size, detected version, status badge, and action buttons.
   - A detailed inspector section (active when a file is selected) featuring:
     - Version status banner with premium neon glows.
     - Parsed metadata table (Version, Build, Worksharing, Central Path, Unique ID).
     - Tabbed raw stream content viewer.
   - A Revit compatibility and version upgrade guide.
2. **`index.css`**: A premium CSS stylesheet utilizing modern styling guidelines (glassmorphism, neon glows, custom dark mode properties, grid and flexbox layouts, progress bars, and transition animations).
3. **`app.js`**: Core logic for the application:
   - Sets up multi-file drag-and-drop and standard file input handlers.
   - Manages a file queue array.
   - Reads files concurrently using `FileReader` as `ArrayBuffers` with visual loading progress bars.
   - Parses the OLE Compound File Binary format using a local copy of the `cfb.js` library.
   - Extracts the `BasicFileInfo` stream from the root of each file.
   - Decodes the binary stream (supporting UTF-16LE and UTF-8 fallbacks).
   - Extracts metadata fields using regular expressions.
   - Updates the dashboard counters and individual file rows in real time.
   - Allows users to select any scanned file to display its details in the detail inspector panel.
4. **`cfb.min.js`**: A copy of the SheetJS CFB parser library, saved locally to enable the app to run completely offline.

## User Review Required
No significant architectural risks. The app is purely client-side, which guarantees complete privacy.

> [!NOTE]
> To make the application **100% offline**, we will fetch and store `cfb.min.js` locally in the workspace directory. The user will be asked to approve a single sandbox-bypassed command (`curl` or equivalent) to download this library.

## Proposed Changes

We will create a new directory `C:/Users/Admin/Documents/github/revit-version-scanner` and place the following files there:

---

### [Revit Version Scanner Components]

#### [NEW] [index.html](file:///C:/Users/Admin/Documents/github/revit-version-scanner/index.html)
- Main user interface.
- Includes references to local `cfb.min.js`, `index.css`, and `app.js`.
- Features:
  - Elegant header with Outfit/Inter Google fonts.
  - Interactive multi-file drag-and-drop zone with animated borders.
  - Dashboard stats widgets (Total scanned, Revit 2026, Older, Errors) with glowing borders.
  - Scan progress indicator for batch processing.
  - Batch file list table with columns: File Name, Size, Version, Status, Actions.
  - Detail inspector section displaying the selected file's metadata and raw stream content.
  - Revit compatibility matrix.

#### [NEW] [index.css](file:///C:/Users/Admin/Documents/github/revit-version-scanner/index.css)
- Premium dark-themed style sheet.
- Color palette: Deep space gray (`#0f172a`), slate (`#1e293b`), emerald green (`#10b981`), amber orange (`#f59e0b`), neon blue (`#0ea5e9`), and cool white (`#f8fafc`).
- Visual styles: Glassmorphism (`backdrop-filter: blur`), subtle box-shadow glows (`box-shadow: 0 0 15px ...`), smooth hover animations on the drop zone, and transition effects.
- Clean typography and fully responsive design.

#### [NEW] [app.js](file:///C:/Users/Admin/Documents/github/revit-version-scanner/app.js)
- JavaScript file reader and parser.
- Handles multiple file selection, file list UI rendering, and detail view switching.
- CFB Parsing logic:
  - Invokes `CFB.read` on each file's binary data.
  - Searches `cfb.FileIndex` for `BasicFileInfo` (case-insensitive).
  - Decodes the `BasicFileInfo` stream using `TextDecoder('utf-16le')` and fallback `TextDecoder('utf-8')`.
  - Parses key-value pairs (e.g. `Format: 2026`, `Build: ...`, `Worksharing: ...`).
  - Updates the DOM with results.

#### [NEW] [cfb.min.js](file:///C:/Users/Admin/Documents/github/revit-version-scanner/cfb.min.js)
- Parsed OLE compound file library downloaded locally.

---

## Verification Plan

### Automated/Manual Verification
1. We will verify the file creation and verify the code structure.
2. We will run a local web server (using a simple python or node static server) to test and run the app.
3. We will inspect the page using Chrome DevTools or a browser to ensure that `cfb.min.js` loads correctly, drag-and-drop works, and the design is premium.
4. We will recommend that the user set `C:/Users/Admin/Documents/github/revit-version-scanner` as their active workspace.
