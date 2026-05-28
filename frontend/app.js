// App State Management
const STATE = {
    activeTab: 'dashboard',
    presets: {},
    scanResults: null,
    selectedFiles: new Set(),
    currentFilter: 'All',
    searchQuery: '',
    isScanning: false
};

// SVG Icons Mapping for dynamic rendering
const CATEGORY_ICONS = {
    "Documents": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
    "Pictures": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
    "Videos": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`,
    "Music": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`,
    "Archives": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>`,
    "Installers": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`,
    "Projects": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
    "Junk / Delete Recommended": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="hsl(355, 85%, 60%)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
    "Others": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    "All": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`

};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // 1. Sidebar tab switching Setup
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const targetTab = item.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    // 2. Setup preset click handlers
    document.querySelectorAll('.preset-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const key = chip.getAttribute('data-preset');
            if (STATE.presets[key]) {
                document.getElementById('scan-path-input').value = STATE.presets[key];
                showToast(`Selected Preset: ${key}`, 'info');
            }
        });
    });

    // 3. Scan triggers
    document.getElementById('run-scan-btn').addEventListener('click', executeScan);
    document.getElementById('quick-scan-btn').addEventListener('click', () => {
        const path = document.getElementById('scan-path-input').value;
        if (path) {
            executeScan();
        } else {
            showToast('Please enter a target path or select a preset chip.', 'warning');
        }
    });

    // Shortcut button on dashboard
    document.getElementById('start-organize-shortcut-btn').addEventListener('click', () => {
        switchTab('scan');
    });

    // 4. File Table Controls
    document.getElementById('select-all-btn').addEventListener('click', toggleSelectAll);
    document.getElementById('delete-selected-btn').addEventListener('click', deleteSelectedFiles);
    document.getElementById('execute-moves-btn').addEventListener('click', approveAndMoveFiles);
    document.getElementById('file-search-input').addEventListener('input', (e) => {
        STATE.searchQuery = e.target.value;
        renderFilesTable();
    });


    // 5. Load standard assets
    fetchPresets();
    loadActivityHistory();
    
    // Status light indicator
    document.querySelector('.status-indicator').style.backgroundColor = 'var(--success)';
    document.querySelector('.status-indicator').style.boxShadow = '0 0 10px var(--success)';
    document.querySelector('.status-text').innerText = 'Local Core Server Active';
}

// Navigation handler
function switchTab(tabId) {
    if (STATE.activeTab === tabId) return;

    // Remove active navigation class
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-tab') === tabId) {
            item.classList.add('active');
        }
    });

    // Hide previous active content and show selected
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const targetContent = document.getElementById(`tab-${tabId}`);
    if (targetContent) {
        targetContent.classList.add('active');
    }

    STATE.activeTab = tabId;
    
    // Adjust Header Title text
    const titles = {
        'dashboard': 'Dashboard Metrics',
        'scan': 'Scan & Reorganize Files',
        'duplicates': 'Duplicate File Redundancies',
        'history': 'Activity History & Rollback'
    };
    document.getElementById('header-text').innerText = titles[tabId] || 'AI Organizer';

    // Proactively load history tabs
    if (tabId === 'history') {
        loadActivityHistory();
    }
}

// Fetch user home folder presets from server API
async function fetchPresets() {
    try {
        const response = await fetch('/api/scan-presets');
        if (response.ok) {
            STATE.presets = await response.json();
            // Pre-fill path with Downloads as default
            if (STATE.presets.Downloads) {
                document.getElementById('scan-path-input').value = STATE.presets.Downloads;
            }
        }
    } catch (err) {
        console.error("Failed to load folder presets:", err);
    }
}

// Console logging writer
function writeConsole(text, type = 'info') {
    const box = document.getElementById('console-logs');
    if (!box) return;
    
    const line = document.createElement('div');
    line.className = `console-line console-${type}`;
    
    const time = new Date().toLocaleTimeString();
    line.innerText = `[${time}] ${text}`;
    
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
}

// SVG radial circle score helper
function updateScoreRing(score) {
    const ring = document.getElementById('radial-bar');
    if (!ring) return;

    // Arc length for r=70 circle is 2 * PI * 70 = 439.8 (approx 440)
    const strokeDashOffset = 440 - (440 * score) / 100;
    ring.style.strokeDashoffset = strokeDashOffset;

    // Apply colored glowing effects dynamically based on score thresholds
    if (score < 50) {
        ring.style.stroke = 'var(--danger)';
        ring.style.filter = 'drop-shadow(0 0 6px var(--danger-glow))';
    } else if (score < 85) {
        ring.style.stroke = 'var(--warning)';
        ring.style.filter = 'drop-shadow(0 0 6px var(--warning-glow))';
    } else {
        ring.style.stroke = 'var(--success)';
        ring.style.filter = 'drop-shadow(0 0 6px var(--success-glow))';
    }

    // Animate score text
    const textNode = document.getElementById('dashboard-score-val');
    if (textNode) {
        let current = 0;
        const interval = setInterval(() => {
            if (current >= score) {
                textNode.innerText = score;
                clearInterval(interval);
            } else {
                current += 1;
                textNode.innerText = current;
            }
        }, 10);
    }
}

// Folder scanning core operation
async function executeScan() {
    const path = document.getElementById('scan-path-input').value.trim();
    if (!path) {
        showToast('Please enter a target path or select a preset chip.', 'warning');
        return;
    }

    if (STATE.isScanning) return;
    
    // Toggle loading states
    STATE.isScanning = true;
    document.getElementById('run-scan-btn').disabled = true;
    document.getElementById('scan-progress-panel').style.display = 'block';
    
    // Clear logs
    const consoleBox = document.getElementById('console-logs');
    consoleBox.innerHTML = '';
    
    writeConsole(`Initializing folder scan at target path: ${path}`, 'info');
    writeConsole('Analyzing directory structures and subdirectories recursively...', 'info');

    // Simulate progress bar increments for visual feedback
    const fill = document.getElementById('progress-bar-fill');
    const label = document.getElementById('progress-percentage');
    const labelStatus = document.getElementById('progress-status-label');
    
    let progress = 0;
    fill.style.width = '0%';
    label.innerText = '0%';
    
    const progressInterval = setInterval(() => {
        if (progress < 85) {
            progress += Math.floor(Math.random() * 8) + 1;
            if (progress > 85) progress = 85;
            fill.style.width = `${progress}%`;
            label.innerText = `${progress}%`;
            
            // Add funny logs during mock scanning
            if (progress > 20 && progress < 35) {
                labelStatus.innerText = "Indexing files metadata...";
                if (Math.random() > 0.5) writeConsole("Reading size descriptors and timestamps...", 'info');
            } else if (progress >= 35 && progress < 60) {
                labelStatus.innerText = "Running file checksums (MD5) for duplicates...";
                if (Math.random() > 0.6) writeConsole("Matching file signatures, skipping OS folders...", 'success');
            } else if (progress >= 60) {
                labelStatus.innerText = "Processing rule matrices...";
                if (Math.random() > 0.6) writeConsole("Mapping document target paths...", 'info');
            }
        }
    }, 150);

    try {
        const response = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: path })
        });
        
        const data = await response.json();
        
        // Terminate progress timers
        clearInterval(progressInterval);
        
        if (data.success) {
            fill.style.width = '100%';
            label.innerText = '100%';
            labelStatus.innerText = 'Indexing complete!';
            writeConsole(`Scan successful! Collected metadata for ${data.total_files} file(s).`, 'success');
            
            // Set state
            STATE.scanResults = data;
            
            // Refresh Dashboard & Scan Tables
            renderDashboard();
            renderScanCategoryFilters();
            renderFilesTable();
            renderDuplicatesPanel();
            
            // Show result grids
            document.getElementById('analysis-results-box').style.display = 'block';
            
            showToast(`Scan complete: Found ${data.total_files} file(s) successfully.`, 'success');
        } else {
            writeConsole(`Scanning Error: ${data.message}`, 'danger');
            showToast(data.message, 'danger');
        }
    } catch (err) {
        clearInterval(progressInterval);
        writeConsole(`Network communication crash: ${err.message}`, 'danger');
        showToast('System failed to talk with the backend helper.', 'danger');
    } finally {
        STATE.isScanning = false;
        document.getElementById('run-scan-btn').disabled = false;
    }
}

// Render Dashboard Panel
function renderDashboard() {
    const res = STATE.scanResults;
    if (!res) return;

    // Formatted storage size display
    let sizeStr = "0.00 B";
    const bytes = res.total_size;
    if (bytes > 0) {
        if (bytes < 1024) sizeStr = `${bytes} B`;
        else if (bytes < 1024 * 1024) sizeStr = `${(bytes/1024).toFixed(2)} KB`;
        else if (bytes < 1024 * 1024 * 1024) sizeStr = `${(bytes/(1024*1024)).toFixed(2)} MB`;
        else sizeStr = `${(bytes/(1024*1024*1024)).toFixed(2)} GB`;
    }

    // Assign stats values
    document.getElementById('stat-data-size').innerText = sizeStr;
    document.getElementById('stat-files-count').innerText = res.total_files;
    document.getElementById('stat-dup-count').innerText = res.duplicate_count;
    document.getElementById('stat-org-score').innerText = `${res.organization_score}%`;
    
    // Score ring
    updateScoreRing(res.organization_score);
    
    // Recommendations Card feed list
    const feed = document.getElementById('dashboard-rec-feed');
    feed.innerHTML = '';
    
    if (res.recommendations && res.recommendations.length > 0) {
        res.recommendations.forEach(rec => {
            const card = document.createElement('div');
            card.className = `rec-card ${rec.type}`;
            
            // Choose icon based on type
            let iconSvg = '';
            if (rec.type === 'success') {
                iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
            } else if (rec.type === 'warning' || rec.type === 'danger') {
                iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
            } else {
                iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
            }
            
            card.innerHTML = `
                <div class="rec-icon ${rec.type}">${iconSvg}</div>
                <div class="rec-details">
                    <span class="rec-title">${rec.title}</span>
                    <span class="rec-desc">${rec.message}</span>
                </div>
            `;
            feed.appendChild(card);
        });
    } else {
        feed.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <p>Amazing! Your system is clean and no recommendations are currently needed.</p>
            </div>
        `;
    }
}

