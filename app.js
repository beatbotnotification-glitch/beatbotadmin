/* ==========================================================================
   BeatBotAdmin - Core Application Controller (Theme, Auth, Toast, Player, Router)
   ========================================================================== */

// Centralized Backend API Base URL Configuration
// When running locally with Express backend on port 8080: uses http://localhost:8080
// In Netlify production: uses relative URL '' so requests hit /.netlify/functions/... directly
const isLocalhostDev = (typeof window !== 'undefined') &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
  (window.location.port === '8080');

const API_BASE_URL = (typeof window !== 'undefined' && window.BEATBOT_BACKEND_URL)
  ? window.BEATBOT_BACKEND_URL
  : (isLocalhostDev ? 'http://localhost:8080' : '');

console.log("API_BASE_URL:", API_BASE_URL || "(Netlify Functions)");

/**
 * Centralized Production API Request Helper
 * Ensures JSON parsing safety, maps API routes directly to Netlify Functions (/.netlify/functions/...),
 * and prevents non-JSON / 405 routing errors.
 */
async function apiRequest(endpoint, options = {}) {
  let targetPath = endpoint;

  // On Netlify production, route /api/* directly to /.netlify/functions/*
  if (!isLocalhostDev && !window.BEATBOT_BACKEND_URL) {
    if (targetPath.startsWith('/api/')) {
      targetPath = targetPath.replace(/^\/api\//, '/.netlify/functions/');
    } else if (targetPath.startsWith('api/')) {
      targetPath = targetPath.replace(/^api\//, '/.netlify/functions/');
    }
  }

  const url = (targetPath.startsWith('http://') || targetPath.startsWith('https://'))
    ? targetPath
    : `${API_BASE_URL}${targetPath.startsWith('/') ? '' : '/'}${targetPath}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (netErr) {
    console.error("BeatBotAdmin: Network error fetching:", url, netErr);
    throw new Error(`Unable to connect to: ${url}`);
  }

  const contentType = response.headers.get('content-type') || '';
  let data;

  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (parseErr) {
      throw new Error('Invalid JSON received from server.');
    }
  } else {
    const text = await response.text();

    if (response.status === 405 || text.toLowerCase().includes('method not allowed')) {
      throw new Error('Service is unavailable. Please try again.');
    }

    if (!response.ok) {
      throw new Error(`Server error (${response.status}): ${text.substring(0, 150)}`);
    }

    throw new Error(`Backend returned non-JSON response: ${text.substring(0, 150)}`);
  }

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Request failed with HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}


document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
  initTheme();
  initLoadingScreen();
  initAuth();
  initNavigation();
  initMobileDrawer();
  initGlobalAudioPlayer();
  initGlobalModalListeners();

  // Eagerly start real-time listeners if logged in
  if (localStorage.getItem('beatbot_auth') === 'true') {
    if (typeof startMasterDataListener === 'function') {
      startMasterDataListener();
    }
    if (typeof loadDashboardData === 'function') {
      loadDashboardData();
    }

    const hash = window.location.hash.replace('#', '');
    if (hash) {
      switchView(hash);
    } else {
      switchView('dashboard');
    }
  }
});

/**
 * Authentication Management (Admin Username & Password Protection)
 */
function initAuth() {
  const isAuth = localStorage.getItem('beatbot_auth') === 'true';
  const loginWrapper = document.getElementById('login-screen-wrapper');
  const appContainer = document.getElementById('app');

  if (isAuth) {
    if (loginWrapper) loginWrapper.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';
  } else {
    if (loginWrapper) loginWrapper.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
  }
}

function handleLoginSubmit(e) {
  if (e) e.preventDefault();

  const user = (document.getElementById('login-username')?.value || '').trim();
  const pass = (document.getElementById('login-password')?.value || '').trim();
  const errorAlert = document.getElementById('login-error-alert');

  if (user === 'admin' && pass === 'admin@123') {
    localStorage.setItem('beatbot_auth', 'true');
    localStorage.setItem('beatbot_user', 'admin');

    if (errorAlert) errorAlert.style.display = 'none';

    const loginWrapper = document.getElementById('login-screen-wrapper');
    const appContainer = document.getElementById('app');

    if (loginWrapper) loginWrapper.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';

    showToast('Welcome back, Admin!', 'success');

    if (typeof startMasterDataListener === 'function') startMasterDataListener();
    if (typeof loadDashboardData === 'function') loadDashboardData();

    const hash = window.location.hash.replace('#', '');
    if (hash) {
      switchView(hash);
    } else {
      switchView('dashboard');
    }
  } else {
    if (errorAlert) {
      errorAlert.textContent = 'Invalid Username or Password!';
      errorAlert.style.display = 'block';
    }
    showToast('Invalid username or password!', 'error');
  }
}


function handleLogout() {
  localStorage.removeItem('beatbot_auth');
  localStorage.removeItem('beatbot_user');

  const loginWrapper = document.getElementById('login-screen-wrapper');
  const appContainer = document.getElementById('app');

  if (loginWrapper) loginWrapper.style.display = 'flex';
  if (appContainer) appContainer.style.display = 'none';

  const pwdInput = document.getElementById('login-password');
  if (pwdInput) pwdInput.value = '';

  showToast('Logged out successfully', 'success');
}

function togglePasswordVisibility() {
  const pwdInput = document.getElementById('login-password');
  const btn = document.getElementById('toggle-pwd-btn');
  if (!pwdInput) return;

  if (pwdInput.type === 'password') {
    pwdInput.type = 'text';
    if (btn) {
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.17c0-1.66-1.34-3-3-3l-.17.02z"/></svg>`;
    }
  } else {
    pwdInput.type = 'password';
    if (btn) {
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
    }
  }
}

