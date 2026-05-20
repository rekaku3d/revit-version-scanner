// Revit Version Scanner - Client-Side Parser
// Uses local copy of cfb.min.js for OLE structured storage parsing.

// Service Worker Registration for PWA & offline support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('[Service Worker] Registered successfully', reg.scope))
            .catch(err => console.error('[Service Worker] Registration failed', err));
    });
}

// Application State
const state = {
    files: {}, // Maps fileId -> File metadata object
    selectedFileId: null,
    counters: {
        total: 0,
        r2026: 0,
        older: 0,
        errors: 0
    }
};

let deferredPrompt = null;

// Catch the browser install prompt event
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default browser prompt banner
    e.preventDefault();
    // Stash the install event
    deferredPrompt = e;
    // Show the desktop install button in header
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
        installBtn.style.display = 'inline-flex';
    }
});

// Initialize Application when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    initDragAndDrop();
    initFileInput();
    initTabs();
    initClearButton();
    initPwaInstall();
});

// Initialize PWA Installation Flow
function initPwaInstall() {
    const installBtn = document.getElementById('pwa-install-btn');
    if (!installBtn) return;

    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        // Trigger the browser installation prompt
        deferredPrompt.prompt();
        // Wait for user choice
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`[PWA] Install choice outcome: ${outcome}`);
        // Clear the prompt
        deferredPrompt = null;
        // Hide the button
        installBtn.style.display = 'none';
    });

    window.addEventListener('appinstalled', () => {
        console.log('[PWA] Revit scanner installed successfully!');
        installBtn.style.display = 'none';
    });
}

// Setup File Input Change Listener
function initFileInput() {
    const fileInput = document.getElementById('file-input');
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
            // Reset input so the same file can be uploaded again
            fileInput.value = '';
        }
    });
}

// Setup Drag & Drop Handlers
function initDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    // Click anywhere on drop zone to browse files
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFiles(files);
        }
    }, false);
}

// Setup Inspector Tabs
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            tabButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');

            // Hide all tab content
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(content => content.classList.remove('active'));

            // Show selected tab content
            const targetTab = btn.getAttribute('data-tab');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

// Setup Clear All Button
function initClearButton() {
    const clearBtn = document.getElementById('clear-all-btn');
    clearBtn.addEventListener('click', () => {
        state.files = {};
        state.selectedFileId = null;
        state.counters = { total: 0, r2026: 0, older: 0, errors: 0 };
        
        updateStatsUI();
        
        // Hide file queue and reset inspector
        document.getElementById('file-queue-section').style.display = 'none';
        resetInspector();
        
        // Clear table body
        document.getElementById('file-list-tbody').innerHTML = '';
    });
}

// Format File Size in readable string
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Main Batch File Upload Handler
function handleFiles(filesList) {
    const queueSection = document.getElementById('file-queue-section');
    queueSection.style.display = 'block'; // Make queue table card visible

    Array.from(filesList).forEach(file => {
        const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        
        // Create initial File State Record
        state.files[fileId] = {
            id: fileId,
            name: file.name,
            size: file.size,
            ext: ext,
            status: 'scanning', // 'scanning', 'success-2026', 'success-older', 'failed'
            version: '...',
            build: '-',
            worksharing: '-',
            isLocal: '-',
            isCentral: '-',
            centralPath: '-',
            lastSavedPath: '-',
            documentId: '-',
            username: '-',
            rawStream: '',
            errorMsg: ''
        };

        // Update Total Stats Counter
        state.counters.total++;
        updateStatsUI();

        // Render file row in queue table
        renderFileRow(fileId);

        // Read and Parse File
        const reader = new FileReader();
        reader.onload = function(e) {
            const arrayBuffer = e.target.result;
            processRevitBuffer(fileId, arrayBuffer);
        };
        reader.onerror = function() {
            handleScanFailure(fileId, 'File reading error in browser.');
        };
        
        reader.readAsArrayBuffer(file);
    });
}