// Render Categories filters panel on Left of Scan View
function renderScanCategoryFilters() {
    const res = STATE.scanResults;
    const filterBox = document.getElementById('category-filters-box');
    if (!res || !filterBox) return;

    // Reset container with "All" filter button
    filterBox.innerHTML = `
        <button class="filter-btn active" data-filter="All" id="filter-btn-All">
            <span style="display: flex; align-items: center; gap: 8px;">
                ${CATEGORY_ICONS["All"]} All Classified Files
            </span>
            <span class="filter-count" id="count-All">0</span>
        </button>
    `;

    let allCount = 0;
    
    // Sort and render filters matching existing categories
    Object.keys(res.categories).forEach(cat => {
        const count = res.categories[cat].length;
        allCount += count;
        
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.id = `filter-btn-${cat}`;
        btn.setAttribute('data-filter', cat);
        btn.innerHTML = `
            <span style="display: flex; align-items: center; gap: 8px;">
                ${CATEGORY_ICONS[cat] || CATEGORY_ICONS["Others"]} ${cat}
            </span>
            <span class="filter-count">${count}</span>
        `;
        
        btn.addEventListener('click', () => {
            selectCategoryFilter(cat);
        });
        
        filterBox.appendChild(btn);
    });

    // Update the All filter count
    document.getElementById('count-All').innerText = allCount;
    
    // Add Click listener to the default ALL filter
    document.getElementById('filter-btn-All').addEventListener('click', () => {
        selectCategoryFilter('All');
    });

    // Select ALL as default
    STATE.currentFilter = 'All';
    STATE.selectedFiles.clear();
    
    // Auto select all files immediately for seamless organizer approval
    selectAllFiles(true);
}

