/* ==========================================================================
   BeatBotAdmin - Advertisement Management Controller (Redesigned Workspace)
   Firebase Project: beatbotadvertisement (Firebase 4)
   Firestore Collection: advertisements
   ========================================================================== */

let allAdvertisements = [];
let filteredAdvertisements = [];

let selectedAdMediaFiles = []; // Array of File objects or existing URL strings
let selectedAdMediaType = 'image'; // 'image' or 'gif'
let editingAdTargetId = null;
let deletingAdTargetId = null;
let adsUnsubscribe = null;
let _adDropZoneInitialized = false;

let adCarouselInterval = null;
let adCarouselCurrentIndex = 0;

/**
 * Entry point: Load Advertisement Management Data
 */
async function loadAdvertisementsData() {
  if (!_adDropZoneInitialized) {
    initAdMediaDropZone();
    _adDropZoneInitialized = true;
  }
  await fetchAdvertisements();
}

/**
 * Get Advertisement Storage Instance (Firebase 4: beatbotadvertisement)
 */
function getAdStorage() {
  if (window.adStorage) return window.adStorage;

  if (typeof firebase !== 'undefined' && firebase.apps) {
    const adApp = firebase.apps.find(app => app.name === 'beatbotAdApp');
    if (adApp) {
      return adApp.storage();
    }
  }
  return null;
}

/**
 * Get Advertisement Firestore Instance (Firebase 4: beatbotadvertisement)
 */
function getAdDb() {
  if (typeof adDb !== 'undefined' && adDb) return adDb;
  if (window.adDb) return window.adDb;
  return null;
}



/**
 * Select Media Type Card (image, gif)
 */
function selectAdMediaType(type) {
  selectedAdMediaType = type === 'gif' ? 'gif' : 'image';

  const cardImage = document.getElementById('ad-card-type-image');
  const cardGif = document.getElementById('ad-card-type-gif');

  if (cardImage) {
    if (selectedAdMediaType === 'image') cardImage.classList.add('active');
    else cardImage.classList.remove('active');
  }

  if (cardGif) {
    if (selectedAdMediaType === 'gif') cardGif.classList.add('active');
    else cardGif.classList.remove('active');
  }

  const dropText = document.getElementById('ad-media-drop-text');
  const dropHint = document.getElementById('ad-media-drop-hint');
  const fileInput = document.getElementById('ad-media-file-input');

  if (selectedAdMediaType === 'gif') {
    if (dropText) dropText.textContent = 'Drop GIF here';
    if (dropHint) dropHint.textContent = 'or click to choose animated GIF file';
    if (fileInput) {
      fileInput.removeAttribute('multiple');
      fileInput.setAttribute('accept', 'image/gif');
    }
  } else {
    if (dropText) dropText.textContent = 'Drop images here';
    if (dropHint) dropHint.textContent = 'or click to choose files';
    if (fileInput) {
      fileInput.setAttribute('multiple', 'multiple');
      fileInput.setAttribute('accept', 'image/jpeg, image/jpg, image/png');
    }
  }

  renderAdMediaPreviewGallery();
  updateLiveAdPreview();
}

/**
 * Handle Multiple / Single Media File Selection
 */
function handleAdMediaFilesSelected(fileList) {
  if (!fileList || fileList.length === 0) return;

  const files = Array.from(fileList);

  if (selectedAdMediaType === 'gif') {
    // Single GIF File
    const file = files[0];
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'gif' && file.type !== 'image/gif') {
      showToast('Please select a valid animated GIF file (.gif)', 'error');
      return;
    }
    selectedAdMediaFiles = [file];
    showToast('✓ GIF selected successfully', 'info');
  } else {
    // Multiple Images (JPG/JPEG/PNG)
    const validImages = [];
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['jpg', 'jpeg', 'png'].includes(ext) && !file.type.startsWith('image/')) {
        showToast(`Skipped invalid file "${file.name}". Only JPG, JPEG, and PNG are allowed.`, 'warning');
        continue;
      }
      validImages.push(file);
    }

    if (validImages.length > 0) {
      selectedAdMediaFiles = [...selectedAdMediaFiles, ...validImages];
      showToast(`✓ Added ${validImages.length} image(s) to advertisement`, 'info');
    }
  }

  renderAdMediaPreviewGallery();
  updateLiveAdPreview();
}

/**
 * Remove Media File at Index
 */
function removeAdMediaFileAt(index) {
  if (index >= 0 && index < selectedAdMediaFiles.length) {
    selectedAdMediaFiles.splice(index, 1);
    renderAdMediaPreviewGallery();
    updateLiveAdPreview();
  }
}

/**
 * Move Media File Position (Reorder)
 */
function moveAdMediaFile(fromIdx, toIdx) {
  if (toIdx < 0 || toIdx >= selectedAdMediaFiles.length) return;
  const item = selectedAdMediaFiles.splice(fromIdx, 1)[0];
  selectedAdMediaFiles.splice(toIdx, 0, item);
  renderAdMediaPreviewGallery();
  updateLiveAdPreview();
}

/**
 * Get Preview Object URL or Remote String
 */
function getMediaItemPreviewUrl(item) {
  if (typeof item === 'string') return item;
  if (item instanceof File) return URL.createObjectURL(item);
  return 'images/logo.png';
}

/**
 * Render Compact Selected Media Gallery
 */
