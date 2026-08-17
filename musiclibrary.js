/* ==========================================================================
   BeatBotAdmin - Music Library Controller (Edit Fix, Responsive, Delete)
   ========================================================================== */

let allSongs = [];
let filteredSongs = [];

// Pagination State
let currentPage = 1;
let itemsPerPage = 25;

let deleteSongTargetId = null;
let editSongTargetId = null;
let songsUnsubscribe = null;

async function loadLibraryData() {
  await populateLibraryFilters();
  await fetchSongsFromFirestore();
}

/**
 * Real-Time Listener for All Songs in Firestore
 */
function fetchSongsFromFirestore() {
  const tbody = document.getElementById('library-table-body');
  const mobileContainer = document.getElementById('mobile-library-cards');

  if (tbody && allSongs.length === 0) {
    tbody.innerHTML = [1, 2, 3, 4].map(() => `
      <tr>
        <td><div class="skeleton-box skeleton-circle" style="width: 44px; height: 44px; border-radius: 8px;"></div></td>
        <td><div class="skeleton-box skeleton-text" style="width: 140px;"></div></td>
        <td><div class="skeleton-box skeleton-text" style="width: 100px;"></div></td>
        <td><div class="skeleton-box skeleton-text" style="width: 80px;"></div></td>
        <td><div class="skeleton-box skeleton-text" style="width: 70px;"></div></td>
        <td><div class="skeleton-box skeleton-text" style="width: 70px;"></div></td>
        <td><div class="skeleton-box skeleton-text" style="width: 50px;"></div></td>
        <td><div class="skeleton-box skeleton-text" style="width: 90px;"></div></td>
        <td><div class="skeleton-box skeleton-text" style="width: 120px;"></div></td>
      </tr>
    `).join('');
  }

  if (mobileContainer && allSongs.length === 0) {
    mobileContainer.innerHTML = [1, 2, 3].map(() => `
      <div class="skeleton-box skeleton-card" style="margin-bottom: 12px; height: 120px;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <div class="skeleton-box" style="width: 56px; height: 56px; border-radius: 8px;"></div>
          <div style="flex: 1;">
            <div class="skeleton-box skeleton-text" style="width: 70%;"></div>
            <div class="skeleton-box skeleton-text" style="width: 40%;"></div>
          </div>
        </div>
      </div>
    `).join('');
  }

  if (!db) return;

  if (songsUnsubscribe) songsUnsubscribe();

  songsUnsubscribe = db.collection("songs").onSnapshot((snapshot) => {
    allSongs = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      data.id = doc.id;

      // Field alias normalization for legacy songs
      data.title = data.title || data.songTitle || data.name || '';
      data.artist = data.artist || data.artistName || 'Unknown';
      data.album = data.album || data.albumName || '';
      data.category = data.category || data.categories || data.genre || '';
      data.imageUrl = data.imageUrl || data.coverUrl || 'images/logo.png';
      data.coverUrl = data.coverUrl || data.imageUrl || 'images/logo.png';

      allSongs.push(data);
    });
    applyLibraryFilters();
  }, (err) => {
    console.warn("BeatBotAdmin: Songs real-time listener notice", err);
  });
}

/**
 * Populate Library Filters
 */
async function populateLibraryFilters() {
  const catSelect = document.getElementById('filter-category');
  const langSelect = document.getElementById('filter-language');
  const countrySelect = document.getElementById('filter-country');

  try {
    let categories = DEFAULT_CATEGORIES;
    let languages = DEFAULT_LANGUAGES;
    let countries = DEFAULT_COUNTRIES;

    if (db) {
      const mSnap = await db.collection("masterData").get();
      if (!mSnap.empty) {
        const cList = [], lList = [], cntList = [];
        mSnap.forEach(doc => {
          const d = doc.data();
          if (d.type === 'category') cList.push(d.name);
          if (d.type === 'language') lList.push(d.name);
          if (d.type === 'country') cntList.push(d.name);
        });
        if (cList.length) categories = cList;
        if (lList.length) languages = lList;
        if (cntList.length) countries = cntList;
      }
    }

    if (catSelect) catSelect.innerHTML = '<option value="">All Categories</option>' + categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if (langSelect) langSelect.innerHTML = '<option value="">All Languages</option>' + languages.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
    if (countrySelect) countrySelect.innerHTML = '<option value="">All Countries</option>' + countries.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  } catch (err) {
    console.warn("BeatBotAdmin: Filter population warning", err);
  }
}

