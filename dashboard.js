/* ==========================================================================
   BeatBotAdmin - Dashboard Controller (100% Pure Secure Firebase API Architecture)
   ========================================================================== */

let dashSongsUnsub = null;
let dashNotificationsUnsub = null;
let notificationSyncInterval = null;

let editNotificationTargetId = null;
let deleteNotificationTargetId = null;
let removeNewReleaseTargetId = null;

let countdownTickerInterval = null;
let liveNewReleaseTickerInterval = null;

let currentDashState = {
  songs: [],
  totalArtists: 0,
  selectedNewReleaseIds: new Set(),
  tempNewReleaseIds: new Set()
};

/**
 * Main Entry Point: Initialize Dashboard Data & Realtime Listeners
 */
function loadDashboardData() {
  if (!db && typeof initFirebase === 'function') {
    initFirebase();
  }

  // 1. Load Songs real-time listener (Counts Database 1 + Database 2 songs)
  if (db && !dashSongsUnsub) {
    dashSongsUnsub = db.collection("songs").onSnapshot((snap) => {
      const songsList = [];
      const artistsSet = new Set();
      const newReleaseSet = new Set();

      snap.forEach(doc => {
        const data = doc.data();
        data.id = doc.id;
        songsList.push(data);

        // Case-insensitive unique artist tracking across all songs
        if (data.artist && data.artist.trim()) {
          artistsSet.add(data.artist.trim().toLowerCase());
        }

        if (data.isNewRelease || data.isNewReleased) {
          newReleaseSet.add(doc.id);
        }
      });

      songsList.sort((a, b) => {
        const tA = a.uploadDate?.seconds || (a.uploadDate ? new Date(a.uploadDate).getTime() / 1000 : 0);
        const tB = b.uploadDate?.seconds || (b.uploadDate ? new Date(b.uploadDate).getTime() / 1000 : 0);
        return tB - tA;
      });

      currentDashState.songs = songsList;
      currentDashState.totalArtists = artistsSet.size;
      currentDashState.selectedNewReleaseIds = newReleaseSet;

      renderDashUI();
      renderNewReleasesSection();
    }, (err) => {
      console.warn("BeatBotAdmin: Songs dashboard listener notice", err);
    });
  }

  // 2. Load Active Notifications via direct Firebase SDK Real-time Listener
  loadAdminMessagesData();

  // Start live 30-second countdown ticker for notifications
  if (!countdownTickerInterval) {
    countdownTickerInterval = setInterval(() => {
      updateNotificationCountdownsInDOM();
    }, 30000);
  }

  // Start live 1-second ticker for New Releases relative time tags
  if (!liveNewReleaseTickerInterval) {
    liveNewReleaseTickerInterval = setInterval(() => {
      updateLiveNewReleaseTimesInDOM();
    }, 1000);
  }
}

/**
 * Helper: Resolve Firebase 3 Firestore Instance (beatbotnotification-89aff)
 * Guarantees connection to project beatbotnotification-89aff and NEVER falls back to beatbotadmin.
 */
function getNotificationDb() {
  if (typeof window !== 'undefined' && window.notificationDb && window.notificationDb.app && window.notificationDb.app.options && window.notificationDb.app.options.projectId === "beatbotnotification-89aff") {
    return window.notificationDb;
  }

  if (typeof firebase !== 'undefined') {
    let app = firebase.apps.find(a => a.name === "beatbotNotificationApp");
    if (!app) {
      const config = (typeof window !== 'undefined' && window.notificationFirebaseConfig)
        ? window.notificationFirebaseConfig
        : {
            apiKey: "AIzaSyCKFKz7ljt3IXL-b71kYBVguXakgQ2EBqg",
            authDomain: "beatbotnotification-89aff.firebaseapp.com",
            projectId: "beatbotnotification-89aff",
            storageBucket: "beatbotnotification-89aff.firebasestorage.app",
            messagingSenderId: "66215473820",
            appId: "1:66215473820:web:59cdcb7412da36d9b5b359",
            measurementId: "G-19STZY0BKC"
          };
      try {
        app = firebase.initializeApp(config, "beatbotNotificationApp");
      } catch (e) {
        try { app = firebase.app("beatbotNotificationApp"); } catch (err) {}
      }
    }
    if (app) {
      const targetDb = app.firestore();
      if (typeof window !== 'undefined') {
        window.notificationApp = app;
        window.notificationDb = targetDb;
      }
      return targetDb;
    }
  }
  throw new Error("Could not initialize Firebase project beatbotnotification-89aff");
}