/**
 * Theme Mode Management (Dark Default / Light Mode via localStorage)
 */
function initTheme() {
  const savedTheme = localStorage.getItem('beatbot-theme') || 'dark';
  applyTheme(savedTheme);

  const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('beatbot-theme', theme);

  const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
  toggleBtns.forEach(btn => {
    if (theme === 'light') {
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4C12.92 3.04 12.46 3 12 3z"/></svg> <span>Dark Mode</span>`;
    } else {
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg> <span>Light Mode</span>`;
    }
  });
}

function toggleTheme() {
  const current = localStorage.getItem('beatbot-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

/**
 * Loading Screen Controller
 */
function initLoadingScreen() {
  const screen = document.getElementById('loading-screen');
  if (screen) {
    setTimeout(() => {
      screen.style.opacity = '0';
      screen.style.visibility = 'hidden';
    }, 600);
  }
}

/**
 * Relative Upload Time Formatter
 */
function getRelativeTime(timestamp) {
  if (!timestamp) return 'Just now';

  let dateObj;
  if (timestamp.seconds) {
    dateObj = new Date(timestamp.seconds * 1000);
  } else if (timestamp instanceof Date) {
    dateObj = timestamp;
  } else {
    dateObj = new Date(timestamp);
  }

  if (isNaN(dateObj.getTime())) return 'Just now';

  const now = new Date();
  const diffInSeconds = Math.floor((now - dateObj) / 1000);

  if (diffInSeconds < 10) return 'Just now';
  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return diffInMinutes === 1 ? '1 minute ago' : `${diffInMinutes} minutes ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 14) return `${diffInDays} days ago`;

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return `${diffInWeeks} weeks ago`;

  const diffInMonths = Math.floor(diffInDays / 30);
  return diffInMonths <= 1 ? '1 month ago' : `${diffInMonths} months ago`;
}

/**
 * Toast Notification System
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success'
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="#10B981"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`
    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="#FF4D4D"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;

  toast.innerHTML = `
    ${icon}
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * Tab Navigation Router
 */
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const target = link.getAttribute('data-target');
      if (target) {
        e.preventDefault();
        switchView(target);
        closeMobileDrawer();
      }
    });
  });
}