function renderAdMediaPreviewGallery() {
  const placeholder = document.getElementById('ad-media-placeholder');
  const galleryContainer = document.getElementById('ad-media-preview-container');
  const speedBox = document.getElementById('ad-carousel-speed-container');

  if (!galleryContainer) return;

  if (selectedAdMediaFiles.length === 0) {
    if (placeholder) placeholder.style.display = 'block';
    galleryContainer.style.display = 'none';
    galleryContainer.innerHTML = '';
    if (speedBox) speedBox.style.display = 'none';
    return;
  }

  if (placeholder) placeholder.style.display = 'none';
  galleryContainer.style.display = 'block';

  // Toggle Speed Box only when 2+ Images are selected
  if (speedBox) {
    speedBox.style.display = (selectedAdMediaType === 'image' && selectedAdMediaFiles.length >= 2) ? 'block' : 'none';
  }

  let galleryHtml = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <span style="font-size: 0.825rem; font-weight: 800; color: var(--text-main);">Selected Media (${selectedAdMediaFiles.length})</span>
      ${selectedAdMediaType === 'image' ? `
        <button type="button" class="btn btn-sm btn-glass" onclick="triggerAdFileInput()" style="font-size: 0.75rem; padding: 3px 10px;">
          + Add More
        </button>
      ` : ''}
    </div>

    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
  `;

  selectedAdMediaFiles.forEach((item, idx) => {
    const src = getMediaItemPreviewUrl(item);
    const fileName = (item instanceof File) ? item.name : `Image ${idx + 1}`;

    const isFirst = idx === 0;
    const isLast = idx === selectedAdMediaFiles.length - 1;

    galleryHtml += `
      <div style="position: relative; width: 100px; background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-sm); overflow: hidden; padding: 4px; display: flex; flex-direction: column; align-items: center;">
        ${isFirst ? `<span style="position: absolute; top: 6px; left: 6px; z-index: 5; background: var(--grad-pink-blue); color: #FFF; font-size: 0.55rem; font-weight: 800; padding: 1px 5px; border-radius: 4px;">COVER</span>` : ''}
        
        <img src="${src}" style="width: 100%; height: 60px; border-radius: 4px; object-fit: cover; margin-bottom: 4px;">
        
        <div style="font-size: 0.65rem; color: var(--text-muted); width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; margin-bottom: 4px;">
          ${escapeHtml(fileName)}
        </div>

        <div style="display: flex; gap: 4px; width: 100%; justify-content: center;">
          ${selectedAdMediaType === 'image' && selectedAdMediaFiles.length > 1 ? `
            <button type="button" class="btn btn-sm btn-glass" onclick="moveAdMediaFile(${idx}, ${idx - 1})" ${isFirst ? 'disabled' : ''} style="padding: 1px 4px; font-size: 0.65rem;" title="Move Left">‹</button>
            <button type="button" class="btn btn-sm btn-glass" onclick="moveAdMediaFile(${idx}, ${idx + 1})" ${isLast ? 'disabled' : ''} style="padding: 1px 4px; font-size: 0.65rem;" title="Move Right">›</button>
          ` : ''}
          <button type="button" class="btn btn-sm btn-danger" onclick="removeAdMediaFileAt(${idx})" style="padding: 1px 5px; font-size: 0.65rem;" title="Remove">✕</button>
        </div>
      </div>
    `;
  });

  galleryHtml += `</div>`;
  galleryContainer.innerHTML = galleryHtml;
}

function triggerAdFileInput() {
  const fileInput = document.getElementById('ad-media-file-input');
  if (fileInput) fileInput.click();
}

/**
 * Initialize Media File Dropzone & Change Listeners
 */
function initAdMediaDropZone() {
  const dropZone = document.getElementById('ad-media-drop-zone');
  const fileInput = document.getElementById('ad-media-file-input');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', (e) => {
      // Don't trigger file picker if clicking buttons inside preview
      if (e.target.closest('button')) return;
      fileInput.click();
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        handleAdMediaFilesSelected(dt.files);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleAdMediaFilesSelected(e.target.files);
        e.target.value = '';
      }
    });
  }
}

/**
 * Real-time Listener & Fetch for Advertisements in Firebase 4 (beatbotadvertisement)
 */
async function fetchAdvertisements() {
  const tbody = document.getElementById('advertisements-table-body');
  const mobileContainer = document.getElementById('mobile-advertisements-cards');

  if (tbody && allAdvertisements.length === 0) {
    tbody.innerHTML = [1, 2, 3].map(() => `
      <tr>
        <td><div class="skeleton-box" style="width: 80px; height: 50px; border-radius: 6px;"></div></td>
        <td><div class="skeleton-box skeleton-text" style="width: 140px;"></div></td>
        <td><div class="skeleton-box skeleton-text" style="width: 60px;"></div></td>
        <td><div class="skeleton-box skeleton-text" style="width: 100px;"></div></td>
        <td><div class="skeleton-box skeleton-text" style="width: 60px;"></div></td>
        <td><div class="skeleton-box skeleton-text" style="width: 60px;"></div></td>
        <td><div class="skeleton-box skeleton-text" style="width: 120px;"></div></td>
      </tr>
    `).join('');
  }

  // 1. Try Backend REST API first
  try {
    const data = await apiRequest('/.netlify/functions/advertisements');
    if (data.success && Array.isArray(data.advertisements)) {
      allAdvertisements = data.advertisements;
      applyAdvertisementFilters();
    }
  } catch (err) {
    console.warn("BeatBotAdmin: Backend GET /.netlify/functions/advertisements notice", err.message);
  }

  // 2. Attach real-time Firestore listener on adDb (Firebase 4: beatbotadvertisement)
  const targetDb = getAdDb();
  if (targetDb && !adsUnsubscribe) {
    try {
      adsUnsubscribe = targetDb.collection("advertisements").onSnapshot((snap) => {
        const adsList = [];
        snap.forEach(doc => {
          const d = doc.data();
          d.id = doc.id;
          adsList.push(d);
        });

        allAdvertisements = adsList;
        applyAdvertisementFilters();
      }, (err) => {
        console.warn("BeatBotAdmin: Advertisements Firestore listener notice", err.message);
      });
    } catch (e) { }
  }
}

/**
 * Calculate dynamic status (Active, Inactive, Scheduled, Expired)
 */
function calculateAdStatus(ad) {
  if (!ad) return { key: 'inactive', label: 'Inactive', cssClass: 'status-badge-disabled' };

  if (ad.status === 'inactive') {
    return { key: 'inactive', label: 'Inactive', cssClass: 'status-badge-disabled' };
  }

  const nowMs = Date.now();
  let startMs = 0;
  let endMs = Infinity;

  if (ad.startAt) {
    const d = ad.startAt.seconds ? new Date(ad.startAt.seconds * 1000) : new Date(ad.startAt);
    startMs = d.getTime();
  }

  if (ad.endAt) {
    const d = ad.endAt.seconds ? new Date(ad.endAt.seconds * 1000) : new Date(ad.endAt);
    endMs = d.getTime();
  }

  if (nowMs < startMs) {
    return { key: 'scheduled', label: 'Scheduled', cssClass: 'status-badge-pending' };
  }

  if (nowMs > endMs) {
    return { key: 'expired', label: 'Expired', cssClass: 'status-badge-disabled' };
  }

  return { key: 'active', label: 'Active', cssClass: 'status-badge-active' };
}

/**
 * Apply Search, Status Filter, and Sorting to Advertisements List
 */
function applyAdvertisementFilters() {
  const searchVal = (document.getElementById('ad-search-input')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('ad-status-filter')?.value || '';
  const sortBy = document.getElementById('ad-sort-select')?.value || 'priority';

  filteredAdvertisements = allAdvertisements.filter(ad => {
    // 1. Search Query Match
    if (searchVal) {
      const matchTitle = (ad.title || '').toLowerCase().includes(searchVal);
      const matchDesc = (ad.description || '').toLowerCase().includes(searchVal);
      if (!matchTitle && !matchDesc) return false;
    }

    // 2. Status Match
    if (statusFilter) {
      const currentStatus = calculateAdStatus(ad);
      if (statusFilter === 'active' && currentStatus.key !== 'active') return false;
      if (statusFilter === 'inactive' && ad.status !== 'inactive') return false;
      if (statusFilter === 'scheduled' && currentStatus.key !== 'scheduled') return false;
      if (statusFilter === 'expired' && currentStatus.key !== 'expired') return false;
    }

    return true;
  });

  // 3. Sorting Logic
  filteredAdvertisements.sort((a, b) => {
    if (sortBy === 'priority') {
      return (a.priority || 1) - (b.priority || 1);
    }
    if (sortBy === 'newest') {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    }
    if (sortBy === 'oldest') {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeA - timeB;
    }
    if (sortBy === 'startAt') {
      const timeA = new Date(a.startAt || 0).getTime();
      const timeB = new Date(b.startAt || 0).getTime();
      return timeA - timeB;
    }
    if (sortBy === 'endAt') {
      const timeA = new Date(a.endAt || 0).getTime();
      const timeB = new Date(b.endAt || 0).getTime();
      return timeA - timeB;
    }
    return 0;
  });

  renderAdvertisementsList();
}

/**
 * Render Advertisements in Desktop Table & Mobile Cards
 */
function renderAdvertisementsList() {
  const tbody = document.getElementById('advertisements-table-body');
  const mobileContainer = document.getElementById('mobile-advertisements-cards');

  if (filteredAdvertisements.length === 0) {
    const emptyHtml = `
      <div style="padding: 60px 20px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 3rem; margin-bottom: 12px;">🎨</div>
        <div style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin-bottom: 6px;">No Advertisements Yet</div>
        <div style="font-size: 0.85rem; color: var(--text-subtle); margin-bottom: 20px;">Create your first advertisement for BeatBot.</div>
        <button class="btn btn-primary" onclick="openAdvertisementFormModal()" style="padding: 10px 24px; font-weight: 700;">
          + Add Advertisement
        </button>
      </div>
    `;
    if (tbody) tbody.innerHTML = `<tr><td colspan="7">${emptyHtml}</td></tr>`;
    if (mobileContainer) mobileContainer.innerHTML = emptyHtml;
    return;
  }

  // 1. Desktop Table Rows
  if (tbody) {
    tbody.innerHTML = filteredAdvertisements.map(ad => {
      const statusInfo = calculateAdStatus(ad);

      let mediaPreviewElem = '';
      const displayUrl = (Array.isArray(ad.mediaUrls) && ad.mediaUrls.length > 0) ? ad.mediaUrls[0] : (ad.mediaUrl || 'images/logo.png');
      const imgCount = (Array.isArray(ad.mediaUrls) && ad.mediaUrls.length > 1) ? ad.mediaUrls.length : 1;

      mediaPreviewElem = `
        <div style="position: relative; width: 84px; height: 48px;">
          <img src="${displayUrl}" style="width: 84px; height: 48px; border-radius: 6px; object-fit: cover;">
          ${imgCount > 1 ? `<span style="position: absolute; bottom: 2px; right: 2px; background: rgba(0,0,0,0.7); color: #FFF; font-size: 0.6rem; font-weight: 800; padding: 1px 4px; border-radius: 4px;">${imgCount} imgs</span>` : ''}
        </div>
      `;

      const mediaTypeLabel = (ad.mediaType === 'gif') ? '🎞️ GIF' : (imgCount > 1 ? `🖼️ ${imgCount} Images` : '🖼️ Image');
      const priorityLabel = (ad.priority <= 2) ? 'High' : ((ad.priority >= 8) ? 'Low' : 'Normal');

      const toggleActionBtn = (ad.status === 'active')
        ? `<button class="btn btn-sm btn-glass" onclick="toggleAdvertisementStatus('${ad.id}', 'inactive')" style="padding: 4px 10px; font-size: 0.75rem;">Disable</button>`
        : `<button class="btn btn-sm btn-primary" onclick="toggleAdvertisementStatus('${ad.id}', 'active')" style="padding: 4px 10px; font-size: 0.75rem;">Enable</button>`;

      return `
        <tr>
          <td>${mediaPreviewElem}</td>
          <td>
            <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(ad.title)}</div>
            ${ad.description ? `<div style="font-size: 0.775rem; color: var(--text-muted); display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(ad.description)}</div>` : ''}
          </td>
          <td><span class="pill-badge pill-purple" style="font-size: 0.7rem;">${mediaTypeLabel}</span></td>
          <td>
            <div style="font-size: 0.775rem; color: var(--text-muted);">
              <div>Start: ${formatAdDateTime(ad.startAt)}</div>
              <div>End: ${formatAdDateTime(ad.endAt)}</div>
            </div>
          </td>
          <td>
            <span class="pill-badge pill-pink" style="font-size: 0.7rem;">${priorityLabel}</span>
          </td>
          <td>
            <span class="${statusInfo.cssClass}">${statusInfo.label}</span>
          </td>
          <td>
            <div style="display: flex; gap: 6px; align-items: center;">
              ${toggleActionBtn}
              <button class="btn btn-sm btn-glass" onclick="openAdvertisementFormModal('${ad.id}')" title="Edit Advertisement">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="openDeleteAdModal('${ad.id}', '${escapeHtml(ad.title).replace(/'/g, "\\'")}')" title="Delete Advertisement">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 2. Mobile Cards
  if (mobileContainer) {
    mobileContainer.innerHTML = filteredAdvertisements.map(ad => {
      const statusInfo = calculateAdStatus(ad);
      const displayUrl = (Array.isArray(ad.mediaUrls) && ad.mediaUrls.length > 0) ? ad.mediaUrls[0] : (ad.mediaUrl || 'images/logo.png');
      const imgCount = (Array.isArray(ad.mediaUrls) && ad.mediaUrls.length > 1) ? ad.mediaUrls.length : 1;
      const mediaTypeLabel = (ad.mediaType === 'gif') ? '🎞️ GIF' : (imgCount > 1 ? `🖼️ ${imgCount} Images` : '🖼️ Image');
      const priorityLabel = (ad.priority <= 2) ? 'High' : ((ad.priority >= 8) ? 'Low' : 'Normal');

      const toggleActionBtn = (ad.status === 'active')
        ? `<button class="btn btn-sm btn-glass" onclick="toggleAdvertisementStatus('${ad.id}', 'inactive')" style="padding: 6px 12px; font-size: 0.8rem;">Disable</button>`
        : `<button class="btn btn-sm btn-primary" onclick="toggleAdvertisementStatus('${ad.id}', 'active')" style="padding: 6px 12px; font-size: 0.8rem;">Enable</button>`;

      return `
        <div class="glass-card" style="padding: 14px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 12px; border-left: 3px solid var(--primary-pink);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="pill-badge pill-purple" style="font-size: 0.7rem;">${mediaTypeLabel}</span>
            <span class="${statusInfo.cssClass}">${statusInfo.label}</span>
          </div>

          <img src="${displayUrl}" style="width: 100%; aspect-ratio: 16/9; border-radius: 8px; object-fit: cover;">

          <div>
            <div style="font-weight: 700; font-size: 1rem; color: var(--text-main); margin-bottom: 4px;">${escapeHtml(ad.title)}</div>
            ${ad.description ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">${escapeHtml(ad.description)}</div>` : ''}
            <div style="font-size: 0.75rem; color: var(--text-subtle); display: flex; justify-content: space-between;">
              <span>Start: ${formatAdDateTime(ad.startAt)}</span>
              <span>Priority: ${priorityLabel}</span>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06);">
            ${toggleActionBtn}
            <button class="btn btn-sm btn-glass" onclick="openAdvertisementFormModal('${ad.id}')" style="padding: 6px 12px; font-size: 0.8rem;">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="openDeleteAdModal('${ad.id}', '${escapeHtml(ad.title).replace(/'/g, "\\'")}')" style="padding: 6px 12px; font-size: 0.8rem;">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  }
}