/**
 * Pure Direct Firebase SDK Notifications Real-time Listener
 * Listens directly to Firestore collection "notifications" in beatbotnotification-89aff
 */
function loadAdminMessagesData() {
  try {
    const targetDb = getNotificationDb();
    const app = targetDb.app;
    console.log("Notification Firebase project:", app.options.projectId);
    console.log("Firestore notification collection: notifications");

    if (dashNotificationsUnsub) {
      try { dashNotificationsUnsub(); } catch (e) {}
      dashNotificationsUnsub = null;
    }

    dashNotificationsUnsub = targetDb.collection("notifications")
      .orderBy("createdAt", "desc")
      .onSnapshot((snap) => {
        const notes = [];
        snap.forEach(doc => {
          const data = doc.data();
          data.id = doc.id;
          notes.push(data);
        });
        renderAdminMessagesList(notes);
      }, (err) => {
        console.error("BeatBotAdmin: Notifications Firestore listener error:", err);
      });
  } catch (err) {
    console.error("BeatBotAdmin: Notifications setup error:", err);
  }
}

/**
 * Send Notification Directly to Firebase Firestore (beatbotnotification-89aff)
 * Available immediately to all BeatBot Android App Users (com.aistudio.beatbot.musicservice)
 */
async function handleBroadcastSubmit(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  const titleInput = document.getElementById('broadcast-title');
  const messageInput = document.getElementById('broadcast-message');
  const title = (titleInput?.value || '').trim();
  const message = (messageInput?.value || '').trim();

  if (!title || !message) {
    showToast('Please enter both Message Title and Content!', 'error');
    return false;
  }

  const sendBtn = document.getElementById('btn-send-broadcast');
  const originalBtnContent = sendBtn ? sendBtn.innerHTML : 'Send Message';

  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = `Sending...`;
  }

  try {
    const targetDb = getNotificationDb();
    const app = targetDb.app;

    // Strict validation and logging per requirements
    console.log("Notification Firebase project:", app.options.projectId);
    console.log("Firestore notification collection: notifications");

    if (app.options.projectId !== "beatbotnotification-89aff") {
      throw new Error(`Invalid Firebase project connected (${app.options.projectId}). Expected beatbotnotification-89aff.`);
    }

    const now = new Date();
    const expiresAtDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // exactly 24 hours

    const notificationData = {
      title: title,
      content: message,
      message: message,
      sender: "BeatBot Team",
      type: "announcement",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      expiresAt: firebase.firestore.Timestamp.fromDate(expiresAtDate),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await targetDb.collection("notifications").add(notificationData);
    await docRef.update({ id: docRef.id });

    showToast('✓ Notification sent successfully to all BeatBot app users!', 'success');
    document.getElementById('broadcast-form')?.reset();
  } catch (err) {
    console.error("BeatBotAdmin: Send notification Firestore error:", err);
    showToast('Failed to send notification: ' + err.message, 'error');
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = originalBtnContent;
    }
  }

  return false;
}

// Global Alias for form handlers
window.sendAdminBroadcastMessage = handleBroadcastSubmit;

/**
 * Render Active Notifications (Hides expired notifications immediately)
 */
