/* ==========================================================================
   BeatBotAdmin - Firebase Configuration & Setup
   - Firebase 1 (beatbotadmin): Songs / Music Library
   - Firebase 2 (beatbotlogin): Auth, Users, Profile Images
   - Firebase 3 (beatbotnotification-89aff): ONLY Notifications
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

// Firebase 2: Login & Authentication System
const loginFirebaseConfig = {
  apiKey: "AIzaSyBkV2euw3Iac7v3SYwMH2qXh-pyS89Sqk4",
  authDomain: "beatbotlogin.firebaseapp.com",
  projectId: "beatbotlogin",
  storageBucket: "beatbotlogin.firebasestorage.app",
  messagingSenderId: "927878934493"
};

// Firebase 3: ONLY Notifications System (beatbotnotification-89aff)
const notificationFirebaseConfig = {
  apiKey: "AIzaSyCKFKz7ljt3IXL-b71kYBVguXakgQ2EBqg",
  authDomain: "beatbotnotification-89aff.firebaseapp.com",
  projectId: "beatbotnotification-89aff",
  storageBucket: "beatbotnotification-89aff.firebasestorage.app",
  messagingSenderId: "66215473820",
  appId: "1:66215473820:web:59cdcb7412da36d9b5b359",
  measurementId: "G-19STZY0BKC"
};
if (typeof window !== 'undefined') {
  window.notificationFirebaseConfig = notificationFirebaseConfig;
}

// Firebase 4: ONLY Advertisement System (beatbotadvertisement)
const adFirebaseConfig = {
  apiKey: "AIzaSyBQQk3_bdeNV2HeAFcqx0IQVFli1gKDigo",
  authDomain: "beatbotadvertisement.firebaseapp.com",
  projectId: "beatbotadvertisement",
  storageBucket: "beatbotadvertisement.firebasestorage.app",
  messagingSenderId: "852959536157",
  appId: "1:852959536157:web:2aa9fe7a327943fd9292f4",
  measurementId: "G-49WGF64JVG"
};

let db = null;
let storage = null;
let loginDb = null;
let notificationDb = null;
let adDb = null;
let adStorage = null;
let isFirebaseInitialized = false;

// Default Seed Data
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
    if (typeof firebase === 'undefined') {
      console.error("BeatBotAdmin: Firebase SDK not loaded! Check script tags in index.html.");
      return;
    }

    // 1. Initialize Firebase App 1 (beatbotadmin - Songs)
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    // 2. Initialize Firebase App 2 (beatbotlogin - Login & Users)
    let loginApp = firebase.apps.find(app => app.name === "beatbotLoginApp");
    if (!loginApp) {
      try {
        loginApp = firebase.initializeApp(loginFirebaseConfig, "beatbotLoginApp");
      } catch (e) {
        console.warn("BeatBotAdmin: Login Firebase app init notice", e);
      }
    }

    // 3. Initialize Firebase App 3 (beatbotnotification-89aff - Notifications ONLY)
    let notificationApp = firebase.apps.find(app => app.name === "beatbotNotificationApp");
    if (!notificationApp) {
      try {
        notificationApp = firebase.initializeApp(notificationFirebaseConfig, "beatbotNotificationApp");
      } catch (e) {
        console.warn("BeatBotAdmin: Notification Firebase app init notice", e);
      }
    }

    // 4. Initialize Firebase App 4 (beatbotadvertisement - Advertisements ONLY)
    let adApp = firebase.apps.find(app => app.name === "beatbotAdApp");
    if (!adApp) {
      try {
        adApp = firebase.initializeApp(adFirebaseConfig, "beatbotAdApp");
      } catch (e) {
        console.warn("BeatBotAdmin: Advertisement Firebase app init notice", e);
      }
    }

    db = firebase.firestore();
    storage = firebase.storage();

    if (loginApp) {
      try {
        loginDb = loginApp.firestore();
      } catch (e) {
        console.warn("BeatBotAdmin: loginDb Firestore init notice", e);
      }
    } else {
      loginDb = db;
    }

    let notificationStorage = null;

    if (notificationApp) {
      try {
        notificationDb = notificationApp.firestore();
        notificationStorage = notificationApp.storage();
      } catch (e) {
        console.warn("BeatBotAdmin: notificationDb Firestore/Storage init notice", e);
      }
    }
    window.notificationStorage = notificationStorage;
    window.notificationDb = notificationDb;
    window.notificationApp = notificationApp;

    if (adApp) {
      try {
        adDb = adApp.firestore();
        adStorage = adApp.storage();
      } catch (e) {
        console.warn("BeatBotAdmin: adDb Firestore/Storage init notice", e);
      }
    } else {
      adDb = db;
      adStorage = storage;
    }
    window.adDb = adDb;
    window.adStorage = adStorage;
    window.adApp = adApp;

    isFirebaseInitialized = true;
    console.log("BeatBotAdmin: Firebase Multi-Project Architecture Initialized.");
    console.log("BeatBotAdmin: Firebase 1 (beatbotadmin /songs) →", db ? "✔ Ready" : "✘ Failed");
    console.log("BeatBotAdmin: Firebase 2 (beatbotlogin /users) →", loginDb ? "✔ Ready" : "✘ Failed");
    console.log("BeatBotAdmin: Firebase 3 (beatbotnotification-89aff /notifications) →", notificationDb ? "✔ Ready" : "✘ Failed");
    console.log("BeatBotAdmin: Firebase 4 (beatbotadvertisement /advertisements) →", adDb ? "✔ Ready" : "✘ Failed");

    // Auto seed masterData collection if empty
    seedMasterDataIfEmpty();
    // Clean up duplicate masterData entries safely
    cleanupDuplicateMasterData();
  } catch (err) {
    console.error("BeatBotAdmin: Firebase init error", err);
  }
}

async function seedMasterDataIfEmpty() {
  if (!db) return;
  try {
    const catSnap = await db.collection("categories").get();
    if (catSnap.empty) {
      const batch = db.batch();
      DEFAULT_CATEGORIES.forEach(cat => {
        const ref = db.collection("categories").doc();
        batch.set(ref, { name: cat, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      });
      await batch.commit();
      console.log("BeatBotAdmin: Seeded default categories.");
    }

    const langSnap = await db.collection("languages").get();
    if (langSnap.empty) {
      const batch = db.batch();
      DEFAULT_LANGUAGES.forEach(lang => {
        const ref = db.collection("languages").doc();
        batch.set(ref, { name: lang, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      });
      await batch.commit();
      console.log("BeatBotAdmin: Seeded default languages.");
    }

    const countrySnap = await db.collection("countries").get();
    if (countrySnap.empty) {
      const batch = db.batch();
      DEFAULT_COUNTRIES.forEach(c => {
        const ref = db.collection("countries").doc();
        batch.set(ref, { name: c, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      });
      await batch.commit();
      console.log("BeatBotAdmin: Seeded default countries.");
    }
  } catch (e) {
    console.warn("BeatBotAdmin: Seed master data notice", e);
  }
}

async function cleanupDuplicateMasterData() {
  if (!db) return;
  try {
    const collections = ["categories", "languages", "countries"];
    for (const collName of collections) {
      const snap = await db.collection(collName).get();
      const seen = new Map();
      const duplicateDocRefs = [];

      snap.forEach(doc => {
        const data = doc.data();
        const rawName = (data.name || '').trim().toLowerCase();
        if (rawName) {
          if (seen.has(rawName)) {
            duplicateDocRefs.push(doc.ref);
          } else {
            seen.set(rawName, doc.id);
          }
        }
      });

      if (duplicateDocRefs.length > 0) {
        const batch = db.batch();
        duplicateDocRefs.forEach(ref => batch.delete(ref));
        await batch.commit();
        console.log(`BeatBotAdmin: Cleaned up ${duplicateDocRefs.length} duplicate items from ${collName}.`);
      }
    }
  } catch (e) {
    console.warn("BeatBotAdmin: Cleanup master data notice", e);
  }
}
