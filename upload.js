/* ==========================================================================
   BeatBotAdmin - Music Upload Controller (Database 1 & Database 2 Cloudinary)
   ========================================================================== */

let selectedAudioFile = null;
let selectedCoverFile = null;
let audioDurationSeconds = 0;
let _dropZonesInitialized = false;

// Cloudinary Configurations
const CLOUDINARY_CONFIG_1 = {
  cloudName: "t95iimy3",
  uploadPreset: "xtjvh9tx"
};

const CLOUDINARY_CONFIG_2 = {
  cloudName: "qbn0stjj",
  uploadPreset: "data02",
  folder: "data02/song"
};

async function loadUploadFormData() {
  if (!_dropZonesInitialized) {
    initUploadDropZones();
    _dropZonesInitialized = true;
  }

  // Populate dropdowns from Firebase in the background
  populateMasterDataSelects();
}

/**
 * Initialize Drag & Drop Events
 */
function initUploadDropZones() {
  // --- MP3 Drop Zone ---
  const mp3DropZone = document.getElementById('mp3-drop-zone');
  const mp3Input = document.getElementById('mp3-file-input');

  if (mp3DropZone && mp3Input) {
    mp3DropZone.addEventListener('click', (e) => {
      e.preventDefault();
      mp3Input.click();
    });

    ['dragenter', 'dragover'].forEach(name => {
      mp3DropZone.addEventListener(name, (e) => {
        e.preventDefault();
        mp3DropZone.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach(name => {
      mp3DropZone.addEventListener(name, (e) => {
        e.preventDefault();
        mp3DropZone.classList.remove('drag-over');
      }, false);
    });

    mp3DropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        validateAndSetAudioFile(files[0]);
      }
    });

    mp3Input.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        validateAndSetAudioFile(e.target.files[0]);
      }
    });
  }

  // --- Cover Image Click Zone ---
  const coverWrapper = document.getElementById('cover-preview-wrapper');
  const coverInput = document.getElementById('cover-file-input');

  if (coverWrapper && coverInput) {
    coverWrapper.addEventListener('click', (e) => {
      e.preventDefault();
      coverInput.click();
    });

    coverInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        validateAndSetCoverFile(e.target.files[0]);
      }
    });
  }
}

/**
 * Validate Audio File Format & Size Limit
 */
function validateAndSetAudioFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'mp3' && ext !== 'mpeg' && !file.type.includes('audio')) {
    showToast('Only .mp3 and .mpeg audio files are supported!', 'error');
    return;
  }

  // 10 MB Limit
  const maxSizeBytes = 10 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    showToast('File size exceeds the 10 MB limit.', 'error');
    selectedAudioFile = null;
    document.getElementById('mp3-file-name').textContent = 'File size exceeds 10 MB limit. Please select a smaller file.';
    document.getElementById('mp3-file-size').textContent = '';
    return;
  }

  selectedAudioFile = file;
  document.getElementById('mp3-file-name').textContent = file.name;
  document.getElementById('mp3-file-size').textContent = formatFileSize(file.size);

  // Extract duration using HTML5 Audio
  const tempAudio = new Audio();
  const url = URL.createObjectURL(file);
  tempAudio.src = url;
  tempAudio.addEventListener('loadedmetadata', () => {
    audioDurationSeconds = Math.round(tempAudio.duration);
    document.getElementById('mp3-file-duration').textContent = `Duration: ${formatDuration(audioDurationSeconds)}`;
    URL.revokeObjectURL(url);
  });

  showToast(`Selected track: ${file.name}`, 'success');
}

/**
 * Validate Cover Image & Preview
 */
let selectedCoverDataUrl = '';

function validateAndSetCoverFile(file) {
  if (!file.type.includes('image')) {
    showToast('Please select a valid image file (PNG/JPG)', 'error');
    return;
  }

  selectedCoverFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    selectedCoverDataUrl = e.target.result;
    const imgElem = document.getElementById('cover-preview-img');
    const placeholder = document.getElementById('cover-preview-placeholder');

    if (imgElem) {
      imgElem.src = e.target.result;
      imgElem.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';

    showToast('Cover image loaded!', 'success');
  };
  reader.readAsDataURL(file);
}

