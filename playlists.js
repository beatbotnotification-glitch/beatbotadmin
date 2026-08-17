/* ==========================================================================
   BeatBotAdmin - Playlist Manager Controller
   ========================================================================== */

let playlistsList = [];
let deletePlaylistTargetId = null;
let editPlaylistTargetId = null;
let selectedPlaylistCoverFile = null;

async function loadPlaylistsData() {
  // Playlist manager removed from admin panel
  return;
}

function initPlaylistCoverDrop() {
  const input = document.getElementById('playlist-cover-input');
  const wrapper = document.getElementById('playlist-cover-wrapper');

  if (wrapper && input) {
    wrapper.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        selectedPlaylistCoverFile = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
          const img = document.getElementById('playlist-cover-preview');
          const placeholder = document.getElementById('playlist-cover-placeholder');
          if (img) {
            img.src = evt.target.result;
            img.style.display = 'block';
          }
          if (placeholder) placeholder.style.display = 'none';
        };
        reader.readAsDataURL(selectedPlaylistCoverFile);
      }
    });
  }
}

let playlistsUnsub = null;

function fetchPlaylists() {
  const grid = document.getElementById('playlists-grid-container');
  if (grid && playlistsList.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>Loading playlists...</p></div>';
  }

  if (!db) return;

  if (playlistsUnsub) playlistsUnsub();

  playlistsUnsub = db.collection("playlists").onSnapshot((snap) => {
    playlistsList = [];
    snap.forEach(doc => {
      const d = doc.data();
      d.id = doc.id;
      playlistsList.push(d);
    });
    renderPlaylistsGrid();
  }, (err) => {
    console.warn("BeatBotAdmin: Playlists listener warning", err);
  });
}

function renderPlaylistsGrid() {
  const grid = document.getElementById('playlists-grid-container');
  if (!grid) return;

  if (playlistsList.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--text-subtle)"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z"/></svg>
        <p style="margin-top: 8px;">No playlists created yet. Create your first playlist above!</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = playlistsList.map(pl => `
    <div class="glass-card playlist-card-compact">
      <div class="cover-wrapper">
        <img src="${pl.coverImage || 'images/logo.png'}" alt="${escapeHtml(pl.playlistName)}">
        <div class="song-count-badge">
          ${pl.totalSongs || 0} Songs
        </div>
      </div>
      <div class="playlist-title">${escapeHtml(pl.playlistName)}</div>
      <div class="playlist-desc">${escapeHtml(pl.description || 'No description.')}</div>
      
      <div style="display: flex; gap: 6px; margin-top: 10px; justify-content: flex-end;">
        <button class="btn btn-sm btn-glass" style="padding: 4px 10px; font-size: 0.775rem;" onclick="openEditPlaylistModal('${pl.id}', '${escapeHtml(pl.playlistName)}', '${escapeHtml(pl.description || '')}')">Edit</button>
        <button class="btn btn-sm btn-danger" style="padding: 4px 10px; font-size: 0.775rem;" onclick="openDeletePlaylistModal('${pl.id}', '${escapeHtml(pl.playlistName)}')">Delete</button>
      </div>
    </div>
  `).join('');
}


async function createPlaylistSubmit(e) {
  if (e) e.preventDefault();

  const name = document.getElementById('playlist-name')?.value.trim();
  const desc = document.getElementById('playlist-desc')?.value.trim() || '';

  if (!name) {
    showToast('Playlist Name is required!', 'error');
    return;
  }

  try {
    let coverImage = 'images/logo.png';

    if (selectedPlaylistCoverFile) {
      if (typeof uploadToCloudinary === 'function') {
        try {
          showToast('Uploading playlist cover...', 'info');
          coverImage = await uploadToCloudinary(selectedPlaylistCoverFile, 'image');
        } catch (cErr) {
          console.warn("Cloudinary playlist cover error:", cErr);
        }
      } else if (storage) {
        try {
          showToast('Uploading playlist cover to Storage...', 'info');
          const ref = storage.ref(`playlists/${Date.now()}_${selectedPlaylistCoverFile.name}`);
          const task = await ref.put(selectedPlaylistCoverFile);
          coverImage = await task.ref.getDownloadURL();
        } catch (stErr) {
          console.warn("Playlist cover upload error:", stErr);
        }
      }
    }

    if (db) {
      await db.collection("playlists").add({
        playlistName: name,
        description: desc,
        coverImage,
        totalSongs: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    showToast('✔ Playlist Created Successfully', 'success');
    resetPlaylistForm();
    await fetchPlaylists();

  } catch (err) {
    showToast('Error creating playlist: ' + err.message, 'error');
  }
}

function resetPlaylistForm() {
  selectedPlaylistCoverFile = null;
  document.getElementById('create-playlist-form')?.reset();
  const img = document.getElementById('playlist-cover-preview');
  const placeholder = document.getElementById('playlist-cover-placeholder');
  if (img) img.style.display = 'none';
  if (placeholder) placeholder.style.display = 'block';
}

function openEditPlaylistModal(id, name, desc) {
  editPlaylistTargetId = id;
  document.getElementById('edit-playlist-name').value = name;
  document.getElementById('edit-playlist-desc').value = desc;
  document.getElementById('modal-edit-playlist')?.classList.add('active');
}

function closeEditPlaylistModal() {
  document.getElementById('modal-edit-playlist')?.classList.remove('active');
  editPlaylistTargetId = null;
}

async function saveEditPlaylist() {
  if (!editPlaylistTargetId) return;

  const newName = document.getElementById('edit-playlist-name')?.value.trim();
  const newDesc = document.getElementById('edit-playlist-desc')?.value.trim() || '';

  if (!newName) {
    showToast('Playlist Name is required!', 'error');
    return;
  }

  try {
    if (db) {
      await db.collection("playlists").doc(editPlaylistTargetId).update({
        playlistName: newName,
        description: newDesc
      });
    }
    showToast('✔ Playlist Updated', 'success');
    closeEditPlaylistModal();
    await fetchPlaylists();
  } catch (err) {
    showToast('Failed to update playlist: ' + err.message, 'error');
  }
}

function openDeletePlaylistModal(id, name) {
  deletePlaylistTargetId = id;
  const text = document.getElementById('delete-playlist-name-text');
  if (text) text.textContent = `"${name}"`;
  document.getElementById('modal-delete-playlist-confirm')?.classList.add('active');
}

function closeDeletePlaylistModal() {
  document.getElementById('modal-delete-playlist-confirm')?.classList.remove('active');
  deletePlaylistTargetId = null;
}

async function confirmDeletePlaylist() {
  if (!deletePlaylistTargetId) return;

  try {
    if (db) {
      await db.collection("playlists").doc(deletePlaylistTargetId).delete();
    }
    showToast('✔ Playlist Deleted', 'success');
    closeDeletePlaylistModal();
    await fetchPlaylists();
  } catch (err) {
    showToast('Failed to delete playlist: ' + err.message, 'error');
  }
}