// Select specific category filter
function selectCategoryFilter(filterName) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = document.getElementById(`filter-btn-${filterName}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    STATE.currentFilter = filterName;
    renderFilesTable();
}

// Filter and render list items
function renderFilesTable() {
    const res = STATE.scanResults;
    const tbody = document.getElementById('files-table-body');
    if (!res || !tbody) return;

    tbody.innerHTML = '';
    
    // Gather matching files
    let files = [];
    if (STATE.currentFilter === 'All') {
        Object.keys(res.categories).forEach(cat => {
            files = files.concat(res.categories[cat]);
        });
    } else if (res.categories[STATE.currentFilter]) {
        files = res.categories[STATE.currentFilter];
    }

    // Filter by search query if any
    if (STATE.searchQuery) {
        const q = STATE.searchQuery.toLowerCase();
        files = files.filter(f => f.filename.toLowerCase().includes(q));
    }

    if (files.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
                    No files found matching current selection parameters.
                </td>
            </tr>
        `;
        updateSelectionStats();
        return;
    }

    // Populate rows
    files.forEach(f => {
        const tr = document.createElement('tr');
        
        const isChecked = STATE.selectedFiles.has(f.filepath);
        
        // Calculate relative path from scanned root to recommended path
        let relPath = f.recommended_path || '';
        if (relPath && STATE.scanResults && STATE.scanResults.scanned_path && relPath.startsWith(STATE.scanResults.scanned_path)) {
            relPath = relPath.substring(STATE.scanResults.scanned_path.length);
            while (relPath.startsWith('/') || relPath.startsWith('\\')) {
                relPath = relPath.substring(1);
            }
        }
        relPath = relPath.replace(/\\/g, '/');
        
        tr.innerHTML = `
            <td class="checkbox-cell">
                <div class="custom-checkbox ${isChecked ? 'checked' : ''}" data-path="${f.filepath}">
                    <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
            </td>
            <td>
                <span style="font-weight: 500; display: block;" title="${f.filename}">${f.filename}</span>
                <span style="font-size: 0.72rem; color: var(--text-muted); display: block;" title="${f.filepath}">...${f.filepath.slice(-35)}</span>
            </td>
            <td>
                <span class="badge primary">${f.category}</span>
            </td>
            <td>
                <div class="editable-path-container">
                    <input type="text" class="editable-path-input" value="${relPath}" title="Target absolute: ${f.recommended_path}" data-filepath="${f.filepath}">
                    <span class="path-edit-badge" title="Customize target directory">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                    </span>
                </div>
            </td>
            <td style="color: var(--text-secondary); font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;">
                ${f.size_str}
            </td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                    <button class="btn btn-secondary btn-preview-row" data-path="${f.filepath}" style="padding: 6px 10px; font-size: 0.72rem; border-radius: 6px; box-shadow: none; display: inline-flex; align-items: center; justify-content: center; min-width: unset; margin: 0;" title="Preview File">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary-light);"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                    <button class="btn btn-danger btn-delete-row" data-path="${f.filepath}" style="padding: 6px 10px; font-size: 0.72rem; border-radius: 6px; box-shadow: none; display: inline-flex; align-items: center; justify-content: center; min-width: unset; margin: 0;" title="Delete File One-by-One">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </td>
        `;

        // Checkbox events
        const chk = tr.querySelector('.custom-checkbox');
        chk.addEventListener('click', (e) => {
            toggleFileCheckbox(f.filepath, chk);
        });

        // Inline path editing event handler
        const pathInput = tr.querySelector('.editable-path-input');
        pathInput.addEventListener('input', (e) => {
            const newRelPath = e.target.value.trim().replace(/\\/g, '/');
            
            // Build the absolute target folder path
            let newAbsPath = STATE.scanResults.scanned_path;
            if (newRelPath) {
                let cleanedRel = newRelPath;
                while (cleanedRel.startsWith('/')) cleanedRel = cleanedRel.substring(1);
                while (cleanedRel.endsWith('/')) cleanedRel = cleanedRel.substring(0, cleanedRel.length - 1);
                
                if (cleanedRel) {
                    newAbsPath = newAbsPath + '/' + cleanedRel;
                }
            }
            newAbsPath = newAbsPath.replace(/\\/g, '/');
            
            // Update the file object in both global results state and current UI selection references
            f.recommended_path = newAbsPath;
            f.recommended_folder_name = newRelPath.split('/').pop() || '';
            
            // Highlight validation helper in input element tooltip
            pathInput.title = `Target absolute: ${newAbsPath}`;
        });

        // Individual row preview events
        const prevBtn = tr.querySelector('.btn-preview-row');
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showPreview(f.filepath, f.filename);
        });

        // Individual row delete events (Delete One-by-One)
        const delBtn = tr.querySelector('.btn-delete-row');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteOneFile(f.filepath, f.filename);
        });

        tbody.appendChild(tr);
    });

    updateSelectionStats();

}