/**
 * Populate Master Data Dropdowns (Categories, Languages, Countries)
 */
async function populateMasterDataSelects() {
  const langSelect = document.getElementById('upload-language');
  const cntSelect = document.getElementById('upload-country');

  try {
    let categories = DEFAULT_CATEGORIES;
    let languages = DEFAULT_LANGUAGES;
    let countries = DEFAULT_COUNTRIES;

    if (db) {
      const snap = await db.collection("masterData").get();
      if (!snap.empty) {
        const cSet = new Set(), lSet = new Set(), cntSet = new Set();
        snap.forEach(doc => {
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
    }

    categories = [...new Set(categories.map(c => c.trim()))].sort((a, b) => a.localeCompare(b));
    languages = [...new Set(languages.map(l => l.trim()))].sort((a, b) => a.localeCompare(b));
    countries = [...new Set(countries.map(c => c.trim()))].sort((a, b) => a.localeCompare(b));

    const catContainer = document.getElementById('category-checkboxes');
    if (catContainer) {
      catContainer.innerHTML = categories.map(c => `
        <label class="tag-checkbox">
          <input type="checkbox" name="category-tag" value="${escapeHtml(c)}">
          <span>${escapeHtml(c)}</span>
        </label>
      `).join('');
    }

    if (langSelect) {
      langSelect.innerHTML = '<option value="">Select Language</option>' +
        languages.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
    }

    if (cntSelect) {
      cntSelect.innerHTML = '<option value="">Select Country</option>' +
        countries.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    }

  } catch (err) {
    console.error("BeatBotAdmin: Error populating master data dropdowns", err);
  }
}

/**
 * Check for Duplicate Song (Title + Artist)
 */
async function isDuplicateSong(title, artist) {
  if (!db) return false;
  try {
    const snap = await db.collection("songs")
      .where("title", "==", title)
      .where("artist", "==", artist)
      .get();
    return !snap.empty;
  } catch (err) {
    console.warn("BeatBotAdmin: Duplicate check warning", err);
    return false;
  }
}

/**
 * Helper: Upload file to Cloudinary
 */
async function uploadToCloudinary(file, resourceType = 'auto', config = CLOUDINARY_CONFIG_2, progressFill, progressStart, progressSpan) {
  if (!config || !config.cloudName || !config.uploadPreset) {
    throw new Error('Cloudinary database target is not configured properly.');
  }

  const url = `https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', config.uploadPreset);
  if (config.folder) {
    formData.append('folder', config.folder);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    if (xhr.upload && progressFill) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * progressSpan);
          progressFill.style.width = `${progressStart + pct}%`;
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.secure_url) {
            resolve({ url: data.secure_url, public_id: data.public_id || '' });
          } else {
            reject(new Error(data.error?.message || 'Cloudinary upload failed'));
          }
        } catch (e) {
          reject(e);
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.error?.message || `Cloudinary HTTP ${xhr.status}`));
        } catch (e) {
          reject(new Error(`Cloudinary upload failed (HTTP ${xhr.status})`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error uploading file to Cloudinary. Please check your connection.'));
    xhr.send(formData);
  });
}

/**
 * Handle Song Upload Submission
 */
async function submitMusicUpload(e) {
  if (e) e.preventDefault();

  if (typeof db === 'undefined' || !db) {
    if (typeof initFirebase === 'function') {
      try { initFirebase(); } catch (err) { }
      await new Promise(res => setTimeout(res, 800));
    }
    if (typeof db === 'undefined' || !db) {
      showToast('Firebase not initialized. Reload page and try again.', 'error');
      return;
    }
  }

  const title = document.getElementById('upload-title')?.value.trim();
  const artist = document.getElementById('upload-artist')?.value.trim();
  const album = document.getElementById('upload-album')?.value.trim() || '';
  const description = document.getElementById('upload-desc')?.value.trim() || '';
  const lyrics = document.getElementById('upload-lyrics')?.value.trim() || '';
  const language = document.getElementById('upload-language')?.value || '';
  const country = document.getElementById('upload-country')?.value || '';
  const releaseDate = document.getElementById('upload-release-date')?.value || '';

  // Database selection logic: Default to Database 2 (Cloudinary Account 2)
  const selectedDbChoice = document.querySelector('input[name="upload-db-choice"]:checked')?.value || 'database2';
  const targetCloudinaryConfig = (selectedDbChoice === 'database1') ? CLOUDINARY_CONFIG_1 : CLOUDINARY_CONFIG_2;

  // Multi-select Category Tags
  const selectedCategories = [];
  document.querySelectorAll('input[name="category-tag"]:checked').forEach(cb => {
    selectedCategories.push(cb.value);
  });

  // Validations
  if (!selectedAudioFile) {
    showToast('Please select or drop an audio file (.mp3 / .mpeg)!', 'error');
    return;
  }
  if (!selectedCoverFile && !selectedCoverDataUrl) {
    showToast('Please select a Cover Image!', 'error');
    return;
  }
  if (!title || !artist) {
    showToast('Song Title and Artist Name are required!', 'error');
    return;
  }
  if (selectedCategories.length === 0) {
    showToast('Please select at least one Category / Genre!', 'error');
    return;
  }

  // Duplicate Check
  const duplicate = await isDuplicateSong(title, artist);
  if (duplicate) {
    showToast(`Warning: A track titled "${title}" by "${artist}" already exists!`, 'error');
    return;
  }

  // UI Progress Setup
  const progressBox = document.getElementById('upload-progress-box');
  const progressFill = document.getElementById('upload-progress-fill');
  const progressText = document.getElementById('upload-progress-text');
  const submitBtn = document.getElementById('btn-submit-upload');

  if (progressBox) progressBox.style.display = 'block';
  if (progressFill) progressFill.style.width = '10%';
  if (submitBtn) submitBtn.disabled = true;

  try {
    const timestamp = Date.now();
    let audioUrl = '';
    let imageUrl = '';
    let audioPublicId = '';
    let coverPublicId = '';

    const dbLabel = selectedDbChoice === 'database1' ? 'Database 1 (t95iimy3)' : 'Database 2 (qbn0stjj)';
    if (progressText) progressText.textContent = `Uploading audio track to ${dbLabel}...`;

    // Upload Audio
    const audioRes = await uploadToCloudinary(selectedAudioFile, 'video', targetCloudinaryConfig, progressFill, 10, 45);
    audioUrl = audioRes.url;
    audioPublicId = audioRes.public_id;

    // Upload Cover Image
    if (selectedCoverFile) {
      if (progressText) progressText.textContent = `Uploading cover image to ${dbLabel}...`;
      const imageRes = await uploadToCloudinary(selectedCoverFile, 'image', targetCloudinaryConfig, progressFill, 55, 35);
      imageUrl = imageRes.url;
      coverPublicId = imageRes.public_id;
    } else if (selectedCoverDataUrl) {
      imageUrl = selectedCoverDataUrl;
      if (progressFill) progressFill.style.width = '90%';
    } else {
      imageUrl = 'images/logo.png';
      if (progressFill) progressFill.style.width = '90%';
    }

    if (progressText) progressText.textContent = 'Saving track metadata to Firestore...';
    if (progressFill) progressFill.style.width = '92%';

    // Save song metadata to Firestore
    const songDoc = {
      title,
      artist,
      album,
      description,
      lyrics,
      category: selectedCategories.join(', '),
      language: language || 'English',
      country: country || 'India',
      releaseDate,
      databaseId: selectedDbChoice,
      cloudinaryDatabase: selectedDbChoice,
      cloudinaryCloudName: targetCloudinaryConfig.cloudName,
      uploadPreset: targetCloudinaryConfig.uploadPreset,
      audioUrl,
      imageUrl,
      coverUrl: imageUrl,
      audioPublicId,
      coverPublicId,
      imagePublicId: coverPublicId,
      duration: audioDurationSeconds,
      fileSize: selectedAudioFile.size,
      uploadDate: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection("songs").add(songDoc);
    songDoc.id = docRef.id;

    if (progressFill) progressFill.style.width = '100%';
    if (progressText) progressText.textContent = 'Upload complete!';

    showToast('✔ Upload Successful! Song saved to Cloudinary & Firestore', 'success');
    showUploadSuccessOverlay(title, artist, imageUrl);
    resetUploadForm();

  } catch (err) {
    console.error("BeatBotAdmin: Upload error", err);
    showToast('❌ Upload Failed: ' + (err.message || 'Unknown error'), 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (progressBox) setTimeout(() => { progressBox.style.display = 'none'; }, 2000);
  }
}

/**
 * Show green success overlay modal
 */
function showUploadSuccessOverlay(title, artist, imageUrl) {
  const existing = document.getElementById('upload-success-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'upload-success-overlay';
  overlay.className = 'modal-overlay active';
  overlay.innerHTML = `
    <div class="modal-content" style="text-align: center; max-width: 420px; padding: 36px 28px; border-top: 4px solid #10B981;">
      <div class="upload-success-icon" style="margin: 0 auto 12px;">
        <svg width="68" height="68" viewBox="0 0 24 24" fill="url(#greenGrad)">
          <defs>
            <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#10B981"/>
              <stop offset="100%" stop-color="#059669"/>
            </linearGradient>
          </defs>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      </div>
      
      <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(16, 185, 129, 0.15); color: #10B981; font-weight: 700; font-size: 0.8rem; padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(16, 185, 129, 0.3); margin-bottom: 8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#10B981"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        SUCCESSFULLY UPLOADED
      </div>

      <h2 style="font-size: 1.6rem; font-weight: 800; margin: 10px 0 6px; color: #10B981;">
        Upload Complete!
      </h2>
      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 16px;">
        Song saved permanently to Cloudinary & Firestore
      </p>

      <div style="background: var(--bg-elevated, rgba(255,255,255,0.05)); border-radius: var(--radius-md); padding: 14px; margin: 16px 0; display: flex; align-items: center; gap: 14px; text-align: left; border: 1px solid rgba(16, 185, 129, 0.2);">
        <img src="${imageUrl || 'images/logo.png'}" alt="Cover" style="width: 52px; height: 52px; border-radius: 10px; object-fit: cover; border: 2px solid #10B981;">
        <div style="overflow: hidden;">
          <div style="font-weight: 700; font-size: 1rem; color: var(--text-main); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${escapeHtml(title)}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${escapeHtml(artist)}</div>
        </div>
      </div>

      <button class="btn btn-primary" onclick="closeUploadSuccessOverlay()" style="width: 100%; margin-top: 8px; padding: 14px; background: linear-gradient(135deg, #10B981, #059669); border: none;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFF"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
        Go to Music Library
      </button>
    </div>
  `;

  document.body.appendChild(overlay);
}

function closeUploadSuccessOverlay() {
  const overlay = document.getElementById('upload-success-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  }
  switchView('library');
}

function resetUploadForm() {
  selectedAudioFile = null;
  selectedCoverFile = null;
  audioDurationSeconds = 0;

  const form = document.getElementById('upload-music-form');
  if (form) form.reset();

  // Re-select Database 2 by default
  const db2Radio = document.querySelector('input[name="upload-db-choice"][value="database2"]');
  if (db2Radio) db2Radio.checked = true;

  document.getElementById('mp3-file-name').textContent = 'Drag & Drop MP3 / MPEG file here (Max 10MB)';
  document.getElementById('mp3-file-size').textContent = '';
  document.getElementById('mp3-file-duration').textContent = '';

  const imgElem = document.getElementById('cover-preview-img');
  const placeholder = document.getElementById('cover-preview-placeholder');
  if (imgElem) imgElem.style.display = 'none';
  if (placeholder) placeholder.style.display = 'flex';
}