/**
 * Handle Start Option Radios (Start Now vs Schedule Start)
 */
function toggleAdScheduleStartMode() {
  const selectedMode = document.querySelector('input[name="ad-start-mode"]:checked')?.value || 'now';
  const startPickerBox = document.getElementById('ad-schedule-start-picker-box');

  if (startPickerBox) {
    startPickerBox.style.display = (selectedMode === 'scheduled') ? 'block' : 'none';
  }

  if (selectedMode === 'now') {
    const now = new Date();
    const pad = n => (n < 10 ? '0' + n : n);
    const startD = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const startT = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (document.getElementById('ad-input-start-date')) document.getElementById('ad-input-start-date').value = startD;
    if (document.getElementById('ad-input-start-time')) document.getElementById('ad-input-start-time').value = startT;
  }

  onAdScheduleChange();
}

/**
 * Handle Duration Option Radios (24 Hours, 7 Days, 30 Days, Custom)
 */
function onAdDurationModeChange() {
  const durationMode = document.querySelector('input[name="ad-duration-mode"]:checked')?.value || '30d';
  const endPickerBox = document.getElementById('ad-schedule-end-picker-box');

  if (endPickerBox) {
    endPickerBox.style.display = (durationMode === 'custom') ? 'block' : 'none';
  }

  if (durationMode !== 'custom') {
    const startDateVal = document.getElementById('ad-input-start-date')?.value;
    const startTimeVal = document.getElementById('ad-input-start-time')?.value || '00:00';
    let startObj = startDateVal ? new Date(`${startDateVal}T${startTimeVal}`) : new Date();
    if (isNaN(startObj.getTime())) startObj = new Date();

    let durationMs = 30 * 24 * 60 * 60 * 1000; // default 30 days
    if (durationMode === '24h') durationMs = 24 * 60 * 60 * 1000;
    if (durationMode === '7d') durationMs = 7 * 24 * 60 * 60 * 1000;

    const endObj = new Date(startObj.getTime() + durationMs);
    const pad = n => (n < 10 ? '0' + n : n);
    const endD = `${endObj.getFullYear()}-${pad(endObj.getMonth() + 1)}-${pad(endObj.getDate())}`;
    const endT = `${pad(endObj.getHours())}:${pad(endObj.getMinutes())}`;

    if (document.getElementById('ad-input-end-date')) document.getElementById('ad-input-end-date').value = endD;
    if (document.getElementById('ad-input-end-time')) document.getElementById('ad-input-end-time').value = endT;
  }

  onAdScheduleChange();
}

