/* ==========================================================================
   BeatBotAdmin - Music Library Controller
   ========================================================================== */

let allSongs = [];
let filteredSongs = [];
let deleteSongTargetId = null;
let editSongTargetId = null;

async function loadLibraryData() {
  await populateLibraryFilters();
  await fetchSongsFromFirestore();
}

/**
 * Fetch All Songs from Firestore
 */
async function fetchSongsFromFirestore() {
  const tbody = document.getElementById('library-table-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <p>Loading songs from Firebase...</p>
        </td>
      </tr>
    `;
  }

  try {
    allSongs = [];
    if (db) {
      const snap = await db.collection("songs").get();
      snap.forEach(doc => {
        const data = doc.data();
        data.id = doc.id;
        allSongs.push(data);
      });
    }

    applyLibraryFilters();
  } catch (err) {
    console.error("BeatBotAdmin: Error fetching songs", err);
    showToast('Failed to load songs from Firebase', 'error');
  }
}

/**
 * Populate Filter Options in Library Header
 */
async function populateLibraryFilters() {
  const catSelect = document.getElementById('filter-category');
  const langSelect = document.getElementById('filter-language');
  const countrySelect = document.getElementById('filter-country');
  const playlistSelect = document.getElementById('filter-playlist');

  try {
    if (db) {
      // Categories
      const cSnap = await db.collection("categories").get();
      if (catSelect) {
        let opts = '<option value="">All Categories</option>';
        cSnap.forEach(d => opts += `<option value="${escapeHtml(d.data().name)}">${escapeHtml(d.data().name)}</option>`);
        catSelect.innerHTML = opts;
      }

      // Languages
      const lSnap = await db.collection("languages").get();
      if (langSelect) {
        let opts = '<option value="">All Languages</option>';
        lSnap.forEach(d => opts += `<option value="${escapeHtml(d.data().name)}">${escapeHtml(d.data().name)}</option>`);
        langSelect.innerHTML = opts;
      }

      // Countries
      const cntSnap = await db.collection("countries").get();
      if (countrySelect) {
        let opts = '<option value="">All Countries</option>';
        cntSnap.forEach(d => opts += `<option value="${escapeHtml(d.data().name)}">${escapeHtml(d.data().name)}</option>`);
        countrySelect.innerHTML = opts;
      }

      // Playlists
      const pSnap = await db.collection("playlists").get();
      if (playlistSelect) {
        let opts = '<option value="">All Playlists</option>';
        pSnap.forEach(d => opts += `<option value="${escapeHtml(d.data().playlistName)}">${escapeHtml(d.data().playlistName)}</option>`);
        playlistSelect.innerHTML = opts;
      }
    }
  } catch (err) {
    console.warn("BeatBotAdmin: Filter population warning", err);
  }
}

/**
 * Apply Search, Filters, and Sorting
 */
function applyLibraryFilters() {
  const searchVal = document.getElementById('library-search')?.value.trim().toLowerCase() || '';
  const catVal = document.getElementById('filter-category')?.value || '';
  const langVal = document.getElementById('filter-language')?.value || '';
  const cntVal = document.getElementById('filter-country')?.value || '';
  const playVal = document.getElementById('filter-playlist')?.value || '';
  const sortVal = document.getElementById('filter-sort')?.value || 'latest';

  filteredSongs = allSongs.filter(song => {
    // 1. Search Query
    if (searchVal) {
      const titleMatch = (song.title || '').toLowerCase().includes(searchVal);
      const artistMatch = (song.artist || '').toLowerCase().includes(searchVal);
      const albumMatch = (song.album || '').toLowerCase().includes(searchVal);
      if (!titleMatch && !artistMatch && !albumMatch) return false;
    }

    // 2. Category / Genre
    if (catVal) {
      if (!song.category || !Array.isArray(song.category) || !song.category.includes(catVal)) return false;
    }

    // 3. Language
    if (langVal && song.language !== langVal) return false;

    // 4. Country
    if (cntVal && song.country !== cntVal) return false;

    // 5. Playlist
    if (playVal && song.playlist !== playVal) return false;

    return true;
  });

  // Sorting
  filteredSongs.sort((a, b) => {
    if (sortVal === 'latest') {
      return (b.uploadDate?.seconds || 0) - (a.uploadDate?.seconds || 0);
    } else if (sortVal === 'oldest') {
      return (a.uploadDate?.seconds || 0) - (b.uploadDate?.seconds || 0);
    } else if (sortVal === 'title') {
      return (a.title || '').localeCompare(b.title || '');
    }
    return 0;
  });

  renderLibraryTable();
}

/**
 * Render Songs Table
 */
function renderLibraryTable() {
  const tbody = document.getElementById('library-table-body');
  if (!tbody) return;

  if (filteredSongs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          <p>No tracks match your current filter criteria.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredSongs.map(song => {
    const catsStr = Array.isArray(song.category) ? song.category.join(', ') : (song.category || 'Single');
    const songJson = JSON.stringify(song).replace(/'/g, "&apos;");

    return `
      <tr>
        <td>
          <div class="song-cell">
            <img src="${song.imageUrl || 'https://via.placeholder.com/80'}" class="song-cover-thumb" alt="${escapeHtml(song.title)}">
            <div>
              <div class="song-title-text">${escapeHtml(song.title)}</div>
              <div class="song-artist-text">${escapeHtml(song.artist || 'Unknown Artist')} ${song.album ? `• ${escapeHtml(song.album)}` : ''}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="pill-badge pill-purple">${escapeHtml(catsStr)}</span>
        </td>
        <td>
          <span class="pill-badge">${escapeHtml(song.language || 'N/A')}</span>
        </td>
        <td>${escapeHtml(song.country || 'Global')}</td>
        <td>
          <span class="pill-badge pill-green">${escapeHtml(song.playlist || 'Single Track')}</span>
        </td>
        <td>${formatDuration(song.duration)}</td>
        <td>
          <div class="actions-cell">
            <button class="icon-btn btn-play" onclick='playTrackPreview(${songJson})' title="Play Preview">
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <button class="icon-btn" onclick="openEditSongModal('${song.id}')" title="Edit Metadata">
              <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            </button>
            <button class="icon-btn btn-delete" onclick="openDeleteConfirmModal('${song.id}', '${escapeHtml(song.title)}')" title="Delete Song">
              <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Edit Song Modal
 */
function openEditSongModal(songId) {
  const song = allSongs.find(s => s.id === songId);
  if (!song) return;

  editSongTargetId = songId;
  const modal = document.getElementById('modal-edit-song');
  
  document.getElementById('edit-song-title').value = song.title || '';
  document.getElementById('edit-song-artist').value = song.artist || '';
  document.getElementById('edit-song-album').value = song.album || '';
  document.getElementById('edit-song-desc').value = song.description || '';
  document.getElementById('edit-song-language').value = song.language || '';
  document.getElementById('edit-song-country').value = song.country || '';

  if (modal) modal.classList.add('active');
}

function closeEditSongModal() {
  const modal = document.getElementById('modal-edit-song');
  if (modal) modal.classList.remove('active');
  editSongTargetId = null;
}

async function saveEditSong() {
  if (!editSongTargetId) return;

  const title = document.getElementById('edit-song-title')?.value.trim();
  const artist = document.getElementById('edit-song-artist')?.value.trim();
  const album = document.getElementById('edit-song-album')?.value.trim();
  const description = document.getElementById('edit-song-desc')?.value.trim();
  const language = document.getElementById('edit-song-language')?.value;
  const country = document.getElementById('edit-song-country')?.value;

  if (!title || !artist) {
    showToast('Title and Artist are required', 'error');
    return;
  }

  try {
    if (db) {
      await db.collection("songs").doc(editSongTargetId).update({
        title,
        artist,
        album,
        description,
        language,
        country
      });
    }

    showToast('Song updated successfully!', 'success');
    closeEditSongModal();
    await fetchSongsFromFirestore();
  } catch (err) {
    showToast('Failed to update song: ' + err.message, 'error');
  }
}

/**
 * Delete Song Confirmation Modal
 */
function openDeleteConfirmModal(songId, songTitle) {
  deleteSongTargetId = songId;
  const modal = document.getElementById('modal-delete-confirm');
  const titleText = document.getElementById('delete-song-title-text');
  if (titleText) titleText.textContent = `"${songTitle}"`;
  if (modal) modal.classList.add('active');
}

function closeDeleteConfirmModal() {
  const modal = document.getElementById('modal-delete-confirm');
  if (modal) modal.classList.remove('active');
  deleteSongTargetId = null;
}

async function confirmDeleteSong() {
  if (!deleteSongTargetId) return;

  try {
    const song = allSongs.find(s => s.id === deleteSongTargetId);
    
    // Delete Firestore document
    if (db) {
      await db.collection("songs").doc(deleteSongTargetId).delete();

      // Decrement playlist totalSongs if applicable
      if (song && song.playlist && song.playlist !== 'Single Track') {
        const pSnap = await db.collection("playlists").where("playlistName", "==", song.playlist).get();
        pSnap.forEach(async (pDoc) => {
          const currentCount = pDoc.data().totalSongs || 1;
          await db.collection("playlists").doc(pDoc.id).update({
            totalSongs: Math.max(0, currentCount - 1)
          });
        });
      }
    }

    showToast('Song successfully deleted!', 'success');
    closeDeleteConfirmModal();
    await fetchSongsFromFirestore();
  } catch (err) {
    showToast('Failed to delete song: ' + err.message, 'error');
  }
}
