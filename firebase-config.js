/* ==========================================================================
   BeatBotAdmin - Firebase Configuration & Initializer
   ========================================================================== */

// Firebase 1: Songs & Music Catalog
const firebaseConfig = {
  apiKey: "AIzaSyBkV2euw3Iac7v3SYwMH2qXh-pyS89Sqk4",
  authDomain: "beatbotadmin.firebaseapp.com",
  projectId: "beatbotadmin",
  storageBucket: "beatbotadmin.firebasestorage.app",
  messagingSenderId: "177855082445",
  appId: "1:177855082445:web:f96217bd35debf4db21e84",
  measurementId: "G-7GGJVG6VTM"
};

// Firebase 3: ONLY Notifications System
const notificationFirebaseConfig = {
  apiKey: "AIzaSyCKFKz7ljt3IXL-b71kYBVguXakgQ2EBqg",
  authDomain: "beatbotnotification-89aff.firebaseapp.com",
  projectId: "beatbotnotification-89aff",
  storageBucket: "beatbotnotification-89aff.firebasestorage.app",
  messagingSenderId: "66215473820",
  appId: "1:66215473820:web:59cdcb7412da36d9b5b359",
  measurementId: "G-19STZY0BKC"
};

let db = null;
let storage = null;
let loginDb = null;
let notificationDb = null;
let isFirebaseReady = false;

const DEFAULT_CATEGORIES = [
  "Trending", "Pop", "Happy", "Romantic", "New Release",
  "Devotional", "Melody", "Love", "Sad", "Party",
  "Dance", "EDM", "Folk", "Classical", "Instrumental",
  "Hip-Hop", "Rap", "Rock", "Acoustic", "Chill"
];

const DEFAULT_LANGUAGES = [
  "Kannada", "Hindi", "Tamil", "Telugu", "Malayalam",
  "Tulu", "English", "Japanese", "Korean", "Punjabi",
  "Marathi", "Bengali", "Gujarati"
];

const DEFAULT_COUNTRIES = [
  "India", "Japan", "USA", "UK", "Canada",
  "Australia", "South Korea", "Germany", "France", "UAE"
];

function initFirebase() {
  try {
    if (typeof firebase !== 'undefined') {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();
      storage = firebase.storage();

      let notificationApp = firebase.apps.find(app => app.name === "beatbotNotificationApp");
      if (!notificationApp) {
        try {
          notificationApp = firebase.initializeApp(notificationFirebaseConfig, "beatbotNotificationApp");
        } catch (e) { }
      }

      notificationDb = notificationApp ? notificationApp.firestore() : db;
      loginDb = db;
      isFirebaseReady = true;
      console.log("BeatBotAdmin: Firebase successfully initialized.");
    } else {
      console.warn("BeatBotAdmin: Firebase SDK script not loaded yet.");
    }
  } catch (error) {
    console.error("BeatBotAdmin: Firebase initialization error", error);
  }
}