/**
 * Handle Schedule Date/Time Input Changes & Format Summary Badge
 */
function onAdScheduleChange() {
  const startMode = document.querySelector('input[name="ad-start-mode"]:checked')?.value || 'now';
  const durationMode = document.querySelector('input[name="ad-duration-mode"]:checked')?.value || '30d';
  const startDateVal = document.getElementById('ad-input-start-date')?.value;
  const startTimeVal = document.getElementById('ad-input-start-time')?.value || '00:00';
  const endDateVal = document.getElementById('ad-input-end-date')?.value;
  const endTimeVal = document.getElementById('ad-input-end-time')?.value || '23:59';

  const summaryBadge = document.getElementById('ad-schedule-summary-badge');

  let startLabel = 'Start Now';
  if (startMode === 'scheduled' && startDateVal) {
    const startObj = new Date(`${startDateVal}T${startTimeVal}`);
    startLabel = formatAdDateTime(startObj);
  }

  let endLabel = '30 Days';
  if (durationMode === '24h') endLabel = '+24 Hours';
  else if (durationMode === '7d') endLabel = '+7 Days';
  else if (durationMode === '30d') endLabel = '+30 Days';
  else if (endDateVal) {
    const endObj = new Date(`${endDateVal}T${endTimeVal}`);
    endLabel = formatAdDateTime(endObj);
  }

  if (summaryBadge) {
    summaryBadge.textContent = `Active Schedule: ${startLabel} → ${endLabel}`;
  }

  updateLiveAdPreview();
}