function switchView(routeId) {
  if (routeId === 'add-advertisement') {
    switchView('advertisements');
    if (typeof openAdvertisementFormModal === 'function') {
      openAdvertisementFormModal();
    }
    return;
  }

  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('data-target') === routeId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.remove('active');
  });

  const activeView = document.getElementById(`view-${routeId}`);
  if (activeView) {
    activeView.classList.add('active');
  }

  const titles = {
    'dashboard': { title: 'Dashboard Overview', sub: '' },
    'upload': { title: 'Upload Music', sub: '' },
    'library': { title: 'Music Library', sub: '' },
    'master-data': { title: 'Master Data Manager', sub: '' },
    'advertisements': { title: 'Advertisement Management', sub: '' }
  };

  const titleElem = document.getElementById('page-title');
  const subElem = document.getElementById('page-subtitle');
  if (titles[routeId]) {
    if (titleElem) titleElem.textContent = titles[routeId].title;
    if (subElem) {
      subElem.textContent = '';
      subElem.style.display = 'none';
    }
  }

  if (routeId === 'dashboard' && typeof loadDashboardData === 'function') loadDashboardData();
  if (routeId === 'upload' && typeof loadUploadFormData === 'function') loadUploadFormData();
  if (routeId === 'library' && typeof loadLibraryData === 'function') loadLibraryData();
  if (routeId === 'master-data' && typeof loadMasterData === 'function') loadMasterData();
  if (routeId === 'advertisements' && typeof loadAdvertisementsData === 'function') loadAdvertisementsData();
}

function closeMobileDrawer() {
  document.querySelector('.sidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebar-overlay')?.classList.remove('active');
  const btn = document.getElementById('hamburger-btn');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

/**
  * Global Modal & Accessibility Listeners (Escape key, Backdrop click)
  */
function initGlobalModalListeners() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Close any active modal
      document.querySelectorAll('.modal-overlay.active').forEach(modal => {
        modal.classList.remove('active');
      });
      // Close mobile drawer
      closeMobileDrawer();
    }
  });

  // Attach backdrop click handler to all modals
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
}

/**
 * Mobile Drawer Menu
 */
function initMobileDrawer() {
  const btn = document.getElementById('hamburger-btn');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (btn && sidebar) {
    btn.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('mobile-open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (overlay) overlay.classList.toggle('active', isOpen);
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeMobileDrawer);
  }
}

/**
 * Floating Audio Preview Player
 */
let globalAudio = new Audio();
let isAudioPlaying = false;

function initGlobalAudioPlayer() {
  const playPauseBtn = document.getElementById('player-play-btn');
  const scrubber = document.getElementById('player-scrubber');
  const currTimeText = document.getElementById('player-current-time');
  const totalTimeText = document.getElementById('player-total-time');

  globalAudio.addEventListener('timeupdate', () => {
    if (globalAudio.duration) {
      const pct = (globalAudio.currentTime / globalAudio.duration) * 100;
      if (scrubber) scrubber.value = pct || 0;
      if (currTimeText) currTimeText.textContent = formatDuration(globalAudio.currentTime);
      if (totalTimeText) totalTimeText.textContent = formatDuration(globalAudio.duration);
    }
  });

  globalAudio.addEventListener('ended', () => {
    isAudioPlaying = false;
    updatePlayBtnIcon(false);
  });

  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
      if (!globalAudio.src) return;
      if (isAudioPlaying) {
        globalAudio.pause();
        isAudioPlaying = false;
        updatePlayBtnIcon(false);
      } else {
        globalAudio.play();
        isAudioPlaying = true;
        updatePlayBtnIcon(true);
      }
    });
  }

  if (scrubber) {
    scrubber.addEventListener('input', (e) => {
      if (globalAudio.duration) {
        const seekTime = (e.target.value / 100) * globalAudio.duration;
        globalAudio.currentTime = seekTime;
      }
    });
  }
}

function playTrackPreview(song) {
  const playerBar = document.getElementById('audio-player-bar');
  const coverImg = document.getElementById('player-cover');
  const titleText = document.getElementById('player-title');
  const artistText = document.getElementById('player-artist');

  if (coverImg) coverImg.src = song.imageUrl || 'images/logo.png';
  if (titleText) titleText.textContent = song.title || 'Unknown Track';
  if (artistText) artistText.textContent = song.artist || 'Unknown Artist';

  globalAudio.src = song.audioUrl;
  globalAudio.play().then(() => {
    isAudioPlaying = true;
    updatePlayBtnIcon(true);
    if (playerBar) playerBar.classList.add('active');
  }).catch(err => {
    showToast('Failed to play audio preview', 'error');
  });
}

function updatePlayBtnIcon(playing) {
  const btn = document.getElementById('player-play-btn');
  if (!btn) return;
  if (playing) {
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#FFF"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
  } else {
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z"/></svg>`;
  }
}

function formatDuration(seconds) {
  if (isNaN(seconds) || seconds === null) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function formatFileSize(bytes) {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