/**
 * Apply Search, Filters, and Sort Options
 */
function applyLibraryFilters() {
  const searchVal = document.getElementById('library-search')?.value.trim().toLowerCase() || '';
  const catVal = document.getElementById('filter-category')?.value || '';
  const langVal = document.getElementById('filter-language')?.value || '';
  const cntVal = document.getElementById('filter-country')?.value || '';
  const sortVal = document.getElementById('filter-sort')?.value || 'latest';

  filteredSongs = allSongs.filter(song => {
    if (searchVal) {
      const titleMatch = (song.title || '').toLowerCase().includes(searchVal);
      const artistMatch = (song.artist || '').toLowerCase().includes(searchVal);
      const albumMatch = (song.album || '').toLowerCase().includes(searchVal);
      if (!titleMatch && !artistMatch && !albumMatch) return false;
    }

    if (catVal && !((song.category || '').split(',').map(c => c.trim().toLowerCase()).includes(catVal.toLowerCase()))) return false;
    if (langVal && song.language !== langVal) return false;
    if (cntVal && song.country !== cntVal) return false;

    return true;
  });

  filteredSongs.sort((a, b) => {
    const timeA = a.uploadDate?.seconds || 0;
    const timeB = b.uploadDate?.seconds || 0;

    if (sortVal === 'latest') {
      return timeB - timeA;
    } else if (sortVal === 'oldest') {
      return timeA - timeB;
    } else if (sortVal === 'az') {
      return (a.title || '').localeCompare(b.title || '');
    } else if (sortVal === 'za') {
      return (b.title || '').localeCompare(a.title || '');
    }
    return 0;
  });

  currentPage = 1;
  renderLibraryTable();
}

/**
 * Render Paginated Desktop Table & Mobile Cards
 */