/**
 * Toggle Action Button Fields Container Visibility
 */
function toggleAdButtonFields() {
  const toggle = document.getElementById('ad-toggle-button');
  const container = document.getElementById('ad-button-fields-container');

  if (container) {
    container.style.display = (toggle && toggle.checked) ? 'block' : 'none';
  }
  updateLiveAdPreview();
}

/**
 * Status Toggle Change
 */
function onAdStatusToggleChange() {
  const toggle = document.getElementById('ad-status-toggle');
  const label = document.getElementById('ad-status-toggle-label');
  const statusBadge = document.getElementById('ad-modal-status-badge');

  const isActive = toggle ? toggle.checked : true;
  if (label) label.textContent = isActive ? 'Active' : 'Inactive';
  if (statusBadge) {
    statusBadge.textContent = isActive ? '● Active' : '● Inactive';
    statusBadge.className = isActive ? 'pill-badge pill-pink' : 'pill-badge pill-purple';
  }
}

/**
 * Change Carousel Slide Manually in Phone Mockup Preview
 */
function changeAdCarouselSlide(step) {
  const previewUrls = selectedAdMediaFiles.map(getMediaItemPreviewUrl);
  if (previewUrls.length <= 1) return;

  adCarouselCurrentIndex = (adCarouselCurrentIndex + step + previewUrls.length) % previewUrls.length;
  renderLiveAdCarouselSlide(adCarouselCurrentIndex);
}

/**
 * Render Carousel Slide in Phone Mockup
 */
function renderLiveAdCarouselSlide(idx) {
  const wrapper = document.getElementById('phone-ad-media-wrapper');
  if (!wrapper) return;

  const previewUrls = selectedAdMediaFiles.map(getMediaItemPreviewUrl);
  if (previewUrls.length === 0) return;

  const dotsHtml = previewUrls.map((_, i) => `
    <span style="width: ${i === idx ? '12px' : '5px'}; height: 5px; border-radius: 3px; background: ${i === idx ? 'var(--primary-pink)' : 'rgba(255,255,255,0.4)'}; transition: all 0.3s ease;"></span>
  `).join('');

  wrapper.innerHTML = `
    <div style="position: relative; width: 100%; aspect-ratio: 16/9; border-radius: 8px; overflow: hidden;">
      <img src="${previewUrls[idx]}" style="width: 100%; height: 100%; object-fit: cover; transition: opacity 0.4s ease;">
      
      ${previewUrls.length > 1 ? `
        <!-- Manual Arrow Buttons -->
        <button type="button" onclick="changeAdCarouselSlide(-1)" style="position: absolute; left: 4px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.5); color: #FFF; border: none; width: 20px; height: 20px; border-radius: 50%; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 12;">‹</button>
        <button type="button" onclick="changeAdCarouselSlide(1)" style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.5); color: #FFF; border: none; width: 20px; height: 20px; border-radius: 50%; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 12;">›</button>
        
        <!-- Dot Indicators -->
        <div style="position: absolute; bottom: 6px; left: 0; right: 0; display: flex; justify-content: center; gap: 4px; z-index: 10;">
          ${dotsHtml}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Update Live BeatBot Android Phone Mockup Preview
 */
function updateLiveAdPreview() {
  const titleVal = (document.getElementById('ad-input-title')?.value || '').trim();
  const descVal = (document.getElementById('ad-input-description')?.value || '').trim();
  const isBtnEnabled = document.getElementById('ad-toggle-button')?.checked;
  const btnTextVal = isBtnEnabled ? (document.getElementById('ad-input-button-text')?.value || 'Learn More').trim() : '';

  // Title & Desc
  const titlePreview = document.getElementById('phone-ad-title-preview');
  const descPreview = document.getElementById('phone-ad-desc-preview');
  const btnPreview = document.getElementById('phone-ad-btn-preview');
  const btnTextElem = document.getElementById('phone-ad-btn-text');

  if (titlePreview) titlePreview.textContent = titleVal || 'Advertisement Title';
  if (descPreview) descPreview.textContent = descVal || 'Short description will appear here...';

  if (btnPreview) {
    if (isBtnEnabled) {
      btnPreview.style.display = 'inline-flex';
      if (btnTextElem) btnTextElem.textContent = btnTextVal || 'Learn More';
    } else {
      btnPreview.style.display = 'none';
    }
  }

  // Media Wrapper
  const wrapper = document.getElementById('phone-ad-media-wrapper');
  if (!wrapper) return;

  // Clear existing carousel timer
  if (adCarouselInterval) {
    clearInterval(adCarouselInterval);
    adCarouselInterval = null;
  }

  if (selectedAdMediaFiles.length === 0) {
    wrapper.innerHTML = `
      <div style="color: var(--text-muted); font-size: 0.75rem; text-align: center; padding: 24px;">
        🖼️ Select image(s) or GIF to preview
      </div>
    `;
    return;
  }

  const previewUrls = selectedAdMediaFiles.map(getMediaItemPreviewUrl);

  if (selectedAdMediaType === 'gif' || previewUrls.length === 1) {
    // Single Image or GIF
    wrapper.innerHTML = `
      <img src="${previewUrls[0]}" style="width: 100%; aspect-ratio: 16/9; border-radius: 8px; object-fit: cover;">
    `;
  } else {
    // Multiple Images Carousel Animation
    adCarouselCurrentIndex = 0;
    renderLiveAdCarouselSlide(0);

    const speedMs = parseInt(document.getElementById('ad-input-carousel-speed')?.value || '3000', 10);

    // Auto-cycle through images
    adCarouselInterval = setInterval(() => {
      adCarouselCurrentIndex = (adCarouselCurrentIndex + 1) % previewUrls.length;
      renderLiveAdCarouselSlide(adCarouselCurrentIndex);
    }, speedMs);
  }
}