// Render row inside the Queue Table
function renderFileRow(fileId) {
    const fileObj = state.files[fileId];
    const tbody = document.getElementById('file-list-tbody');
    
    const tr = document.createElement('tr');
    tr.id = fileId;
    tr.onclick = () => selectFileForInspection(fileId);
    
    tr.innerHTML = `
        <td class="file-name-cell" title="${fileObj.name}">${fileObj.name}</td>
        <td>${formatBytes(fileObj.size)}</td>
        <td class="file-version-cell"><span class="highlight-value">${fileObj.version}</span></td>
        <td class="file-status-cell">
            <span class="status-badge status-scanning">Scanning...</span>
        </td>
        <td class="text-right">
            <button class="btn btn-secondary btn-sm inspect-btn" disabled>Inspect</button>
        </td>
    `;
    
    tbody.appendChild(tr);
}

// Update DOM elements for file row based on current state
function updateFileRowUI(fileId) {
    const fileObj = state.files[fileId];
    const tr = document.getElementById(fileId);
    if (!tr) return;

    const versionCell = tr.querySelector('.file-version-cell');
    const statusCell = tr.querySelector('.file-status-cell');
    const inspectBtn = tr.querySelector('.inspect-btn');

    versionCell.innerHTML = `<span class="highlight-value">${fileObj.version}</span>`;

    if (fileObj.status === 'success-2026') {
        statusCell.innerHTML = `<span class="status-badge status-success-2026">Revit 2026</span>`;
        inspectBtn.disabled = false;
    } else if (fileObj.status === 'success-older') {
        statusCell.innerHTML = `<span class="status-badge status-success-older">Older (${fileObj.version})</span>`;
        inspectBtn.disabled = false;
    } else {
        statusCell.innerHTML = `<span class="status-badge status-failed" title="${fileObj.errorMsg}">Failed</span>`;
        inspectBtn.disabled = false; // Allow inspecting errors to see why it failed
    }
}

// Update Dashboard Counters Card UI
function updateStatsUI() {
    document.getElementById('stat-total').innerText = state.counters.total;
    document.getElementById('stat-r2026').innerText = state.counters.r2026;
    document.getElementById('stat-older').innerText = state.counters.older;
    document.getElementById('stat-errors').innerText = state.counters.errors;
}

// Process and Parse Revit file ArrayBuffer using cfb.js with binary fallback
function processRevitBuffer(fileId, buffer) {
    try {
        let parsedSuccessfully = false;
        let cfb = null;
        
        try {
            // 1. Proactively attempt CFB Reader
            cfb = CFB.read(new Uint8Array(buffer), { type: 'array' });
        } catch (cfbErr) {
            console.warn('CFB reader failed, trying binary fallback:', cfbErr);
        }

        if (cfb && cfb.FileIndex) {
            // 2. Search for the "BasicFileInfo" stream safely
            const entry = cfb.FileIndex.find(e => e && e.name && (e.name.toLowerCase().includes('basicfileinfo') || e.name === 'BasicFileInfo'));
            
            if (entry && entry.content && entry.content.length > 0) {
                const contentBytes = new Uint8Array(entry.content);
                let decodedText = '';
                try {
                    decodedText = new TextDecoder('utf-16le').decode(contentBytes);
                    if (!decodedText.includes('Format') && !decodedText.includes('Build') && !decodedText.includes('Version')) {
                        decodedText = new TextDecoder('utf-8').decode(contentBytes);
                    }
                } catch (decodeErr) {
                    decodedText = new TextDecoder('utf-8').decode(contentBytes);
                }

                const cleanText = decodedText.replace(/\0/g, '');
                state.files[fileId].rawStream = cleanText;
                
                parseMetadata(fileId, cleanText);
                parsedSuccessfully = true;
            }
        }

        // 3. Fallback Binary Scan if CFB failed or BasicFileInfo was not found
        if (!parsedSuccessfully) {
            const fallbackResult = searchVersionFallback(buffer);
            if (fallbackResult) {
                state.files[fileId].rawStream = `[FALLBACK SCANNER ACTIVE]\nOLE container parsing failed, but metadata was successfully recovered from raw binary scan.\n\n` + fallbackResult.cleanText;
                parseMetadata(fileId, fallbackResult.cleanText);
                parsedSuccessfully = true;
            } else {
                throw new Error('Could not find Revit version metadata in file structure. Make sure this is a valid Revit model or family file.');
            }
        }

    } catch (err) {
        handleScanFailure(fileId, err.message);
    }
}