function toggleFileCheckbox(filepath, element) {
    if (STATE.selectedFiles.has(filepath)) {
        STATE.selectedFiles.delete(filepath);
        element.classList.remove('checked');
    } else {
        STATE.selectedFiles.add(filepath);
        element.classList.add('checked');
    }
    updateSelectionStats();
}

// Select all files helper
function selectAllFiles(checked = true) {
    const res = STATE.scanResults;
    if (!res) return;

    if (checked) {
        // Add all matching files
        Object.keys(res.categories).forEach(cat => {
            res.categories[cat].forEach(f => {
                STATE.selectedFiles.add(f.filepath);
            });
        });
    } else {
        STATE.selectedFiles.clear();
    }
    renderFilesTable();
}

// Master select all toggle
function toggleSelectAll() {
    const res = STATE.scanResults;
    if (!res) return;

    const btn = document.getElementById('select-all-btn');
    
    // Check if everything is selected
    let totalCount = 0;
    Object.keys(res.categories).forEach(cat => {
        totalCount += res.categories[cat].length;
    });

    if (STATE.selectedFiles.size === totalCount) {
        selectAllFiles(false);
        btn.innerText = 'Select All';
    } else {
        selectAllFiles(true);
        btn.innerText = 'Deselect All';
    }
}

// Update stats count in UI
function updateSelectionStats() {
    const count = STATE.selectedFiles.size;
    document.getElementById('selection-summary').innerText = `${count} file(s) selected`;
    
    const executeBtn = document.getElementById('execute-moves-btn');
    executeBtn.disabled = (count === 0);
    
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    if (deleteSelectedBtn) {
        deleteSelectedBtn.disabled = (count === 0);
    }
    
    // Adjust Master Button Label
    const selectAllBtn = document.getElementById('select-all-btn');
    const res = STATE.scanResults;
    if (res) {
        let totalCount = 0;
        Object.keys(res.categories).forEach(cat => {
            totalCount += res.categories[cat].length;
        });
        selectAllBtn.innerText = STATE.selectedFiles.size === totalCount ? 'Deselect All' : 'Select All';
    }

}