/**
 * Open Add/Edit Advertisement Modal
 */
function openAdvertisementFormModal(adId = null) {
  editingAdTargetId = adId;
  selectedAdMediaFiles = [];

  const modalTitle = document.getElementById('ad-modal-form-title');

  if (adId) {
    const ad = allAdvertisements.find(a => a.id === adId);
    if (!ad) {
      showToast('Advertisement not found', 'error');
      return;
    }

    if (modalTitle) modalTitle.textContent = 'Edit Advertisement';

    if (document.getElementById('ad-input-title')) document.getElementById('ad-input-title').value = ad.title || '';
    if (document.getElementById('ad-input-description')) document.getElementById('ad-input-description').value = ad.description || '';

    const hasButton = !!(ad.buttonText || ad.clickUrl || ad.destinationUrl);
    if (document.getElementById('ad-toggle-button')) {
      document.getElementById('ad-toggle-button').checked = hasButton;
      toggleAdButtonFields();
    }
    if (document.getElementById('ad-input-button-text')) document.getElementById('ad-input-button-text').value = ad.buttonText || '';
    if (document.getElementById('ad-input-destination-url')) document.getElementById('ad-input-destination-url').value = ad.destinationUrl || ad.clickUrl || '';

    // Schedule Date & Time Split
    const startObj = ad.startAt ? (ad.startAt.seconds ? new Date(ad.startAt.seconds * 1000) : new Date(ad.startAt)) : new Date();
    const endObj = ad.endAt ? (ad.endAt.seconds ? new Date(ad.endAt.seconds * 1000) : new Date(ad.endAt)) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const pad = n => (n < 10 ? '0' + n : n);
    const startD = `${startObj.getFullYear()}-${pad(startObj.getMonth() + 1)}-${pad(startObj.getDate())}`;
    const startT = `${pad(startObj.getHours())}:${pad(startObj.getMinutes())}`;
    const endD = `${endObj.getFullYear()}-${pad(endObj.getMonth() + 1)}-${pad(endObj.getDate())}`;
    const endT = `${pad(endObj.getHours())}:${pad(endObj.getMinutes())}`;

    if (document.getElementById('ad-input-start-date')) document.getElementById('ad-input-start-date').value = startD;
    if (document.getElementById('ad-input-start-time')) document.getElementById('ad-input-start-time').value = startT;
    if (document.getElementById('ad-input-end-date')) document.getElementById('ad-input-end-date').value = endD;
    if (document.getElementById('ad-input-end-time')) document.getElementById('ad-input-end-time').value = endT;

    const pVal = ad.priority || 5;
    if (document.getElementById('ad-input-priority-select')) {
      document.getElementById('ad-input-priority-select').value = (pVal <= 2) ? '1' : (pVal >= 8 ? '10' : '5');
    }

    const isActive = ad.status === 'active' || ad.active === true;
    if (document.getElementById('ad-status-toggle')) {
      document.getElementById('ad-status-toggle').checked = isActive;
      onAdStatusToggleChange();
    }

    if (document.getElementById('ad-input-carousel-speed')) {
      document.getElementById('ad-input-carousel-speed').value = ad.carouselSpeed || 3000;
    }

    // Media Setup
    if (Array.isArray(ad.mediaUrls) && ad.mediaUrls.length > 0) {
      selectedAdMediaFiles = [...ad.mediaUrls];
    } else if (ad.mediaUrl) {
      selectedAdMediaFiles = [ad.mediaUrl];
    }

    selectAdMediaType(ad.mediaType || 'image');
  } else {
    if (modalTitle) modalTitle.textContent = 'Add Advertisement';

    // Clear form inputs
    if (document.getElementById('ad-input-title')) document.getElementById('ad-input-title').value = '';
    if (document.getElementById('ad-input-description')) document.getElementById('ad-input-description').value = '';
    if (document.getElementById('ad-toggle-button')) {
      document.getElementById('ad-toggle-button').checked = false;
      toggleAdButtonFields();
    }
    if (document.getElementById('ad-input-button-text')) document.getElementById('ad-input-button-text').value = '';
    if (document.getElementById('ad-input-destination-url')) document.getElementById('ad-input-destination-url').value = '';

    const now = new Date();
    const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const pad = n => (n < 10 ? '0' + n : n);
    const startD = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const startT = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const endD = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}`;
    const endT = `${pad(future.getHours())}:${pad(future.getMinutes())}`;

    if (document.getElementById('ad-input-start-date')) document.getElementById('ad-input-start-date').value = startD;
    if (document.getElementById('ad-input-start-time')) document.getElementById('ad-input-start-time').value = startT;
    if (document.getElementById('ad-input-end-date')) document.getElementById('ad-input-end-date').value = endD;
    if (document.getElementById('ad-input-end-time')) document.getElementById('ad-input-end-time').value = endT;

    if (document.getElementById('ad-input-priority-select')) document.getElementById('ad-input-priority-select').value = '5';
    if (document.getElementById('ad-status-toggle')) {
      document.getElementById('ad-status-toggle').checked = true;
      onAdStatusToggleChange();
    }

    selectedAdMediaFiles = [];
    selectAdMediaType('image');
  }

  toggleAdScheduleStartMode();
  onAdDurationModeChange();
  updateLiveAdPreview();

  const modal = document.getElementById('modal-advertisement-form');
  if (modal) modal.classList.add('active');
}

function closeAdvertisementFormModal() {
  const modal = document.getElementById('modal-advertisement-form');
  if (modal) modal.classList.remove('active');
  editingAdTargetId = null;
  selectedAdMediaFiles = [];
  if (adCarouselInterval) {
    clearInterval(adCarouselInterval);
    adCarouselInterval = null;
  }
}

/**
 * Upload Advertisement Media File (JPG, PNG, Animated GIF) to Cloudinary
 */
async function uploadAdMediaToCloudinary(file) {
  console.log(`[Advertisement Upload] Uploading media to Cloudinary... File: ${file.name}, Type: ${selectedAdMediaType}`);

  const progressBox = document.getElementById('ad-upload-progress-box');
  const progressFill = document.getElementById('ad-upload-progress-fill');
  const progressText = document.getElementById('ad-upload-progress-text');

  if (progressBox) progressBox.style.display = 'block';
  if (progressFill) progressFill.style.width = '10%';
  if (progressText) progressText.textContent = `Uploading ${file.name} to Cloudinary... 10%`;

  const config = {
    cloudName: "qbn0stjj",
    uploadPreset: "data02",
    folder: "advertisements"
  };

  try {
    let uploadRes;
    if (typeof uploadToCloudinary === 'function') {
      uploadRes = await uploadToCloudinary(file, 'image', config, progressFill, 10, 85);
    } else {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', config.uploadPreset);
      formData.append('folder', config.folder);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok || (!data.secure_url && !data.url)) {
        throw new Error(data.error?.message || 'Cloudinary upload HTTP error');
      }
      uploadRes = { url: data.secure_url || data.url, public_id: data.public_id };
    }

    const mediaUrl = uploadRes.url || uploadRes.secure_url;
    if (progressFill) progressFill.style.width = '100%';
    if (progressText) progressText.textContent = 'Cloudinary upload complete!';

    console.log(`[Cloudinary] Upload successful URL = ${mediaUrl}`);
    return { mediaUrl, public_id: uploadRes.public_id };
  } catch (err) {
    if (progressBox) progressBox.style.display = 'none';
    console.error(`[Advertisement Upload ERROR] Cloudinary upload failed: ${err.message}`);
    throw new Error(`Media upload failed.\nProvider: Cloudinary\nError: ${err.message}`);
  }
}

/**
 * Save or Publish Advertisement to Firestore (beatbotadvertisement)
 */
async function submitAdvertisementForm() {
  console.log(`[Advertisement Firebase] Project ID = beatbotadvertisement`);

  const title = (document.getElementById('ad-input-title')?.value || '').trim();
  const description = (document.getElementById('ad-input-description')?.value || '').trim();
  const isButtonEnabled = document.getElementById('ad-toggle-button')?.checked;
  const buttonText = isButtonEnabled ? (document.getElementById('ad-input-button-text')?.value || '').trim() : '';
  const destinationUrl = isButtonEnabled ? (document.getElementById('ad-input-destination-url')?.value || '').trim() : '';
  const startDateVal = document.getElementById('ad-input-start-date')?.value;
  const startTimeVal = document.getElementById('ad-input-start-time')?.value || '00:00';
  const endDateVal = document.getElementById('ad-input-end-date')?.value;
  const endTimeVal = document.getElementById('ad-input-end-time')?.value || '23:59';

  const priorityVal = parseInt(document.getElementById('ad-input-priority-select')?.value || '5', 10);
  const isActiveToggle = document.getElementById('ad-status-toggle')?.checked;
  const statusToSet = isActiveToggle ? 'active' : 'inactive';

  const carouselSpeed = parseInt(document.getElementById('ad-input-carousel-speed')?.value || '3000', 10);

  // 1. Form Field Validation
  if (!title) {
    showToast('Advertisement Title is required!', 'error');
    return;
  }

  if (selectedAdMediaFiles.length === 0) {
    showToast('Please select at least one media file (JPG, PNG, or GIF) for this advertisement!', 'error');
    return;
  }

  if (!startDateVal || !endDateVal) {
    showToast('Start Date and End Date are required!', 'error');
    return;
  }

  const startObj = new Date(`${startDateVal}T${startTimeVal}`);
  const endObj = new Date(`${endDateVal}T${endTimeVal}`);

  if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
    showToast('Invalid Start or End schedule selected!', 'error');
    return;
  }

  if (endObj <= startObj) {
    showToast('End Date/Time cannot be before Start Date/Time!', 'error');
    return;
  }

  if (isButtonEnabled && !destinationUrl) {
    showToast('Destination URL is required when Call-to-Action Button is enabled!', 'error');
    return;
  }

  const saveBtn = document.getElementById('btn-publish-ad');
  const progressBox = document.getElementById('ad-upload-progress-box');

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '⟳ Publishing...';
  }

  try {
    const targetDb = getAdDb();
    let adId = editingAdTargetId;
    if (!adId) {
      adId = targetDb ? targetDb.collection('advertisements').doc().id : 'ad_' + Date.now();
    }

    // 2. Step 1: Upload New Files to Cloudinary
    console.log(`[Advertisement Upload] Uploading media to Cloudinary...`);
    const mediaUrls = [];

    for (let i = 0; i < selectedAdMediaFiles.length; i++) {
      const item = selectedAdMediaFiles[i];
      if (typeof item === 'string') {
        mediaUrls.push(item);
      } else if (item instanceof File) {
        const uploadRes = await uploadAdMediaToCloudinary(item);
        if (uploadRes && uploadRes.mediaUrl) {
          mediaUrls.push(uploadRes.mediaUrl);
        }
      }
    }

    if (mediaUrls.length === 0) {
      throw new Error("Missing mediaUrl. Media upload did not return a valid URL.");
    }

    // 3. Step 2: Create / Update Firestore Document in project `beatbotadvertisement`
    console.log(`[Advertisement Firestore] Creating document...`);
    console.log(`[Advertisement Firestore] Project = beatbotadvertisement`);
    console.log(`[Advertisement Firestore] Collection = advertisements`);

    const startTimestamp = startObj.toISOString();
    const endTimestamp = endObj.toISOString();

    const payload = {
      id: adId,
      title,
      description,
      mediaType: selectedAdMediaType,
      mediaUrls: mediaUrls,
      mediaUrl: mediaUrls[0], // Primary URL fallback for 100% backward compatibility
      clickUrl: destinationUrl,
      buttonText,
      destinationUrl,
      startAt: startTimestamp,
      endAt: endTimestamp,
      priority: priorityVal || 5,
      active: statusToSet === 'active',
      status: statusToSet,
      carouselSpeed: carouselSpeed,
      updatedAt: new Date().toISOString()
    };

    if (!editingAdTargetId) {
      payload.createdAt = new Date().toISOString();
    }

    let isSuccess = false;
    let firestoreError = null;

    // Option A. Try direct Client Firestore SDK write (Firebase 4: beatbotadvertisement)
    if (targetDb) {
      try {
        await targetDb.collection('advertisements').doc(adId).set(payload, { merge: true });
        isSuccess = true;
        console.log(`[Advertisement Firestore] Document created successfully`);
        console.log(`[Advertisement Firestore] ID = ${adId}`);
      } catch (fsErr) {
        firestoreError = fsErr;
        console.warn("[Advertisement Firestore] Direct Client SDK write warning:", fsErr.message);
      }
    }

    // Option B. Try Express Backend REST API write
    if (!isSuccess) {
      try {
        let data;
        if (editingAdTargetId) {
          data = await apiRequest(`/.netlify/functions/advertisements?id=${encodeURIComponent(editingAdTargetId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } else {
          data = await apiRequest('/.netlify/functions/advertisements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, id: adId })
          });
        }
        if (data.success) {
          isSuccess = true;
          console.log(`[Advertisement Firestore] Document created successfully via Backend API`);
          console.log(`[Advertisement Firestore] ID = ${adId}`);
        } else {
          firestoreError = new Error(data.error || "Backend API failed to create document in Firestore");
        }
      } catch (apiErr) {
        firestoreError = apiErr;
      }
    }

    // 4. Verify Success
    if (isSuccess) {
      const existingIdx = allAdvertisements.findIndex(a => a.id === adId);
      if (existingIdx >= 0) {
        allAdvertisements[existingIdx] = { ...allAdvertisements[existingIdx], ...payload };
      } else {
        allAdvertisements.unshift(payload);
      }
      applyAdvertisementFilters();

      showToast(editingAdTargetId ? '✓ Advertisement updated successfully' : '✓ Advertisement Published', 'success');
      closeAdvertisementFormModal();
      await fetchAdvertisements();
    } else {
      const errMsg = firestoreError ? firestoreError.message : 'Firestore document creation failed';
      console.error(`[Advertisement Firestore ERROR] Project: beatbotadvertisement | Collection: advertisements | Operation: ${editingAdTargetId ? 'UPDATE' : 'CREATE'} | Error: ${errMsg}`);
      const friendlyError = `Advertisement save failed.\n\nProject: beatbotadvertisement\nCollection: advertisements\nOperation: ${editingAdTargetId ? 'UPDATE' : 'CREATE'}\nError: ${errMsg}`;
      showToast(friendlyError, 'error');
    }
  } catch (err) {
    console.error(`[Advertisement Firestore ERROR] ${err.message}`);
    showToast(err.message || 'Error publishing advertisement', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = 'Publish Advertisement';
    }
    if (progressBox) progressBox.style.display = 'none';
  }
}