function renderLibraryTable() {
  const tbody = document.getElementById('library-table-body');
  const itemsSelect = document.getElementById('pagination-items-per-page');
  if (itemsSelect) itemsPerPage = parseInt(itemsSelect.value) || 25;

  if (!tbody) return;

  if (filteredSongs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--text-subtle)"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <p style="margin-top: 8px;">No matching tracks found.</p>
        </td>
      </tr>
    `;

    const mobileContainer = document.getElementById('mobile-library-cards');
    if (mobileContainer) {
      mobileContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">No matching tracks found.</div>`;
    }
    updatePaginationControls(0);
    return;
  }

  const totalItems = filteredSongs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (currentPage > totalPages) currentPage = totalPages;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const pageSongs = filteredSongs.slice(startIndex, endIndex);

  // 1. Desktop Table Rows
  tbody.innerHTML = pageSongs.map(song => {
    const songJson = JSON.stringify(song).replace(/'/g, "&apos;");
    const dbChoice = song.databaseId || song.cloudinaryDatabase || 'database2';
    const dbBadge = (dbChoice === 'database1')
      ? '<span class="pill-badge pill-purple" style="font-size:0.7rem;">DB 1</span>'
      : '<span class="pill-badge pill-pink" style="font-size:0.7rem;">DB 2</span>';

    return `
      <tr>
        <td>
          <img src="${song.imageUrl || song.coverUrl || 'images/logo.png'}" class="song-cover-thumb" alt="${escapeHtml(song.title)}">
        </td>
        <td>
          <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(song.title)}</div>
          ${song.album ? `<div style="font-size: 0.775rem; color: var(--text-muted);">${escapeHtml(song.album)}</div>` : ''}
        </td>
        <td>${escapeHtml(song.artist || 'Unknown')}</td>
        <td><span class="pill-badge pill-purple">${escapeHtml(song.category || 'Music')}</span></td>
        <td><span class="pill-badge">${escapeHtml(song.language || 'N/A')}</span></td>
        <td>${escapeHtml(song.country || 'Global')} ${dbBadge}</td>
        <td>${formatDuration(song.duration)}</td>
        <td><span style="font-size: 0.8rem; font-weight: 600; color: var(--primary-pink);">${getRelativeTime(song.uploadDate)}</span></td>
        <td>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button class="btn btn-sm btn-primary" onclick='playTrackPreview(${songJson})' title="Play Preview">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <button class="btn btn-sm btn-glass" onclick="openEditSongModal('${song.id}')" title="Edit Song">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            </button>
            <button class="btn btn-sm btn-glass" onclick="copyDocumentId('${song.id}')" title="Copy Document ID">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            </button>
            <button class="btn btn-sm btn-danger" onclick="openDeleteConfirmModal('${song.id}', '${escapeHtml(song.title)}')" title="Delete Song">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // 2. Mobile Song Cards List Container (Requirement 22)
  const mobileContainer = document.getElementById('mobile-library-cards');
  if (mobileContainer) {
    mobileContainer.innerHTML = pageSongs.map(song => {
      const songJson = JSON.stringify(song).replace(/'/g, "&apos;");
      const dbChoice = song.databaseId || song.cloudinaryDatabase || 'database2';
      const dbLabel = dbChoice === 'database1' ? 'Database 1' : 'Database 2';

      return `
        <div class="glass-card mobile-song-card" style="padding: 14px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 12px; border-left: 3px solid var(--primary-pink);">
          <div style="display: flex; gap: 12px; align-items: center;">
            <img src="${song.imageUrl || song.coverUrl || 'images/logo.png'}" style="width: 56px; height: 56px; border-radius: 8px; object-fit: cover;">
            <div style="flex: 1; overflow: hidden;">
              <div style="font-weight: 700; font-size: 1rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(song.title)}</div>
              <div style="font-size: 0.825rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(song.artist || 'Unknown Artist')}</div>
              ${song.album ? `<div style="font-size: 0.75rem; color: var(--text-subtle);">${escapeHtml(song.album)}</div>` : ''}
            </div>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; font-size: 0.75rem;">
            <span class="pill-badge pill-purple">${escapeHtml(song.category || 'Music')}</span>
            <span class="pill-badge">${escapeHtml(song.language || 'N/A')}</span>
            <span class="pill-badge pill-pink">${dbLabel}</span>
            <span style="color: var(--text-muted); margin-left: auto;">${formatDuration(song.duration)}</span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; pt-2; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 4px;">
            <button class="btn btn-sm btn-primary" onclick='playTrackPreview(${songJson})' style="padding: 6px 12px; font-size: 0.8rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z"/></svg> Play
            </button>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-sm btn-glass" onclick="openEditSongModal('${song.id}')" style="padding: 6px 12px; font-size: 0.8rem;">
                Edit
              </button>
              <button class="btn btn-sm btn-danger" onclick="openDeleteConfirmModal('${song.id}', '${escapeHtml(song.title)}')" style="padding: 6px 12px; font-size: 0.8rem;">
                Delete
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  updatePaginationControls(totalItems);
}

function updatePaginationControls(totalItems) {
  const info = document.getElementById('pagination-info');
  const prevBtn = document.getElementById('btn-prev-page');
  const nextBtn = document.getElementById('btn-next-page');

  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const start = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);

  if (info) info.textContent = `Showing ${start}-${end} of ${totalItems} tracks (Page ${currentPage} of ${totalPages})`;

  if (prevBtn) prevBtn.disabled = (currentPage <= 1);
  if (nextBtn) nextBtn.disabled = (currentPage >= totalPages);
}

function changePage(direction) {
  const totalPages = Math.ceil(filteredSongs.length / itemsPerPage);
  currentPage += direction;
  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;
  renderLibraryTable();
}

function copyDocumentId(docId) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(docId).then(() => {
      showToast('Document ID copied to clipboard!', 'success');
    }).catch(err => {
      showToast('Doc ID: ' + docId, 'success');
    });
  } else {
    showToast('Doc ID: ' + docId, 'success');
  }
}

/**
 * Requirements 13 - 18: Edit Song Modal Pre-loading & Multi-Tag Category Selection
 */