// Perform file movement organization batch
async function approveAndMoveFiles() {
    const res = STATE.scanResults;
    if (!res || STATE.selectedFiles.size === 0) return;

    const count = STATE.selectedFiles.size;
    
    // Warn before starting
    const confirmAction = await showConfirm(
        "Execute Organization",
        `You are about to move <strong>${count} file(s)</strong> to their recommended subdirectories. Are you sure you want to proceed?`,
        false,
        "Organize Files"
    );
    if (!confirmAction) return;

    // Gather file objects that match selected paths
    const filesToMove = [];
    Object.keys(res.categories).forEach(cat => {
        res.categories[cat].forEach(f => {
            if (STATE.selectedFiles.has(f.filepath)) {
                filesToMove.push(f);
            }
        });
    });

    // Toggle button UI loading
    const moveBtn = document.getElementById('execute-moves-btn');
    const prevText = moveBtn.innerHTML;
    moveBtn.disabled = true;
    moveBtn.innerHTML = `<svg class="floating" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg> Moving Files...`;

    try {
        const response = await fetch('/api/organize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: filesToMove })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Success! Successfully organized ${data.success_count} file(s).`, 'success');
            
            // Clear current selection
            STATE.selectedFiles.clear();
            
            // Triggers a directory rescan to update UI scores and clear processed elements
            await executeScan();
            
            // Jump to history to inspect results or perform rollbacks
            switchTab('history');
        } else {
            showToast(`Error: ${data.message}`, 'danger');
        }
    } catch (err) {
        showToast('Communication crash during execution.', 'danger');
        console.error(err);
    } finally {
        moveBtn.disabled = false;
        moveBtn.innerHTML = prevText;
    }
}

// Render Duplicates Panel
function renderDuplicatesPanel() {
    const res = STATE.scanResults;
    const container = document.getElementById('duplicates-group-container');
    if (!res || !container) return;

    container.innerHTML = '';
    
    if (res.duplicates && res.duplicates.length > 0) {
        res.duplicates.forEach((group, index) => {
            const groupCard = document.createElement('div');
            groupCard.className = 'dup-group';
            
            // Construct child paths HTML
            let pathsHtml = '';
            group.paths.forEach(p => {
                pathsHtml += `
                    <div class="dup-path-row">
                        <span title="${p}">${p}</span>
                        <span class="badge info" style="font-size: 0.65rem;">Duplicate Copy</span>
                    </div>
                `;
            });

            groupCard.innerHTML = `
                <div class="dup-header" onclick="this.parentElement.classList.toggle('open')">
                    <div class="dup-title">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--warning);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        <span>${group.filename}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${group.size_str}</span>
                        <span class="badge danger" style="padding: 2px 6px;">${group.paths.length} copies</span>
                    </div>
                </div>
                <div class="dup-paths-list">
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 4px; font-weight: 500;">
                        Hash MD5 Key: <code style="font-family: 'JetBrains Mono', monospace; color: var(--primary-light);">${group.md5}</code>
                    </div>
                    ${pathsHtml}
                </div>
            `;
            container.appendChild(groupCard);
        });
    } else {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <p>Perfect! No duplicate files were found in this directory scan.</p>
            </div>
        `;
    }
}

// Load Activity and Batches histories
async function loadActivityHistory() {
    const timeline = document.getElementById('batches-timeline');
    if (!timeline) return;

    try {
        const response = await fetch('/api/batches');
        if (response.ok) {
            const batches = await response.json();
            timeline.innerHTML = '';
            
            if (batches && batches.length > 0) {
                batches.forEach(b => {
                    const card = document.createElement('div');
                    card.className = 'timeline-item';
                    
                    card.innerHTML = `
                        <div class="timeline-dot"></div>
                        <div class="timeline-content">
                            <div class="timeline-info">
                                <span class="timeline-title">Organized ${b.files_moved} file(s) successfully</span>
                                <span class="timeline-meta">Batch ID: <code style="font-family:'JetBrains Mono'; color:var(--primary-light);">${b.batch_id.slice(0, 8)}...</code> | Actioned At: ${b.moved_at}</span>
                            </div>
                            <button class="btn btn-danger" onclick="triggerBatchRollback('${b.batch_id}', this)" style="padding: 8px 16px; font-size: 0.8rem;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M3 2v6h6M21 12A9 9 0 0 0 6 5.3L1.5 10"/></svg>
                                Rollback Session
                            </button>
                        </div>
                    `;
                    timeline.appendChild(card);
                });
            } else {
                timeline.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        <p>No organization history recorded yet. Files moved through the scanner will show up here.</p>
                    </div>
                `;
            }
        }
    } catch (err) {
        console.error("Failed to load batches log:", err);
    }
}