/**
 * Toggle Status (Active / Inactive)
 */
async function toggleAdvertisementStatus(adId, nextStatus) {
  try {
    const targetDb = getAdDb();
    let updated = false;

    if (targetDb) {
      try {
        await targetDb.collection('advertisements').doc(adId).update({ status: nextStatus, active: nextStatus === 'active', updatedAt: new Date().toISOString() });
        updated = true;
      } catch (e) { }
    }

    if (!updated) {
      const data = await apiRequest(`/.netlify/functions/advertisements?id=${encodeURIComponent(adId)}&status=true`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, active: nextStatus === 'active' })
      });
      if (data.success) updated = true;
    }

    if (updated) {
      const ad = allAdvertisements.find(a => a.id === adId);
      if (ad) {
        ad.status = nextStatus;
        ad.active = (nextStatus === 'active');
      }
      applyAdvertisementFilters();
      showToast(`✓ Advertisement ${nextStatus === 'active' ? 'enabled' : 'disabled'} successfully`, 'success');
    } else {
      showToast('Failed to toggle status', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to server: ' + err.message, 'error');
  }
}

/**
 * Delete Confirmation Modal Handlers
 */
function openDeleteAdModal(adId, title) {
  deletingAdTargetId = adId;
  const text = document.getElementById('delete-ad-title-text');
  if (text) text.textContent = `"${title}"`;

  const modal = document.getElementById('modal-delete-ad-confirm');
  if (modal) modal.classList.add('active');
}