function renderAdminMessagesList(messages) {
  const container = document.getElementById('admin-messages-list');
  if (!container) return;

  const nowMs = Date.now();
  const activeNotes = (messages || []).filter(msg => {
    let expMs = 0;
    if (msg.expiresAt) {
      if (msg.expiresAt.toDate && typeof msg.expiresAt.toDate === 'function') {
        expMs = msg.expiresAt.toDate().getTime();
      } else if (msg.expiresAt.seconds) {
        expMs = msg.expiresAt.seconds * 1000;
      } else if (msg.expiresAt instanceof Date) {
        expMs = msg.expiresAt.getTime();
      } else if (!isNaN(new Date(msg.expiresAt).getTime())) {
        expMs = new Date(msg.expiresAt).getTime();
      }
    }
    return !expMs || expMs > nowMs;
  });

  if (activeNotes.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 24px 16px; color: var(--text-muted); font-size: 0.85rem; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.06);">
        No active notifications found.<br>
        <span style="font-size: 0.75rem; color: var(--text-subtle);">Send an announcement above to notify all BeatBot music app users!</span>
      </div>
    `;
    return;
  }

  container.innerHTML = activeNotes.map(msg => {
    const isPermanent = !msg.expiresAt;
    const countdownText = isPermanent ? 'Permanent' : format24hCountdown(msg.createdAt, msg.expiresAt);
    const formattedSentTime = formatExactDateTime(msg.createdAt);
    const msgContent = msg.content || msg.message || '';

    return `
      <div class="glass-card notification-history-card" data-expires="${msg.expiresAt?.seconds ? msg.expiresAt.seconds * 1000 : (msg.expiresAt || '')}" data-created="${msg.createdAt?.seconds ? msg.createdAt.seconds * 1000 : (msg.createdAt || '')}" style="padding: 12px 14px; margin-bottom: 10px; border-left: 3px solid var(--primary-pink); display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">${escapeHtml(msg.title || 'Notification')}</div>
          <div class="countdown-badge" style="font-size: 0.725rem; color: var(--primary-pink); font-weight: 700; background: rgba(255, 45, 141, 0.1); padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(255, 45, 141, 0.25);">
            ⏳ ${countdownText}
          </div>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-muted); white-space: pre-wrap;">${escapeHtml(msgContent)}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; pt-2; border-top: 1px solid rgba(255,255,255,0.06);">
          <span style="font-size: 0.725rem; color: var(--text-subtle);">Sent: ${formattedSentTime}</span>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm btn-glass" onclick="openEditNotificationModal('${msg.id}', '${escapeHtml(msg.title || '').replace(/'/g, "\\'")}', '${escapeHtml(msgContent).replace(/'/g, "\\'")}')" style="padding: 4px 10px; font-size: 0.75rem;">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="openDeleteNotificationModal('${msg.id}')" style="padding: 4px 10px; font-size: 0.75rem;">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function updateNotificationCountdownsInDOM() {
  const cards = document.querySelectorAll('.notification-history-card');
  cards.forEach(card => {
    const expires = card.getAttribute('data-expires');
    const created = card.getAttribute('data-created');
    const badge = card.querySelector('.countdown-badge');
    if (badge) {
      badge.textContent = `⏳ ${format24hCountdown(created, expires)}`;
    }
  });
}

function format24hCountdown(createdAt, expiresAt) {
  let expMs = 0;
  if (expiresAt) {
    if (expiresAt.toDate && typeof expiresAt.toDate === 'function') expMs = expiresAt.toDate().getTime();
    else if (expiresAt.seconds) expMs = expiresAt.seconds * 1000;
    else if (expiresAt instanceof Date) expMs = expiresAt.getTime();
    else if (!isNaN(new Date(expiresAt).getTime())) expMs = new Date(expiresAt).getTime();
    else if (typeof expiresAt === 'number') expMs = expiresAt;
  }

  if (!expMs && createdAt) {
    let createdMs = 0;
    if (createdAt.toDate && typeof createdAt.toDate === 'function') createdMs = createdAt.toDate().getTime();
    else if (createdAt.seconds) createdMs = createdAt.seconds * 1000;
    else if (createdAt instanceof Date) createdMs = createdAt.getTime();
    else if (!isNaN(new Date(createdAt).getTime())) createdMs = new Date(createdAt).getTime();
    else if (typeof createdAt === 'number') createdMs = createdAt;

    if (createdMs) expMs = createdMs + 24 * 60 * 60 * 1000;
  }

  if (!expMs) return '24h 00m remaining';

  const diffMs = expMs - Date.now();
  if (diffMs <= 0) return 'Expired';

  const totalMin = Math.floor(diffMs / (1000 * 60));
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins < 10 ? '0' + mins : mins}m remaining`;
  }
  return `${mins}m remaining`;
}

/**
 * Edit Notification Directly in Firebase Firestore
 */
function openEditNotificationModal(id, title, message) {
  editNotificationTargetId = id;
  if (document.getElementById('edit-notification-title')) document.getElementById('edit-notification-title').value = title;
  if (document.getElementById('edit-notification-message')) document.getElementById('edit-notification-message').value = message;

  const modal = document.getElementById('modal-edit-notification');
  if (modal) modal.classList.add('active');
}

function closeEditNotificationModal() {
  const modal = document.getElementById('modal-edit-notification');
  if (modal) modal.classList.remove('active');
  editNotificationTargetId = null;
}

async function saveEditNotification() {
  if (!editNotificationTargetId) return;

  const newTitle = document.getElementById('edit-notification-title')?.value.trim();
  const newMessage = document.getElementById('edit-notification-message')?.value.trim();

  if (!newTitle || !newMessage) {
    showToast('Title and Content cannot be empty!', 'error');
    return;
  }

  try {
    const targetDb = getNotificationDb();
    if (!targetDb) throw new Error("Firebase Notification database is not initialized");

    const now = new Date();
    await targetDb.collection("notifications").doc(editNotificationTargetId).update({
      title: newTitle,
      content: newMessage,
      message: newMessage,
      updatedAt: firebase.firestore.Timestamp.fromDate(now)
    });

    showToast('✓ Notification updated successfully', 'success');
    closeEditNotificationModal();
  } catch (err) {
    console.error("BeatBotAdmin: Save edit notification error:", err);
    showToast('Failed to update notification: ' + err.message, 'error');
  }
}

/**
 * Delete Notification Directly from Firebase Firestore
 */
function openDeleteNotificationModal(id) {
  deleteNotificationTargetId = id;
  const modal = document.getElementById('modal-delete-notification-confirm');
  if (modal) modal.classList.add('active');
}

function closeDeleteNotificationModal() {
  const modal = document.getElementById('modal-delete-notification-confirm');
  if (modal) modal.classList.remove('active');
  deleteNotificationTargetId = null;
}

async function confirmDeleteNotification() {
  if (!deleteNotificationTargetId) return;

  try {
    const targetDb = getNotificationDb();
    if (!targetDb) throw new Error("Firebase Notification database is not initialized");

    await targetDb.collection("notifications").doc(deleteNotificationTargetId).delete();

    showToast('✓ Notification deleted successfully', 'success');
    closeDeleteNotificationModal();
  } catch (err) {
    console.error("BeatBotAdmin: Delete notification error:", err);
    showToast('Failed to delete notification: ' + err.message, 'error');
  }
}

/**
 * Render Dashboard Summary UI (Total Songs, Total Artists)
 */
function renderDashUI() {
  updateDashboardUI({
    totalSongs: currentDashState.songs.length,
    totalArtists: currentDashState.totalArtists || 0,
    recentSongs: (currentDashState.songs || []).slice(0, 5)
  });
}

function updateDashboardUI(stats) {
  const songsVal = document.getElementById('stat-total-songs');
  const artistsVal = document.getElementById('stat-total-artists');
  const recentTable = document.getElementById('dashboard-recent-table');

  if (songsVal) songsVal.textContent = stats.totalSongs || 0;
  if (artistsVal) artistsVal.textContent = stats.totalArtists || 0;

  if (recentTable) {
    if (stats.recentSongs.length === 0) {
      recentTable.innerHTML = `
        <tr>
          <td colspan="4" class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--text-subtle)"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
            <p style="margin-top: 8px;">No songs uploaded yet. Click "Upload Track" to get started!</p>
          </td>
        </tr>
      `;
      return;
    }

    recentTable.innerHTML = stats.recentSongs.map(song => `
      <tr>
        <td>
          <div class="song-cell">
            <img src="${song.imageUrl || song.coverUrl || 'images/logo.png'}" class="song-cover-thumb" alt="${escapeHtml(song.title)}">
            <div>
              <div class="song-title-text" style="font-weight: 700;">${escapeHtml(song.title)}</div>
              <div class="song-artist-text" style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(song.artist || 'Unknown Artist')}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="pill-badge pill-purple">${escapeHtml(song.category || 'Music')}</span>
        </td>
        <td>
          <span style="font-size: 0.825rem; font-weight: 600; color: var(--primary-pink);">${getRelativeTime(song.uploadDate)}</span>
        </td>
        <td>
          <button class="btn btn-sm btn-primary" onclick='playTrackPreview(${JSON.stringify(song).replace(/'/g, "&apos;")})' title="Play Preview">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z"/></svg> Play
          </button>
        </td>
      </tr>
    `).join('');
  }
}

/**
 * Live Auto-Updating Relative Time Calculation for New Releases
 */
function formatLiveRelativeTime(timestamp) {
  if (!timestamp) return 'just now';

  let dateObj;
  if (timestamp.seconds) {
    dateObj = new Date(timestamp.seconds * 1000);
  } else if (timestamp instanceof Date) {
    dateObj = timestamp;
  } else {
    dateObj = new Date(timestamp);
  }

  if (isNaN(dateObj.getTime())) return 'just now';

  const nowMs = Date.now();
  const diffMs = Math.max(0, nowMs - dateObj.getTime());
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'min' : 'mins'} ago`;

  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} ${diffHrs === 1 ? 'hour' : 'hours'} ago`;

  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
}

function updateLiveNewReleaseTimesInDOM() {
  const timeTags = document.querySelectorAll('.new-release-time-tag');
  timeTags.forEach(tag => {
    const addedMs = parseInt(tag.getAttribute('data-added'), 10);
    if (addedMs && !isNaN(addedMs)) {
      tag.textContent = formatLiveRelativeTime(addedMs);
    }
  });
}

function renderNewReleasesSection() {
  const container = document.getElementById('dashboard-new-releases-grid');
  if (!container) return;

  const newReleaseSongs = currentDashState.songs.filter(s => currentDashState.selectedNewReleaseIds.has(s.id));

  if (newReleaseSongs.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 24px; color: var(--text-muted); background: var(--bg-elevated, rgba(255,255,255,0.02)); border-radius: var(--radius-md);">
        <p style="margin: 0; font-size: 0.9rem;">No Newly Released songs currently designated.</p>
        <button class="btn btn-sm btn-primary" onclick="openManageNewReleasesModal()" style="margin-top: 12px;">+ Select Newly Released Songs</button>
      </div>
    `;
    return;
  }

  container.innerHTML = newReleaseSongs.map(song => {
    const rawAdded = song.newReleaseAddedAt || song.uploadDate;
    let addedMs = Date.now();
    if (rawAdded) {
      if (rawAdded.seconds) addedMs = rawAdded.seconds * 1000;
      else if (rawAdded instanceof Date) addedMs = rawAdded.getTime();
      else if (!isNaN(new Date(rawAdded).getTime())) addedMs = new Date(rawAdded).getTime();
    }

    const relTimeText = formatLiveRelativeTime(addedMs);

    return `
      <div class="glass-card" style="padding: 14px; display: flex; flex-direction: column; gap: 10px; border-top: 3px solid var(--primary-pink);">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1; overflow: hidden;">
            <img src="${song.imageUrl || song.coverUrl || 'images/logo.png'}" alt="Cover" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover;">
            <div style="flex: 1; overflow: hidden;">
              <div style="font-weight: 700; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main);">${escapeHtml(song.title)}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(song.artist)}</div>
            </div>
          </div>
          <span class="new-release-time-tag" data-added="${addedMs}" style="font-size: 0.775rem; font-weight: 700; color: var(--primary-pink); background: rgba(255, 45, 141, 0.1); padding: 4px 10px; border-radius: 12px; border: 1px solid rgba(255, 45, 141, 0.25); white-space: nowrap;">
            ${relTimeText}
          </span>
        </div>

        <div style="display: flex; align-items: center; justify-content: flex-end; pt-2; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 4px;">
          <button class="btn btn-sm btn-danger" onclick="openRemoveNewReleaseModal('${song.id}', '${escapeHtml(song.title).replace(/'/g, "\\'")}')" style="padding: 4px 12px; font-size: 0.75rem;">
            Remove
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function openRemoveNewReleaseModal(songId, title) {
  removeNewReleaseTargetId = songId;
  const text = document.getElementById('remove-new-release-title-text');
  if (text) text.textContent = `"${title}"`;

  const modal = document.getElementById('modal-remove-new-release-confirm');
  if (modal) modal.classList.add('active');
}

function closeRemoveNewReleaseModal() {
  const modal = document.getElementById('modal-remove-new-release-confirm');
  if (modal) modal.classList.remove('active');
  removeNewReleaseTargetId = null;
}

async function confirmRemoveNewReleaseTrack() {
  if (!db || !removeNewReleaseTargetId) return;

  try {
    await db.collection("songs").doc(removeNewReleaseTargetId).update({
      isNewRelease: false,
      isNewReleased: false
    });
    currentDashState.selectedNewReleaseIds.delete(removeNewReleaseTargetId);
    renderNewReleasesSection();
    closeRemoveNewReleaseModal();
    showToast('✔ Song removed from New Releases (Remains in Music Library)', 'success');
  } catch (err) {
    showToast('Failed to remove from New Releases: ' + err.message, 'error');
  }
}

function openManageNewReleasesModal() {
  currentDashState.tempNewReleaseIds = new Set(currentDashState.selectedNewReleaseIds);
  renderNewReleasesSelectionList();

  const searchInput = document.getElementById('new-releases-search');
  if (searchInput) searchInput.value = '';

  const modal = document.getElementById('modal-manage-new-releases');
  if (modal) modal.classList.add('active');
}

function closeManageNewReleasesModal() {
  const modal = document.getElementById('modal-manage-new-releases');
  if (modal) modal.classList.remove('active');
}

function renderNewReleasesSelectionList(filterQuery = '') {
  const container = document.getElementById('new-releases-selection-list');
  if (!container) return;

  const query = filterQuery.toLowerCase().trim();
  const availableSongs = currentDashState.songs.filter(s => {
    if (!query) return true;
    return (s.title || '').toLowerCase().includes(query) ||
      (s.artist || '').toLowerCase().includes(query) ||
      (s.album || '').toLowerCase().includes(query);
  });

  if (availableSongs.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">No matching songs found.</div>`;
    return;
  }

  container.innerHTML = availableSongs.map(song => {
    const isAlreadyAdded = currentDashState.selectedNewReleaseIds.has(song.id);
    const isTempChecked = currentDashState.tempNewReleaseIds.has(song.id);

    return `
      <label class="glass-card" style="padding: 10px 14px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; border: ${isTempChecked ? '1px solid var(--primary-pink)' : '1px solid rgba(255,255,255,0.08)'}">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="${song.imageUrl || song.coverUrl || 'images/logo.png'}" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover;">
          <div>
            <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">${escapeHtml(song.title)}</div>
            <div style="font-size: 0.775rem; color: var(--text-muted);">${escapeHtml(song.artist)} ${song.album ? `• ${escapeHtml(song.album)}` : ''}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${isAlreadyAdded ? '<span class="pill-badge pill-purple" style="font-size:0.7rem;">Already added</span>' : ''}
          <input type="checkbox" style="width: 18px; height: 18px; accent-color: var(--primary-pink);" ${isTempChecked ? 'checked' : ''} onchange="toggleNewReleaseTrack('${song.id}', this.checked)">
        </div>
      </label>
    `;
  }).join('');
}