// Binary search fallback for version extraction in large/complex files
function searchVersionFallback(buffer) {
    const arr = new Uint8Array(buffer);
    const size = arr.length;
    const chunkSize = Math.min(size, 8 * 1024 * 1024); // Scan up to 8MB from start and end
    
    const segments = [];
    if (size <= chunkSize) {
        segments.push(arr);
    } else {
        segments.push(arr.subarray(0, chunkSize));
        segments.push(arr.subarray(size - chunkSize));
    }
    
    const decoders = [
        new TextDecoder('utf-16le'),
        new TextDecoder('utf-8')
    ];
    
    for (const segment of segments) {
        for (const decoder of decoders) {
            try {
                const text = decoder.decode(segment);
                // Look for common Revit markers in the decoded segment
                if (text.includes('Format') || text.includes('Build') || text.includes('Autodesk Revit')) {
                    let matchIndex = text.indexOf('Format:');
                    if (matchIndex === -1) matchIndex = text.indexOf('Autodesk Revit');
                    if (matchIndex === -1) matchIndex = text.indexOf('Revit Build:');
                    
                    if (matchIndex !== -1) {
                        // Extract a window around the match
                        const start = Math.max(0, matchIndex - 100);
                        const end = Math.min(text.length, matchIndex + 1500);
                        const windowText = text.substring(start, end);
                        const cleanText = windowText.replace(/\0/g, '');
                        
                        // Parse version
                        const versionMatch = cleanText.match(/Format:\s*(\d{4})/i) || 
                                             cleanText.match(/Revit Build:.*?(\d{4})/i) ||
                                             cleanText.match(/Autodesk Revit (\d{4})/i) ||
                                             cleanText.match(/(\d{4})\s*\(Build/i);
                        
                        if (versionMatch && versionMatch[1]) {
                            const version = versionMatch[1];
                            const year = parseInt(version, 10);
                            if (year >= 2000 && year <= 2035) {
                                return {
                                    version: version,
                                    cleanText: cleanText
                                };
                            }
                        }
                    }
                }
            } catch (e) {
                // Ignore decoding errors for this segment
            }
        }
    }
    return null;
}

// Parse Metadata fields using robust Regex
function parseMetadata(fileId, cleanText) {
    const fileObj = state.files[fileId];

    // Cascade for Revit Version (4-digit format)
    let version = null;
    
    // Case 1: "Format: 2026"
    const formatMatch = cleanText.match(/Format:\s*(\d{4})/i);
    if (formatMatch) version = formatMatch[1];
    
    // Case 2: "Revit Build: Autodesk Revit 2026"
    if (!version) {
        const buildMatch = cleanText.match(/Revit Build:.*?(\d{4})/i);
        if (buildMatch) version = buildMatch[1];
    }
    
    // Case 3: "Autodesk Revit 2026"
    if (!version) {
        const genericMatch = cleanText.match(/Autodesk Revit (\d{4})/i);
        if (genericMatch) version = genericMatch[1];
    }
    
    // Case 4: Near Build keyword "2026 (Build"
    if (!version) {
        const nearbyMatch = cleanText.match(/(\d{4})\s*\(Build/i) || cleanText.match(/Build.*?(\d{4})/i);
        if (nearbyMatch) version = nearbyMatch[1];
    }

    if (!version) {
        // Fallback check: Look for any year between 2000 and 2035 in the text
        const fallbackMatch = cleanText.match(/\b(20[0-2][0-9]|203[0-5])\b/);
        if (fallbackMatch) {
            version = fallbackMatch[1];
        } else {
            version = 'Unknown';
        }
    }

    fileObj.version = version;

    // Extract other fields with fallbacks
    const extract = (regexes, defaultValue = 'Unknown') => {
        for (const r of regexes) {
            const match = cleanText.match(r);
            if (match && match[1]) return match[1].trim();
        }
        return defaultValue;
    };

    fileObj.build = extract([/Build:\s*([^\r\n]+)/i, /Revit Build:\s*([^\r\n]+)/i], 'Unknown');
    fileObj.worksharing = extract([/Worksharing:\s*([^\r\n]+)/i, /Is Workshared:\s*([^\r\n]+)/i, /Workshared:\s*([^\r\n]+)/i], 'Not Enabled');
    fileObj.centralPath = extract([/Central Model Path:\s*([^\r\n]+)/i, /Central Path:\s*([^\r\n]+)/i], 'None');
    fileObj.lastSavedPath = extract([/Last Saved Path:\s*([^\r\n]+)/i, /Saved Path:\s*([^\r\n]+)/i, /Path:\s*([^\r\n]+)/i], 'Unknown');
    fileObj.documentId = extract([/Unique Document Identity:\s*([^\r\n]+)/i, /Document Identity:\s*([^\r\n]+)/i, /Unique ID:\s*([^\r\n]+)/i], 'Unknown');
    fileObj.username = extract([/Username:\s*([^\r\n]+)/i, /Last Saved By:\s*([^\r\n]+)/i, /Author:\s*([^\r\n]+)/i], 'Unknown');

    // Parse specific booleans
    const centralCheck = cleanText.toLowerCase();
    fileObj.isCentral = centralCheck.includes('is central model: yes') || centralCheck.includes('is central: yes') || fileObj.worksharing.toLowerCase().includes('central') ? 'Yes' : 'No';
    fileObj.isLocal = centralCheck.includes('is local model: yes') || centralCheck.includes('is local: yes') || fileObj.worksharing.toLowerCase().includes('local') ? 'Yes' : 'No';

    // 6. Categorize and update Status
    if (version === '2026') {
        fileObj.status = 'success-2026';
        state.counters.r2026++;
    } else {
        fileObj.status = 'success-older';
        state.counters.older++;
    }

    updateStatsUI();
    updateFileRowUI(fileId);

    // If this is the only file or first file, auto-select it for inspection
    if (state.counters.total === 1) {
        selectFileForInspection(fileId);
    }
}

// Handle errors during reading or parsing
function handleScanFailure(fileId, errorMsg) {
    const fileObj = state.files[fileId];
    fileObj.status = 'failed';
    fileObj.version = 'Error';
    fileObj.errorMsg = errorMsg;
    fileObj.rawStream = `Scan Failed: ${errorMsg}\n\nThis file could not be parsed. Ensure it is a valid Autodesk Revit file (.rvt, .rfa, .rte, .rft) saved with Revit 2011 or newer.`;

    state.counters.errors++;
    updateStatsUI();
    updateFileRowUI(fileId);
    
    if (state.counters.total === 1) {
        selectFileForInspection(fileId);
    }
}

// Load selected file details into Inspector Panel
function selectFileForInspection(fileId) {
    try {
        state.selectedFileId = fileId;
        const fileObj = state.files[fileId];
        if (!fileObj) return;

        // Manage Table Row Selected Class
        document.querySelectorAll('#file-list-tbody tr').forEach(row => {
            row.classList.remove('selected');
        });
        const tr = document.getElementById(fileId);
        if (tr) tr.classList.add('selected');

        // Switch Panel Display
        const emptyInspector = document.getElementById('empty-inspector');
        const activeInspector = document.getElementById('active-inspector');
        
        if (emptyInspector) emptyInspector.style.display = 'none';
        if (activeInspector) {
            activeInspector.style.display = 'flex';
            // Reset theme classes
            activeInspector.className = 'glass-card inspector-card';
        }

        // Set banner values
        const nameEl = document.getElementById('inspector-file-name');
        const extEl = document.getElementById('inspector-file-ext');
        if (nameEl) nameEl.innerText = fileObj.name;
        if (extEl) extEl.innerText = fileObj.ext ? fileObj.ext.replace('.', '').toUpperCase() : 'RVT';

        const badge = document.getElementById('inspector-version-badge');
        const descText = document.getElementById('inspector-status-desc');
        const compatBox = document.getElementById('compat-alert-box');
        const compatTitle = document.getElementById('compat-title');
        const compatDesc = document.getElementById('compat-description');

        // Configure details and warnings based on version
        if (fileObj.status === 'success-2026') {
            if (activeInspector) activeInspector.classList.add('theme-r2026');
            if (badge) badge.innerText = `Revit 2026`;
            if (descText) descText.innerText = `Current Core Version`;
            
            if (compatBox) {
                compatBox.className = 'compatibility-box warning-theme';
                if (compatTitle) compatTitle.innerText = 'Irreversible Upgrade Check';
                if (compatDesc) compatDesc.innerText = 'This file is in Revit 2026 format. Opening this file in Revit 2026 is immediate, but older versions of Revit (Revit 2025, 2024, etc.) CANNOT open it. Once a model is saved in Revit 2026, there is no way to downgrade it.';
            }
        } else if (fileObj.status === 'success-older') {
            if (activeInspector) activeInspector.classList.add('theme-older');
            if (badge) badge.innerText = `Revit ${fileObj.version}`;
            if (descText) descText.innerText = `Older Version Detected`;
            
            if (compatBox) {
                compatBox.className = 'compatibility-box success-theme';
                if (compatTitle) compatTitle.innerText = 'Safe to Open & Upgrade Precaution';
                if (compatDesc) compatDesc.innerText = `This file is in Revit ${fileObj.version}. It can be safely opened in Revit ${fileObj.version}. Note: If you open and save it in Revit 2026, it will be upgraded irreversibly, and you will lose the ability to open it in Revit ${fileObj.version} or earlier.`;
            }
        } else {
            if (activeInspector) activeInspector.classList.add('theme-error');
            if (badge) badge.innerText = `Unreadable`;
            if (descText) descText.innerText = `Error / Invalid File`;
            
            if (compatBox) {
                compatBox.className = 'compatibility-box danger-theme';
                if (compatTitle) compatTitle.innerText = 'Parsing Failure';
                if (compatDesc) compatDesc.innerText = `Error details: ${fileObj.errorMsg || 'Unknown error'}. Ensure the file is not corrupted, is fully downloaded, and is a valid OLE-based Revit container format (.rvt, .rfa, etc.).`;
            }
        }

        // Populate Details Grid
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val || '-';
        };

        setVal('meta-version', fileObj.version);
        setVal('meta-build', fileObj.build);
        setVal('meta-worksharing', fileObj.worksharing);
        setVal('meta-is-local', fileObj.isLocal);
        setVal('meta-is-central', fileObj.isCentral);
        setVal('meta-central-path', fileObj.centralPath);
        setVal('meta-last-saved-path', fileObj.lastSavedPath);
        setVal('meta-document-id', fileObj.documentId);
        setVal('meta-username', fileObj.username);
        setVal('meta-filesize', formatBytes(fileObj.size));

        // Populate Raw Stream Content
        const rawEl = document.getElementById('raw-stream-content');
        if (rawEl) rawEl.innerText = fileObj.rawStream || 'No stream content available.';

    } catch (err) {
        console.error('Error in selectFileForInspection:', err);
    }
}

// Reset Inspector back to empty state
function resetInspector() {
    try {
        const emptyEl = document.getElementById('empty-inspector');
        const activeEl = document.getElementById('active-inspector');
        if (emptyEl) emptyEl.style.display = 'flex';
        if (activeEl) activeEl.style.display = 'none';
    } catch (err) {
        console.error('Error in resetInspector:', err);
    }
}