// Dispatch Batch Rollbacks
async function triggerBatchRollback(batchId, buttonElement) {
    const confirmUndo = await showConfirm(
        "Rollback Session",
        "WARNING: Are you absolutely sure you want to rollback this session? This will move all files in this batch back to their original folder paths.",
        true,
        "Rollback Session"
    );
    if (!confirmUndo) return;

    const prevText = buttonElement.innerHTML;
    buttonElement.disabled = true;
    buttonElement.innerHTML = `<svg class="floating" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg> Restoring...`;

    try {
        const response = await fetch('/api/rollback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch_id: batchId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Rollback complete! Successfully restored ${data.rolled_back_count} file(s).`, 'success');
            
            // Reload history timeline lists
            await loadActivityHistory();
            
            // If scanner has active results, refresh it
            const activeInput = document.getElementById('scan-path-input').value;
            if (activeInput && STATE.scanResults) {
                executeScan();
            }
        } else {
            showToast(`Rollback Error: ${data.message}`, 'danger');
        }
    } catch (err) {
        showToast('Communication crash during rollback operation.', 'danger');
        console.error(err);
    } finally {
        buttonElement.disabled = false;
        buttonElement.innerHTML = prevText;
    }
}

// Toast alerts component engine
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-wrapper');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // SVG icons based on toast severity
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--success);"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'danger') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--danger);"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    } else if (type === 'warning') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--warning);"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>`;
    } else {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--info);"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
        <div style="flex-shrink:0;">${iconSvg}</div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Automatically fade out after 4.5 seconds
    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        toast.style.transition = 'transform 0.4s ease';
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}

// Expose critical functions to window scope for HTML inline calls
window.triggerBatchRollback = triggerBatchRollback;

// Deletion Operations implementation
async function deleteOneFile(filepath, filename) {
    const confirmDel = await showConfirm(
        "Delete File",
        `Are you absolutely sure you want to permanently delete:<br><strong>${filename}</strong>?<br><br>This action CANNOT be undone.`,
        true,
        "Delete File"
    );
    if (!confirmDel) return;
    
    await executeDeletion([filepath]);
}

async function deleteSelectedFiles() {
    const count = STATE.selectedFiles.size;
    if (count === 0) return;
    
    const confirmDel = await showConfirm(
        "Delete Selected Files",
        `WARNING: You are about to permanently delete the <strong>${count} selected file(s)</strong>!<br><br>This action CANNOT be undone. Are you sure you want to proceed?`,
        true,
        "Delete Selected"
    );
    if (!confirmDel) return;
    
    const filepaths = Array.from(STATE.selectedFiles);
    await executeDeletion(filepaths);
}

async function executeDeletion(filepaths) {
    try {
        const response = await fetch('/api/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: filepaths })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Successfully deleted ${data.deleted_count} file(s).`, 'success');
            if (data.errors && data.errors.length > 0) {
                data.errors.forEach(err => showToast(err, 'danger'));
            }
            
            // Remove deleted files from current checklist state selection
            filepaths.forEach(fp => STATE.selectedFiles.delete(fp));
            
            // Re-scan directory instantly to refresh UI metrics and tables
            await executeScan();
        } else {
            showToast(`Deletion Error: ${data.message}`, 'danger');
        }
    } catch (err) {
        showToast('Communication crash during deletion execution.', 'danger');
        console.error(err);
    }
}