function closeDeleteAdModal() {
  const modal = document.getElementById('modal-delete-ad-confirm');
  if (modal) modal.classList.remove('active');
  deletingAdTargetId = null;
}

async function confirmDeleteAdvertisement() {
  if (!deletingAdTargetId) return;

  try {
    const targetDb = getAdDb();
    let deleted = false;

    if (targetDb) {
      try {
        await targetDb.collection('advertisements').doc(deletingAdTargetId).delete();
        deleted = true;
      } catch (e) { }
    }

    if (!deleted) {
      const data = await apiRequest(`/.netlify/functions/advertisements?id=${encodeURIComponent(deletingAdTargetId)}`, {
        method: 'DELETE'
      });
      if (data.success) deleted = true;
    }

    if (deleted) {
      allAdvertisements = allAdvertisements.filter(a => a.id !== deletingAdTargetId);
      applyAdvertisementFilters();
      closeDeleteAdModal();
      showToast('✓ Advertisement deleted successfully', 'success');
    } else {
      showToast('Failed to delete advertisement', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to server: ' + err.message, 'error');
  }
}

/**
 * Date Format Helper
 */
function formatAdDateTime(rawDate) {
  if (!rawDate) return 'N/A';
  let d;
  if (rawDate.seconds) d = new Date(rawDate.seconds * 1000);
  else d = new Date(rawDate);

  if (isNaN(d.getTime())) return 'N/A';

  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}