async function openEditSongModal(songId) {
  const song = allSongs.find(s => s.id === songId);
  if (!song) return;

  editSongTargetId = songId;

  // Pre-load Title, Artist, Album, Lyrics, Description with legacy alias fallbacks
  const titleVal = song.title || song.songTitle || song.name || '';
  const artistVal = song.artist || song.artistName || '';
  const albumVal = song.album || song.albumName || '';
  const lyricsVal = song.lyrics || '';
  const descVal = song.description || '';

  if (document.getElementById('edit-song-title')) document.getElementById('edit-song-title').value = titleVal;
  if (document.getElementById('edit-song-artist')) document.getElementById('edit-song-artist').value = artistVal;
  if (document.getElementById('edit-song-album')) document.getElementById('edit-song-album').value = albumVal;
  if (document.getElementById('edit-song-lyrics')) document.getElementById('edit-song-lyrics').value = lyricsVal;
  if (document.getElementById('edit-song-desc')) document.getElementById('edit-song-desc').value = descVal;

  const langSelect = document.getElementById('edit-song-language');
  const cntSelect = document.getElementById('edit-song-country');
  const catContainer = document.getElementById('edit-category-checkboxes');

  let categories = DEFAULT_CATEGORIES;
  let languages = DEFAULT_LANGUAGES;
  let countries = DEFAULT_COUNTRIES;

  if (db) {
    try {
      const mSnap = await db.collection("masterData").get();
      if (!mSnap.empty) {
        const cSet = new Set(), lSet = new Set(), cntSet = new Set();
        mSnap.forEach(doc => {
          const d = doc.data();
          const name = (d.name || '').trim();
          if (!name) return;
          if (d.type === 'category') cSet.add(name);
          if (d.type === 'language') lSet.add(name);
          if (d.type === 'country') cntSet.add(name);
        });
        if (cSet.size > 0) categories = Array.from(cSet);
        if (lSet.size > 0) languages = Array.from(lSet);
        if (cntSet.size > 0) countries = Array.from(cntSet);
      }
    } catch (e) {
      console.warn("Master data fetch notice for edit modal", e);
    }
  }

  categories = [...new Set(categories.map(c => c.trim()))].sort((a, b) => a.localeCompare(b));
  languages = [...new Set(languages.map(l => l.trim()))].sort((a, b) => a.localeCompare(b));
  countries = [...new Set(countries.map(c => c.trim()))].sort((a, b) => a.localeCompare(b));

  // Current categories assigned to this song (handles string or array format)
  let rawCategoryStr = song.category || song.categories || song.genre || '';
  if (Array.isArray(rawCategoryStr)) {
    rawCategoryStr = rawCategoryStr.join(', ');
  }
  const existingCatList = rawCategoryStr.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);

  if (catContainer) {
    catContainer.innerHTML = categories.map(c => {
      const isChecked = existingCatList.includes(c.toLowerCase());
      return `
        <label class="tag-checkbox">
          <input type="checkbox" name="edit-category-tag" value="${escapeHtml(c)}" ${isChecked ? 'checked' : ''}>
          <span>${escapeHtml(c)}</span>
        </label>
      `;
    }).join('');
  }

  const currentLang = (song.language || '').toLowerCase();
  if (langSelect) {
    langSelect.innerHTML = '<option value="">Select Language</option>' + languages.map(l => `<option value="${escapeHtml(l)}" ${l.toLowerCase() === currentLang ? 'selected' : ''}>${escapeHtml(l)}</option>`).join('');
  }

  const currentCountry = (song.country || '').toLowerCase();
  if (cntSelect) {
    cntSelect.innerHTML = '<option value="">Select Country</option>' + countries.map(c => `<option value="${escapeHtml(c)}" ${c.toLowerCase() === currentCountry ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
  }

  const modal = document.getElementById('modal-edit-song');
  if (modal) modal.classList.add('active');
}

/**
 * Requirement 20: Edit Cancel
 */
function closeEditSongModal() {
  document.getElementById('modal-edit-song')?.classList.remove('active');
  editSongTargetId = null;
}

/**
 * Requirement 19: Edit Save
 * Updates EXISTING song document without changing ID, creating duplicates, or re-uploading files
 */
async function saveEditSong() {
  if (!editSongTargetId) return;

  const title = document.getElementById('edit-song-title')?.value.trim();
  const artist = document.getElementById('edit-song-artist')?.value.trim();
  const album = document.getElementById('edit-song-album')?.value.trim() || '';
  const language = document.getElementById('edit-song-language')?.value || '';
  const country = document.getElementById('edit-song-country')?.value || '';
  const description = document.getElementById('edit-song-desc')?.value.trim() || '';
  const lyrics = document.getElementById('edit-song-lyrics')?.value.trim() || '';

  const selectedCategories = [];
  document.querySelectorAll('input[name="edit-category-tag"]:checked').forEach(cb => {
    selectedCategories.push(cb.value);
  });

  if (!title || !artist) {
    showToast('Title and Artist are required!', 'error');
    return;
  }
  if (selectedCategories.length === 0) {
    showToast('Please select at least one Category / Genre!', 'error');
    return;
  }

  try {
    if (db) {
      await db.collection("songs").doc(editSongTargetId).update({
        title,
        artist,
        album,
        language,
        country,
        category: selectedCategories.join(', '),
        description,
        lyrics
      });
    }
    showToast('✓ Song details updated successfully', 'success');
    closeEditSongModal();
    await fetchSongsFromFirestore();
  } catch (err) {
    showToast('Failed to update song: ' + err.message, 'error');
  }
}

/**
 * Helper: Parse Cloudinary public ID from URL
 */
function extractCloudinaryPublicId(url) {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return null;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    let path = parts[1];
    path = path.replace(/^v\d+\//, '');
    const lastDot = path.lastIndexOf('.');
    if (lastDot > 0) {
      path = path.substring(0, lastDot);
    }
    return path || null;
  } catch (e) {
    return null;
  }
}

/**
 * Helper: Call backend API to delete Cloudinary asset securely
 */
async function requestCloudinaryDeletion(publicId, resourceType, databaseId) {
  if (!publicId) return;
  try {
    await apiRequest('/.netlify/functions/delete-cloudinary-asset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        public_id: publicId,
        resource_type: resourceType,
        database_id: databaseId || 'database2'
      })
    });
  } catch (err) {
    console.warn("BeatBotAdmin: Cloudinary deletion request notice", err);
  }
}

function openDeleteConfirmModal(songId, title) {
  deleteSongTargetId = songId;
  const text = document.getElementById('delete-song-title-text');
  if (text) text.textContent = `"${title}"`;
  document.getElementById('modal-delete-confirm')?.classList.add('active');
}

function closeDeleteConfirmModal() {
  document.getElementById('modal-delete-confirm')?.classList.remove('active');
  deleteSongTargetId = null;
}

async function confirmDeleteSong() {
  if (!deleteSongTargetId) return;

  const song = allSongs.find(s => s.id === deleteSongTargetId);
  const deleteBtn = document.querySelector('#modal-delete-confirm .btn-danger');
  const originalText = deleteBtn ? deleteBtn.textContent : 'Confirm Delete';

  if (deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';
  }

  try {
    if (song) {
      const dbChoice = song.databaseId || song.cloudinaryDatabase || 'database2';

      // 1. Delete Cover Image Asset
      const imgPublicId = song.coverPublicId || song.imagePublicId || extractCloudinaryPublicId(song.imageUrl || song.coverUrl);
      if (imgPublicId) {
        await requestCloudinaryDeletion(imgPublicId, 'image', dbChoice);
      }

      // 2. Delete Audio Asset
      const audPublicId = song.audioPublicId || extractCloudinaryPublicId(song.audioUrl);
      if (audPublicId) {
        await requestCloudinaryDeletion(audPublicId, 'video', dbChoice);
      }
    }

    // 3. Delete Firestore Document
    if (db) {
      await db.collection("songs").doc(deleteSongTargetId).delete();
    }

    closeDeleteConfirmModal();
    showDeleteSuccessAnimation();

    // Update local state & refresh Dashboard statistics
    allSongs = allSongs.filter(s => s.id !== deleteSongTargetId);
    applyLibraryFilters();

    if (typeof loadDashboardData === 'function') {
      loadDashboardData();
    }
  } catch (err) {
    console.error("BeatBotAdmin: Delete track error", err);
    showToast('❌ Unable to delete song: ' + err.message, 'error');
  } finally {
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.textContent = originalText;
    }
  }
}

function showDeleteSuccessAnimation() {
  const existing = document.getElementById('delete-success-toast-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'delete-success-toast-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 10000;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95));
    color: #FFF;
    padding: 14px 22px;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 700;
    font-size: 0.95rem;
    animation: fadeInSlide 0.3s ease-out forwards;
  `;

  overlay.innerHTML = `
    <div style="width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFF"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
    </div>
    <span>✓ Song deleted successfully</span>
  `;

  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';
    setTimeout(() => overlay.remove(), 300);
  }, 2500);
}