/**
 * Beautiful glassmorphic confirmation modal instead of browser native confirm().
 */
function showConfirm(title, message, isDanger = false, confirmText = "Confirm") {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-modal-overlay';
        
        const iconSvg = isDanger 
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
            
        overlay.innerHTML = `
            <div class="confirm-modal-box">
                <div class="confirm-modal-header">
                    <div class="confirm-modal-icon ${isDanger ? 'danger' : 'primary'}">
                        ${iconSvg}
                    </div>
                    <div class="confirm-modal-title">${title}</div>
                </div>
                <div class="confirm-modal-body">
                    ${message}
                </div>
                <div class="confirm-modal-footer">
                    <button class="confirm-modal-btn cancel" id="confirm-modal-cancel-btn">Cancel</button>
                    <button class="confirm-modal-btn confirm ${isDanger ? 'danger' : ''}" id="confirm-modal-confirm-btn">${confirmText}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Trigger transition
        setTimeout(() => {
            overlay.classList.add('show');
        }, 20);
        
        const cleanup = (result) => {
            overlay.classList.remove('show');
            document.removeEventListener('keydown', handleKeyDown);
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 200);
        };
        
        const onConfirm = () => cleanup(true);
        const onCancel = () => cleanup(false);
        
        overlay.querySelector('#confirm-modal-confirm-btn').addEventListener('click', onConfirm);
        overlay.querySelector('#confirm-modal-cancel-btn').addEventListener('click', onCancel);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                onCancel();
            }
        });
        
        function handleKeyDown(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            }
        }
        document.addEventListener('keydown', handleKeyDown);
    });
}

/**
 * Premium glassmorphic inline file preview modal.
 * Fetches preview content from the server API and renders images or safe escaped text.
 */
function showPreview(filepath, filename) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'preview-modal-overlay';
        
        overlay.innerHTML = `
            <div class="preview-modal-box">
                <div class="preview-modal-header">
                    <div class="preview-modal-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary-light);"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        File Preview: <span style="color: var(--primary-light);">${filename}</span>
                    </div>
                    <button class="btn-close-modal" id="preview-modal-close-btn" title="Close Preview">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div class="preview-modal-body" id="preview-body-container">
                    <div class="empty-state">
                        <svg class="floating" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                        <p>Loading file preview content...</p>
                    </div>
                </div>
                <div class="preview-modal-footer">
                    <span class="preview-file-size" id="preview-size-badge">Calculating size...</span>
                    <button class="btn btn-secondary" id="preview-modal-close-footer-btn" style="padding: 8px 18px; font-size: 0.82rem;">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Trigger fade in transition
        setTimeout(() => {
            overlay.classList.add('show');
        }, 20);
        
        const cleanup = () => {
            overlay.classList.remove('show');
            document.removeEventListener('keydown', handleKeyDown);
            setTimeout(() => {
                // Ensure all media elements are stopped when closed
                const video = overlay.querySelector('video');
                if (video) {
                    video.pause();
                    video.src = "";
                }
                const audio = overlay.querySelector('audio');
                if (audio) {
                    audio.pause();
                    audio.src = "";
                }
                overlay.remove();
                resolve();
            }, 200);
        };
        
        overlay.querySelector('#preview-modal-close-btn').addEventListener('click', cleanup);
        overlay.querySelector('#preview-modal-close-footer-btn').addEventListener('click', cleanup);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                cleanup();
            }
        });
        
        function handleKeyDown(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                cleanup();
            }
        }
        document.addEventListener('keydown', handleKeyDown);
        
        const ext = filename.split('.').pop().toLowerCase();
        const bodyContainer = overlay.querySelector('#preview-body-container');
        const sizeBadge = overlay.querySelector('#preview-size-badge');
        
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'];
        const videoExtensions = ['mp4', 'webm'];
        const audioExtensions = ['mp3', 'wav', 'ogg'];
        const pdfExtensions = ['pdf'];
        const textExtensions = [
            'txt', 'log', 'ini', 'cfg', 'conf', 'json', 'xml', 'yaml', 'yml',
            'csv', 'tsv', 'md', 'py', 'js', 'ts', 'html', 'css', 'sql', 'sh',
            'bat', 'cmd', 'ps1', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs',
            'rb', 'php', 'aspx', 'jsx', 'tsx', 'toml', 'rst', 'tex'
        ];
        
        // Build the safe endpoint preview URI
        const previewUrl = `/api/preview?path=${encodeURIComponent(filepath)}`;
        
        if (pdfExtensions.includes(ext)) {
            // 1. PDF Embedding inside high-performance native WebView2 iframe container
            bodyContainer.innerHTML = `<iframe class="pdf-preview-element" src="${previewUrl}"></iframe>`;
            sizeBadge.innerText = "PDF Document Content";
        } else if (imageExtensions.includes(ext)) {
            // 2. Direct Image Embedding
            bodyContainer.innerHTML = `<img class="image-preview-element" src="${previewUrl}" alt="${filename}">`;
            sizeBadge.innerText = "Image Loaded Successfully";
        } else if (videoExtensions.includes(ext)) {
            // 3. Hardware accelerated HTML5 Video Player
            bodyContainer.innerHTML = `<video class="video-preview-element" src="${previewUrl}" controls autoplay></video>`;
            sizeBadge.innerText = "Video File Content";
        } else if (audioExtensions.includes(ext)) {
            // 4. Compact elegant Audio Player widget
            bodyContainer.innerHTML = `
                <div class="binary-preview-container" style="padding: 30px;">
                    <svg class="floating" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary-light);"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                    <audio class="audio-preview-element" src="${previewUrl}" controls autoplay></audio>
                    <span style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 15px;">${filename}</span>
                </div>
            `;
            sizeBadge.innerText = "Audio Stream Active";
        } else if (textExtensions.includes(ext)) {
            // 5. Fetch code/plain text up to 100KB safely
            fetch(previewUrl)
                .then(res => {
                    if (!res.ok) throw new Error("Unable to read text content.");
                    return res.json();
                })
                .then(data => {
                    if (data.success && data.type === "text") {
                        const escaped = data.content
                            .replace(/&/g, "&amp;")
                            .replace(/</g, "&lt;")
                            .replace(/>/g, "&gt;")
                            .replace(/"/g, "&quot;")
                            .replace(/'/g, "&#039;");
                            
                        bodyContainer.innerHTML = `<pre class="text-preview-element">${escaped}</pre>`;
                        
                        let sizeStr = "0.00 B";
                        const bytes = data.file_size;
                        if (bytes > 0) {
                            if (bytes < 1024) sizeStr = `${bytes} B`;
                            else if (bytes < 1024 * 1024) sizeStr = `${(bytes/1024).toFixed(2)} KB`;
                            else sizeStr = `${(bytes/(1024*1024)).toFixed(2)} MB`;
                        }
                        sizeBadge.innerText = sizeStr;
                    } else {
                        throw new Error("Text parser failed.");
                    }
                })
                .catch(err => {
                    bodyContainer.innerHTML = `
                        <div class="binary-preview-container" style="color: var(--danger);">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            <p style="font-size: 0.9rem; margin-top: 10px;">Failed to load text preview.</p>
                            <p style="font-size: 0.76rem; color: var(--text-muted);">${err.message}</p>
                        </div>
                    `;
                    sizeBadge.innerText = "Error";
                });
        } else {
            // 6. Direct fallbacks for unsupported binary formats (Archives, Word, Excel, PowerPoint, EXE)
            let fileTypeLabel = "Binary File";
            let fileTypeDesc = "Inline preview not supported for binary file types.";
            let iconColor = "var(--text-muted)";
            
            if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
                fileTypeLabel = "Compressed Archive";
                fileTypeDesc = "This is a compressed archive. You can safely organize it into your 'Archives' folder.";
                iconColor = "var(--warning)";
            } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
                fileTypeLabel = "Office Document";
                fileTypeDesc = "Microsoft Office documents cannot be previewed directly in this simplified viewer.";
                iconColor = "var(--info)";
            } else if (['exe', 'msi', 'apk', 'dmg', 'iso'].includes(ext)) {
                fileTypeLabel = "System Installer / Executable";
                fileTypeDesc = "This is an executable installer. Preview is disabled for security and safety reasons.";
                iconColor = "var(--primary-light)";
            }
            
            bodyContainer.innerHTML = `
                <div class="binary-preview-container">
                    <svg class="binary-preview-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                    <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.1rem; color: #fff; margin-top: 14px; font-weight: 600;">${fileTypeLabel}</h3>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); text-align: center; max-width: 320px; line-height: 1.4; margin-top: 8px;">${fileTypeDesc}</p>
                    <p style="font-size: 0.74rem; color: var(--text-muted); margin-top: 12px; font-style: italic;">This file is ready and will be organized cleanly.</p>
                </div>
            `;
            sizeBadge.innerText = "Binary Format";
        }
    });
}



