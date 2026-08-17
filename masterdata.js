/* ==========================================================================
   BeatBotAdmin - Master Data Controller (Categories, Languages, Countries)
   ========================================================================== */

let currentMasterTab = 'category'; // 'category', 'language', 'country'
let masterDataItems = {
  category: [],
  language: [],
  country: []
};

let editMasterItemTarget = null; // { id, type, name }
let masterDataUnsub = null;
let masterDataListenerActive = false;

/**
 * Called when the Master Data view is opened.
 * Sets up the real-time Firestore listener (only once) and renders current data.
 */
function loadMasterData() {
  // Start the real-time listener if not already active
  if (!masterDataListenerActive) {
    startMasterDataListener();
  }
  // Always render the current data immediately (even if listener hasn't fired yet,
  // we show defaults so the user sees content instantly)
  renderActiveMasterTab();
}

function switchMasterTab(tabName) {
  currentMasterTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
  });
  renderActiveMasterTab();
}

/**
 * Start real-time Firestore listener for `masterData` collection.
 * Called once; the onSnapshot callback auto-fires on every data change.
 */
function startMasterDataListener() {
  if (!db) {
    console.warn("BeatBotAdmin: Firestore not ready for master data listener. Using defaults.");
    loadDefaultMasterData();
    renderActiveMasterTab();
    return;
  }

  // Clean up any previous listener
  if (masterDataUnsub) {
    masterDataUnsub();
    masterDataUnsub = null;
  }

  masterDataListenerActive = true;

  masterDataUnsub = db.collection("masterData").onSnapshot((snap) => {
    masterDataItems = { category: [], language: [], country: [] };
    const seen = { category: new Set(), language: new Set(), country: new Set() };

    snap.forEach(doc => {
      const d = doc.data();
      d.id = doc.id;
      const type = (d.type || '').trim().toLowerCase();
      const name = (d.name || '').trim();

      if ((type === 'category' || type === 'language' || type === 'country') && name) {
        const key = name.toLowerCase();
        if (!seen[type].has(key)) {
          seen[type].add(key);
          masterDataItems[type].push({ id: d.id, type, name });
        }
      }
    });

    // Sort each list alphabetically for consistent display
    ['category', 'language', 'country'].forEach(type => {
      masterDataItems[type].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });

    // If a type is empty in Firestore, show defaults with a "Default" badge
    if (masterDataItems.category.length === 0) {
      masterDataItems.category = [...new Set(DEFAULT_CATEGORIES)].map(c => ({ id: null, type: 'category', name: c }));
    }
    if (masterDataItems.language.length === 0) {
      masterDataItems.language = [...new Set(DEFAULT_LANGUAGES)].map(l => ({ id: null, type: 'language', name: l }));
    }
    if (masterDataItems.country.length === 0) {
      masterDataItems.country = [...new Set(DEFAULT_COUNTRIES)].map(c => ({ id: null, type: 'country', name: c }));
    }

    renderActiveMasterTab();
  }, (err) => {
    console.warn("BeatBotAdmin: Master data listener warning", err);
    // On error, fall back to defaults so the UI is never empty
    loadDefaultMasterData();
    renderActiveMasterTab();
  });
}

/**
 * Load default master data arrays (used when Firestore is unavailable)
 */
function loadDefaultMasterData() {
  masterDataItems = {
    category: DEFAULT_CATEGORIES.map(c => ({ id: null, type: 'category', name: c })),
    language: DEFAULT_LANGUAGES.map(l => ({ id: null, type: 'language', name: l })),
    country: DEFAULT_COUNTRIES.map(c => ({ id: null, type: 'country', name: c }))
  };
}

/**
 * Render active tab grid with search filtering
 */
function renderActiveMasterTab() {
  const container = document.getElementById('master-grid-container');
  const searchInput = document.getElementById('master-search-input');
  const query = searchInput?.value.trim().toLowerCase() || '';

  if (!container) return;

  const rawList = masterDataItems[currentMasterTab] || [];
  const filteredList = rawList.filter(item => (item.name || '').toLowerCase().includes(query));

  if (filteredList.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><p>No items found matching "${escapeHtml(query)}".</p></div>`;
    return;
  }

  container.innerHTML = filteredList.map(item => `
    <div class="taxonomy-item">
      <span>${escapeHtml(item.name)}</span>
      <div style="display: flex; gap: 6px; align-items: center;">
        ${item.id ? `
          <button class="btn btn-sm btn-glass" onclick="openEditMasterItemModal('${item.id}', '${item.type}', '${escapeHtml(item.name)}')" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteMasterItem('${item.id}', '${item.type}', '${escapeHtml(item.name)}')" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        ` : `<span class="pill-badge">Default</span>`}
      </div>
    </div>
  `).join('');
}

/**
 * Add New Item to Active Tab
 * After adding to Firestore, the onSnapshot listener automatically updates the UI.
 */
async function addMasterItemSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('add-master-item-input');
  const name = input?.value.trim();

  if (!name) {
    showToast('Name cannot be empty!', 'error');
    return;
  }

  // Duplicate Check
  const existing = (masterDataItems[currentMasterTab] || []).find(i => i.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    showToast(`"${name}" already exists in ${currentMasterTab}!`, 'error');
    return;
  }

  try {
    if (db) {
      await db.collection("masterData").add({
        type: currentMasterTab,
        name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast(`✔ Added "${name}" to ${currentMasterTab}`, 'success');
      if (input) input.value = '';
      // No need to manually re-fetch — onSnapshot listener auto-updates
    } else {
      showToast('Firebase not connected. Cannot save.', 'error');
    }
  } catch (err) {
    showToast('Failed to add item: ' + err.message, 'error');
  }
}

/**
 * Edit Master Item Modal
 */
function openEditMasterItemModal(id, type, name) {
  editMasterItemTarget = { id, type, name };
  document.getElementById('edit-master-item-input').value = name;
  document.getElementById('modal-edit-master-item')?.classList.add('active');
}

function closeEditMasterItemModal() {
  document.getElementById('modal-edit-master-item')?.classList.remove('active');
  editMasterItemTarget = null;
}

async function saveEditMasterItem() {
  if (!editMasterItemTarget) return;

  const newName = document.getElementById('edit-master-item-input')?.value.trim();
  if (!newName) {
    showToast('Name cannot be empty!', 'error');
    return;
  }

  try {
    if (db) {
      await db.collection("masterData").doc(editMasterItemTarget.id).update({ name: newName });
      showToast(`✔ Updated to "${newName}"`, 'success');
      closeEditMasterItemModal();
      // No need to manually re-fetch — onSnapshot listener auto-updates
    } else {
      showToast('Firebase not connected. Cannot update.', 'error');
    }
  } catch (err) {
    showToast('Failed to edit item: ' + err.message, 'error');
  }
}

/**
 * Delete Master Item
 */
async function deleteMasterItem(id, type, name) {
  if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

  try {
    if (db) {
      await db.collection("masterData").doc(id).delete();
      showToast(`✔ Deleted "${name}"`, 'success');
      // No need to manually re-fetch — onSnapshot listener auto-updates
    } else {
      showToast('Firebase not connected. Cannot delete.', 'error');
    }
  } catch (err) {
    showToast('Failed to delete: ' + err.message, 'error');
  }
}