function toggleNewReleaseTrack(songId, isChecked) {
  if (isChecked) {
    currentDashState.tempNewReleaseIds.add(songId);
  } else {
    currentDashState.tempNewReleaseIds.delete(songId);
  }
}

function filterNewReleasesSearch() {
  const query = document.getElementById('new-releases-search')?.value || '';
  renderNewReleasesSelectionList(query);
}

async function saveNewReleasesSelection() {
  if (!db) {
    showToast('Firestore database not available.', 'error');
    return;
  }

  const saveBtn = document.getElementById('btn-save-new-releases');
  if (saveBtn) saveBtn.disabled = true;

  try {
    const batch = db.batch();

    currentDashState.songs.forEach(song => {
      const isSelected = currentDashState.tempNewReleaseIds.has(song.id);
      const wasSelected = currentDashState.selectedNewReleaseIds.has(song.id);

      if (isSelected !== wasSelected) {
        const ref = db.collection("songs").doc(song.id);
        if (isSelected) {
          batch.update(ref, {
            isNewRelease: true,
            isNewReleased: true,
            newReleaseAddedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else {
          batch.update(ref, {
            isNewRelease: false,
            isNewReleased: false
          });
        }
      }
    });

    await batch.commit();

    currentDashState.selectedNewReleaseIds = new Set(currentDashState.tempNewReleaseIds);
    renderNewReleasesSection();
    closeManageNewReleasesModal();
    showToast('✔ Newly Released Songs Updated', 'success');
  } catch (err) {
    console.error("BeatBotAdmin: Error saving new releases", err);
    showToast('Failed to save newly released songs selection: ' + err.message, 'error');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

function formatExactDateTime(timestamp) {
  if (!timestamp) return 'Just now';
  let d;
  if (timestamp.seconds) {
    d = new Date(timestamp.seconds * 1000);
  } else if (timestamp instanceof Date) {
    d = timestamp;
  } else {
    d = new Date(timestamp);
  }
  if (isNaN(d.getTime())) return 'Just now';

  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}
