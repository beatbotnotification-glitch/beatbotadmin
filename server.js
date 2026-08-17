/* ==========================================================================
   BeatBotAdmin - Node.js Express Backend Server & API Proxy (Firebase Multi-Project)
   - Firebase 1 (beatbotadmin): Songs / Music Catalog
   - Firebase 2 (beatbotlogin): Auth, Users, Profile Images
   - Firebase 3 (beatbotnotification-89aff): ONLY Notifications
   ========================================================================== */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 8080;

const allowedOrigins = [
  'https://ja-b50dd2.netlify.app',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:5500',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.netlify.app')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Website Files
app.use(express.static(path.join(__dirname)));

// Firebase 2 Admin Initialization (beatbotlogin project for Users & Auth)
let firebaseLoginAdmin = null;
let firebaseAdminInitError = null;

// Firebase 3 Config (beatbotnotification-89aff for Notifications ONLY)
const NOTIFICATION_PROJECT_ID = "beatbotnotification-89aff";
const NOTIFICATION_API_KEY = "AIzaSyCKFKz7ljt3IXL-b71kYBVguXakgQ2EBqg";

// Firebase 4 Config (beatbotadvertisement for Advertisements ONLY)
const ADVERTISEMENT_PROJECT_ID = "beatbotadvertisement";
const ADVERTISEMENT_API_KEY = "AIzaSyBQQk3_bdeNV2HeAFcqx0IQVFli1gKDigo";

function initFirebaseLoginAdmin() {
  try {
    const existingApp = admin.apps.find(a => a.name === "beatbotlogin");
    if (existingApp) {
      firebaseLoginAdmin = existingApp;
      return;
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      firebaseLoginAdmin = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || "beatbotlogin"
      }, "beatbotlogin");
      console.log("Firebase 2 (beatbotlogin) Admin SDK initialized via env JSON ✔");
      return;
    }

    const possibleKeys = [
      'serviceAccountKey.json',
      'serviceaccountkey.json',
      'beatbotlogin-service-account.json',
      'firebase-service-account.json',
      'service-account.json'
    ];

    for (const keyFileName of possibleKeys) {
      const keyPath = path.join(__dirname, keyFileName);
      if (fs.existsSync(keyPath)) {
        try {
          const raw = fs.readFileSync(keyPath, 'utf8');
          const serviceAccount = JSON.parse(raw);
          if (serviceAccount.private_key && serviceAccount.client_email) {
            firebaseLoginAdmin = admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: serviceAccount.project_id || "beatbotlogin"
            }, "beatbotlogin");
            firebaseAdminInitError = null;
            console.log(`Firebase 2 (beatbotlogin) Admin SDK initialized via ${keyFileName} ✔`);
            return;
          }
        } catch (err) {
          console.warn(`Notice reading key file ${keyFileName}:`, err.message);
        }
      }
    }

    firebaseAdminInitError = "Service Account file not found. Expected serviceAccountKey.json in website root directory.";
    console.warn("BeatBotAdmin Backend Warning:", firebaseAdminInitError);
  } catch (e) {
    firebaseAdminInitError = "Firebase Admin initialization error: " + e.message;
    console.warn("BeatBotAdmin Backend Error:", e.message);
  }
}

initFirebaseLoginAdmin();

/**
 * Requirement: Automatic 24-Hour Notification Cleanup Daemon
 * Automatically purges expired notification documents (expiresAt <= current time) strictly from Firebase 3 (beatbotnotification-89aff).
 */
function startScheduledNotificationCleanupDaemon() {
  setInterval(async () => {
    try {
      const listUrl = `https://firestore.googleapis.com/v1/projects/${NOTIFICATION_PROJECT_ID}/databases/(default)/documents/notifications?key=${NOTIFICATION_API_KEY}`;
      const res = await fetch(listUrl);
      const data = await res.json();

      if (data && data.documents && Array.isArray(data.documents)) {
        const nowMs = Date.now();
        let deletedCount = 0;

        for (const doc of data.documents) {
          const docName = doc.name; // projects/beatbotnotification-89aff/databases/(default)/documents/notifications/{id}
          const fields = doc.fields || {};

          let expMs = 0;
          if (fields.expiresAt) {
            if (fields.expiresAt.timestampValue) {
              expMs = new Date(fields.expiresAt.timestampValue).getTime();
            } else if (fields.expiresAt.stringValue) {
              expMs = new Date(fields.expiresAt.stringValue).getTime();
            }
          }

          if (expMs && expMs <= nowMs) {
            const deleteUrl = `https://firestore.googleapis.com/v1/${docName}?key=${NOTIFICATION_API_KEY}`;
            const delRes = await fetch(deleteUrl, { method: 'DELETE' });
            if (delRes.ok) {
              deletedCount++;
            }
          }
        }

        if (deletedCount > 0) {
          console.log(`BeatBotAdmin Daemon: Automatically purged ${deletedCount} expired 24h notification(s) from Firebase 3 (${NOTIFICATION_PROJECT_ID}) ✔`);
        }
      }
    } catch (err) {
      // Daemon background notice
    }
  }, 5 * 60 * 1000); // 5 minutes interval
}

startScheduledNotificationCleanupDaemon();

/**
 * 0. GET /api/health
 * Health check endpoint for monitoring production backend deployment status
 */
app.get('/api/health', (req, res) => {
  return res.json({
    success: true,
    service: "BeatBot Admin Backend",
    status: "online",
    timestamp: new Date().toISOString()
  });
});

/**
 * 1. GET /api/users
 * Safely list Firebase Authentication registered users from Firebase 2 (beatbotlogin).
 * Implements pagination with listUsers(1000, pageToken) to retrieve ALL registered users.
 * Sorts users by lastSignInTime descending (recently signed-in users first).
 */
app.get('/api/users', async (req, res) => {
  if (!firebaseLoginAdmin) {
    return res.status(500).json({
      success: false,
      error: firebaseAdminInitError || "Service Account credentials not configured for beatbotlogin project.",
      endpoint: "/api/users",
      method: "GET",
      users: [],
      totalUsers: 0
    });
  }

  try {
    let allUsers = [];
    let pageToken = undefined;

    do {
      const listUsersResult = await firebaseLoginAdmin.auth().listUsers(1000, pageToken);
      allUsers = allUsers.concat(listUsersResult.users);
      pageToken = listUsersResult.pageToken;
    } while (pageToken);

    const authUsers = allUsers.map(u => ({
      uid: u.uid,
      email: u.email || 'N/A',
      displayName: u.displayName || null,
      photoURL: u.photoURL || null,
      disabled: !!u.disabled,
      creationTime: u.metadata?.creationTime || null,
      lastSignInTime: u.metadata?.lastSignInTime || null
    }));

    // Sort users: Recently signed in first (newest lastSignInTime). Users with no lastSignInTime placed after.
    authUsers.sort((a, b) => {
      const timeA = a.lastSignInTime ? new Date(a.lastSignInTime).getTime() : 0;
      const timeB = b.lastSignInTime ? new Date(b.lastSignInTime).getTime() : 0;
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      const createA = a.creationTime ? new Date(a.creationTime).getTime() : 0;
      const createB = b.creationTime ? new Date(b.creationTime).getTime() : 0;
      return createB - createA;
    });

    return res.json({
      success: true,
      users: authUsers,
      totalUsers: authUsers.length
    });
  } catch (error) {
    console.error("BeatBotAdmin Backend: /api/users Auth listUsers error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Firebase Authentication request failed: " + error.message,
      endpoint: "/api/users",
      method: "GET",
      users: [],
      totalUsers: 0
    });
  }
});

/**
 * 2. PATCH /api/users/:uid/status
 * Enable or Disable a Firebase Authentication account securely on Firebase 2 (beatbotlogin)
 */
app.patch('/api/users/:uid/status', async (req, res) => {
  const { uid } = req.params;
  const { disabled } = req.body;

  if (!uid) {
    return res.status(400).json({ success: false, error: 'UID is required' });
  }

  if (!firebaseLoginAdmin) {
    return res.status(500).json({ success: false, error: firebaseAdminInitError || 'Firebase Admin SDK not initialized' });
  }

  try {
    const updatedUser = await firebaseLoginAdmin.auth().updateUser(uid, {
      disabled: !!disabled
    });

    return res.json({
      success: true,
      message: disabled ? 'Account disabled successfully' : 'Account enabled successfully',
      uid: updatedUser.uid,
      disabled: updatedUser.disabled
    });
  } catch (error) {
    console.error(`BeatBotAdmin Backend: Error updating user ${uid}:`, error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 3. DELETE /api/users/:uid
 * Permanently delete a Firebase Authentication account securely on Firebase 2 (beatbotlogin)
 */
app.delete('/api/users/:uid', async (req, res) => {
  const { uid } = req.params;

  if (!uid) {
    return res.status(400).json({ success: false, error: 'UID is required' });
  }

  if (!firebaseLoginAdmin) {
    return res.status(500).json({ success: false, error: firebaseAdminInitError || 'Firebase Admin SDK not initialized' });
  }

  try {
    await firebaseLoginAdmin.auth().deleteUser(uid);
    return res.json({
      success: true,
      message: 'User deleted successfully',
      uid
    });
  } catch (error) {
    console.error(`BeatBotAdmin Backend: Error deleting user ${uid}:`, error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 4. GET /api/notifications
 * Reads active non-expired notifications strictly from Firebase 3 (beatbotnotification-89aff)
 */
app.get('/api/notifications', async (req, res) => {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${NOTIFICATION_PROJECT_ID}/databases/(default)/documents/notifications?key=${NOTIFICATION_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error("========================================");
      console.error(`Notification Firebase project ID: ${NOTIFICATION_PROJECT_ID}`);
      console.error(`Firestore collection: notifications`);
      console.error(`Operation: READ`);
      console.error(`Status: FAILED (${response.status})`);
      console.error("========================================");
      return res.status(response.status).json({ success: false, error: data.error?.message || "Failed to fetch notifications" });
    }

    const notifications = [];
    const nowMs = Date.now();

    if (data.documents && Array.isArray(data.documents)) {
      data.documents.forEach(doc => {
        const fields = doc.fields || {};
        const pathParts = doc.name.split('/');
        const docId = pathParts[pathParts.length - 1];

        let createdAt = fields.createdAt?.timestampValue || fields.createdAt?.stringValue || doc.createTime;
        let expiresAt = fields.expiresAt?.timestampValue || fields.expiresAt?.stringValue || null;
        let updatedAt = fields.updatedAt?.timestampValue || fields.updatedAt?.stringValue || doc.updateTime;

        let expMs = 0;
        if (expiresAt) {
          expMs = new Date(expiresAt).getTime();
        }

        if (!expMs || expMs > nowMs) {
          notifications.push({
            id: fields.id?.stringValue || docId,
            title: fields.title?.stringValue || '',
            content: fields.content?.stringValue || fields.message?.stringValue || '',
            message: fields.content?.stringValue || fields.message?.stringValue || '',
            sender: fields.sender?.stringValue || 'BeatBot Team',
            type: fields.type?.stringValue || 'announcement',
            createdAt: createdAt,
            expiresAt: expiresAt,
            updatedAt: updatedAt
          });
        }
      });
    }

    // Sort by createdAt descending
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log("========================================");
    console.log(`Notification Firebase project ID: ${NOTIFICATION_PROJECT_ID}`);
    console.log(`Firestore collection: notifications`);
    console.log(`Operation: READ`);
    console.log(`Active Notifications Returned: ${notifications.length}`);
    console.log("========================================");

    return res.json({
      success: true,
      notifications,
      projectId: NOTIFICATION_PROJECT_ID,
      collection: "notifications"
    });
  } catch (error) {
    console.error("BeatBotAdmin Backend: GET /api/notifications error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 5. POST /api/notifications
 * Creates document in Firebase 3 (beatbotnotification-89aff) -> verifies write by reading document back
 */
app.post('/api/notifications', async (req, res) => {
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ success: false, error: 'Message Title and Message Content are required' });
  }

  const now = new Date();
  const createdAtIso = now.toISOString();
  const expiresAtIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Create document in Firebase 3 (beatbotnotification-89aff)
    const postUrl = `https://firestore.googleapis.com/v1/projects/${NOTIFICATION_PROJECT_ID}/databases/(default)/documents/notifications?key=${NOTIFICATION_API_KEY}`;

    const postBody = {
      fields: {
        title: { stringValue: title.trim() },
        content: { stringValue: content.trim() },
        message: { stringValue: content.trim() },
        sender: { stringValue: "BeatBot Team" },
        type: { stringValue: "announcement" },
        createdAt: { timestampValue: createdAtIso },
        expiresAt: { timestampValue: expiresAtIso },
        updatedAt: { timestampValue: createdAtIso }
      }
    };

    const createRes = await fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postBody)
    });

    const createData = await createRes.json();

    if (!createRes.ok || !createData.name) {
      console.log("========================================");
      console.log(`Notification Firebase project ID: ${NOTIFICATION_PROJECT_ID}`);
      console.log(`Firestore collection: notifications`);
      console.log(`Operation: CREATE`);
      console.log(`Firestore write: FAILED`);
      console.log(`Firestore verification: FAILED`);
      console.log("========================================");
      return res.status(createRes.status || 500).json({
        success: false,
        error: createData.error?.message || "Failed to create notification document in Firebase 3"
      });
    }

    // Extract generated document ID
    const pathParts = createData.name.split('/');
    const docId = pathParts[pathParts.length - 1];

    // Update document to embed its own id field
    const patchIdUrl = `https://firestore.googleapis.com/v1/${createData.name}?updateMask.fieldPaths=id&key=${NOTIFICATION_API_KEY}`;
    await fetch(patchIdUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { id: { stringValue: docId } } })
    });

    // 2. READ-BACK VERIFICATION CHECK: Read the exact document back from Firebase 3
    const getDocUrl = `https://firestore.googleapis.com/v1/${createData.name}?key=${NOTIFICATION_API_KEY}`;
    const verifyRes = await fetch(getDocUrl);
    const verifyData = await verifyRes.json();

    const verificationSuccess = verifyRes.ok && !!verifyData.name;

    console.log("========================================");
    console.log(`Notification Firebase project ID: ${NOTIFICATION_PROJECT_ID}`);
    console.log(`Firestore collection: notifications`);
    console.log(`Operation: CREATE`);
    console.log(`Notification document ID: ${docId}`);
    console.log(`Firestore write: SUCCESS`);
    console.log(`Firestore verification: ${verificationSuccess ? "SUCCESS" : "FAILED"}`);
    console.log("========================================");

    if (!verificationSuccess) {
      return res.status(500).json({
        success: false,
        error: "Firestore write verification failed: Document does not exist in Firebase 3 after write.",
        projectId: NOTIFICATION_PROJECT_ID,
        collection: "notifications"
      });
    }

    // Trigger FCM Multicast Push asynchronously
    sendFcmPushNotificationInternal(title.trim(), content.trim(), docId).catch(err => {
      console.warn("FCM push notice:", err.message);
    });

    return res.json({
      success: true,
      message: "Notification sent successfully",
      notificationId: docId,
      documentPath: `/notifications/${docId}`,
      collection: "notifications",
      projectId: NOTIFICATION_PROJECT_ID,
      verified: true
    });

  } catch (error) {
    console.log("========================================");
    console.log(`Notification Firebase project ID: ${NOTIFICATION_PROJECT_ID}`);
    console.log(`Firestore collection: notifications`);
    console.log(`Operation: CREATE`);
    console.log(`Firestore write: FAILED`);
    console.log(`Firestore verification: FAILED`);
    console.log("========================================");
    console.error("BeatBotAdmin Backend: POST /api/notifications error:", error.message);

    return res.status(500).json({
      success: false,
      error: "Failed to save notification to Firebase 3: " + error.message,
      projectId: NOTIFICATION_PROJECT_ID,
      collection: "notifications"
    });
  }
});

/**
 * 6. PATCH /api/notifications/:id
 * Edit notification in Firebase 3 (beatbotnotification-89aff)
 * Updates title, content, sender, type, updatedAt (PRESERVES original createdAt & 24h expiresAt)
 */
app.patch('/api/notifications/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, error: 'Notification ID is required' });
  }

  if (!title || !content) {
    return res.status(400).json({ success: false, error: 'Title and Content are required' });
  }

  const updatedAtIso = new Date().toISOString();

  try {
    const patchUrl = `https://firestore.googleapis.com/v1/projects/${NOTIFICATION_PROJECT_ID}/databases/(default)/documents/notifications/${id}?updateMask.fieldPaths=title&updateMask.fieldPaths=content&updateMask.fieldPaths=message&updateMask.fieldPaths=sender&updateMask.fieldPaths=type&updateMask.fieldPaths=updatedAt&key=${NOTIFICATION_API_KEY}`;

    const patchBody = {
      fields: {
        title: { stringValue: title.trim() },
        content: { stringValue: content.trim() },
        message: { stringValue: content.trim() },
        sender: { stringValue: "BeatBot Team" },
        type: { stringValue: "announcement" },
        updatedAt: { timestampValue: updatedAtIso }
      }
    };

    const updateRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody)
    });

    const updateData = await updateRes.json();

    if (!updateRes.ok) {
      console.log("========================================");
      console.log(`Notification Firebase project ID: ${NOTIFICATION_PROJECT_ID}`);
      console.log(`Firestore collection: notifications`);
      console.log(`Operation: UPDATE`);
      console.log(`Notification document ID: ${id}`);
      console.log(`Firestore write: FAILED`);
      console.log(`Firestore verification: FAILED`);
      console.log("========================================");
      return res.status(updateRes.status || 500).json({ success: false, error: updateData.error?.message || "Failed to update notification" });
    }

    // Read-back verification check
    const verifyUrl = `https://firestore.googleapis.com/v1/projects/${NOTIFICATION_PROJECT_ID}/databases/(default)/documents/notifications/${id}?key=${NOTIFICATION_API_KEY}`;
    const verifyRes = await fetch(verifyUrl);
    const verifyData = await verifyRes.json();
    const verificationSuccess = verifyRes.ok && !!verifyData.name;

    console.log("========================================");
    console.log(`Notification Firebase project ID: ${NOTIFICATION_PROJECT_ID}`);
    console.log(`Firestore collection: notifications`);
    console.log(`Operation: UPDATE`);
    console.log(`Notification document ID: ${id}`);
    console.log(`Firestore write: SUCCESS`);
    console.log(`Firestore verification: ${verificationSuccess ? "SUCCESS" : "FAILED"}`);
    console.log("========================================");

    return res.json({
      success: true,
      message: 'Notification updated successfully',
      id,
      verified: verificationSuccess
    });
  } catch (error) {
    console.error(`BeatBotAdmin Backend: PATCH /api/notifications/${id} error:`, error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 7. DELETE /api/notifications/:id
 * Delete notification document from Firebase 3 (beatbotnotification-89aff)
 */
app.delete('/api/notifications/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ success: false, error: 'Notification ID is required' });
  }

  try {
    const deleteUrl = `https://firestore.googleapis.com/v1/projects/${NOTIFICATION_PROJECT_ID}/databases/(default)/documents/notifications/${id}?key=${NOTIFICATION_API_KEY}`;

    const delRes = await fetch(deleteUrl, { method: 'DELETE' });

    if (!delRes.ok) {
      console.log("========================================");
      console.log(`Notification Firebase project ID: ${NOTIFICATION_PROJECT_ID}`);
      console.log(`Firestore collection: notifications`);
      console.log(`Operation: DELETE`);
      console.log(`Notification document ID: ${id}`);
      console.log(`Firestore write: FAILED`);
      console.log(`Firestore verification: FAILED`);
      console.log("========================================");
      return res.status(delRes.status || 500).json({ success: false, error: "Failed to delete notification" });
    }

    // Read-back verification check (must be 404 Not Found)
    const verifyRes = await fetch(deleteUrl);
    const deletedVerified = (verifyRes.status === 404);

    console.log("========================================");
    console.log(`Notification Firebase project ID: ${NOTIFICATION_PROJECT_ID}`);
    console.log(`Firestore collection: notifications`);
    console.log(`Operation: DELETE`);
    console.log(`Notification document ID: ${id}`);
    console.log(`Firestore write: SUCCESS`);
    console.log(`Firestore verification: ${deletedVerified ? "SUCCESS" : "FAILED"}`);
    console.log("========================================");

    return res.json({
      success: true,
      message: 'Notification deleted successfully',
      id,
      verified: deletedVerified
    });
  } catch (error) {
    console.error(`BeatBotAdmin Backend: DELETE /api/notifications/${id} error:`, error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Internal Helper: Send FCM Push Notification to registered Android device tokens
 */
async function sendFcmPushNotificationInternal(title, content, notificationId) {
  if (!firebaseLoginAdmin) return;

  try {
    const db = firebaseLoginAdmin.firestore();
    const tokensSet = new Set();

    const usersSnap = await db.collection("users").get();
    for (const doc of usersSnap.docs) {
      const uData = doc.data();
      if (uData.fcmToken && typeof uData.fcmToken === 'string') {
        tokensSet.add(uData.fcmToken.trim());
      }

      try {
        const devicesSnap = await doc.ref.collection("devices").get();
        devicesSnap.forEach(dDoc => {
          const dData = dDoc.data();
          if (dData.fcmToken && typeof dData.fcmToken === 'string') {
            tokensSet.add(dData.fcmToken.trim());
          }
        });
      } catch (e) { }
    }

    const tokens = Array.from(tokensSet).filter(Boolean);

    if (tokens.length === 0) {
      console.log("BeatBotAdmin Backend: Notification saved to Firebase 3. No registered FCM tokens found.");
      return;
    }

    const messagingPayload = {
      tokens: tokens,
      notification: {
        title: title,
        body: content
      },
      data: {
        title: title,
        content: content,
        notificationId: notificationId || '',
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'beatbot_notifications'
        }
      }
    };

    const response = await firebaseLoginAdmin.messaging().sendEachForMulticast(messagingPayload);
    console.log(`BeatBotAdmin Backend: FCM multicast delivered: ${response.successCount} success, ${response.failureCount} failed.`);
  } catch (error) {
    console.warn("BeatBotAdmin Backend: FCM Multicast warning:", error.message);
  }
}

/* ==========================================================================
   ADVERTISEMENT API ENDPOINTS (Firebase 4: beatbotadvertisement /advertisements)
   ========================================================================== */

/**
 * GET /api/advertisements
 * List all advertisement documents from Firebase 4 (beatbotadvertisement)
 */
app.get('/api/advertisements', async (req, res) => {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${ADVERTISEMENT_PROJECT_ID}/databases/(default)/documents/advertisements?key=${ADVERTISEMENT_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      // If collection doesn't exist yet, return empty list cleanly
      if (response.status === 404) {
        return res.json({ success: true, advertisements: [], projectId: ADVERTISEMENT_PROJECT_ID });
      }
      return res.status(response.status).json({ success: false, error: data.error?.message || "Failed to fetch advertisements" });
    }

    const advertisements = [];

    if (data.documents && Array.isArray(data.documents)) {
      data.documents.forEach(doc => {
        const fields = doc.fields || {};
        const pathParts = doc.name.split('/');
        const docId = pathParts[pathParts.length - 1];

        advertisements.push({
          id: fields.id?.stringValue || docId,
          title: fields.title?.stringValue || '',
          description: fields.description?.stringValue || '',
          mediaType: fields.mediaType?.stringValue || 'image',
          mediaUrl: fields.mediaUrl?.stringValue || '',
          thumbnailUrl: fields.thumbnailUrl?.stringValue || fields.mediaUrl?.stringValue || '',
          buttonText: fields.buttonText?.stringValue || '',
          destinationUrl: fields.destinationUrl?.stringValue || '',
          clickUrl: fields.clickUrl?.stringValue || fields.destinationUrl?.stringValue || '',
          startAt: fields.startAt?.timestampValue || fields.startAt?.stringValue || doc.createTime,
          endAt: fields.endAt?.timestampValue || fields.endAt?.stringValue || '',
          priority: parseInt(fields.priority?.integerValue || fields.priority?.stringValue || '1', 10) || 1,
          active: fields.active?.booleanValue !== undefined ? fields.active.booleanValue : ((fields.status?.stringValue || 'active') === 'active'),
          status: fields.status?.stringValue || 'active',
          impressions: parseInt(fields.impressions?.integerValue || '0', 10) || 0,
          clicks: parseInt(fields.clicks?.integerValue || '0', 10) || 0,
          createdAt: fields.createdAt?.timestampValue || fields.createdAt?.stringValue || doc.createTime,
          updatedAt: fields.updatedAt?.timestampValue || fields.updatedAt?.stringValue || doc.updateTime
        });
      });
    }

    // Sort by priority ASC (1 is highest priority), then createdAt DESC
    advertisements.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return res.json({
      success: true,
      advertisements,
      projectId: ADVERTISEMENT_PROJECT_ID,
      collection: "advertisements"
    });
  } catch (error) {
    console.error("BeatBotAdmin Backend: GET /api/advertisements error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/advertisements
 * Create advertisement in Firebase 4 (beatbotadvertisement)
 */
app.post('/api/advertisements', async (req, res) => {
  const {
    title,
    description,
    mediaType,
    mediaUrl,
    thumbnailUrl,
    buttonText,
    destinationUrl,
    clickUrl,
    startAt,
    endAt,
    priority,
    status
  } = req.body;

  if (!title || !mediaUrl) {
    return res.status(400).json({ success: false, error: 'Title and Media URL are required' });
  }

  const nowIso = new Date().toISOString();
  const startAtIso = startAt ? new Date(startAt).toISOString() : nowIso;
  const endAtIso = endAt ? new Date(endAt).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const priorityNum = parseInt(priority, 10) || 1;
  const statusStr = status || 'active';
  const finalClickUrl = clickUrl || destinationUrl || '';

  try {
    const postUrl = `https://firestore.googleapis.com/v1/projects/${ADVERTISEMENT_PROJECT_ID}/databases/(default)/documents/advertisements?key=${ADVERTISEMENT_API_KEY}`;

    const postBody = {
      fields: {
        title: { stringValue: title.trim() },
        description: { stringValue: (description || '').trim() },
        mediaType: { stringValue: (mediaType || 'image').toLowerCase() },
        mediaUrl: { stringValue: mediaUrl.trim() },
        thumbnailUrl: { stringValue: (thumbnailUrl || mediaUrl).trim() },
        buttonText: { stringValue: (buttonText || '').trim() },
        destinationUrl: { stringValue: finalClickUrl.trim() },
        clickUrl: { stringValue: finalClickUrl.trim() },
        startAt: { timestampValue: startAtIso },
        endAt: { timestampValue: endAtIso },
        priority: { integerValue: priorityNum },
        active: { booleanValue: statusStr === 'active' },
        status: { stringValue: statusStr },
        impressions: { integerValue: 0 },
        clicks: { integerValue: 0 },
        createdAt: { timestampValue: nowIso },
        updatedAt: { timestampValue: nowIso }
      }
    };

    const createRes = await fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postBody)
    });

    const createData = await createRes.json();

    if (!createRes.ok || !createData.name) {
      return res.status(createRes.status || 500).json({
        success: false,
        error: createData.error?.message || "Failed to create advertisement in Firebase 4 (beatbotadvertisement)"
      });
    }

    const pathParts = createData.name.split('/');
    const docId = pathParts[pathParts.length - 1];

    // Embed id field in document
    const patchIdUrl = `https://firestore.googleapis.com/v1/${createData.name}?updateMask.fieldPaths=id&key=${ADVERTISEMENT_API_KEY}`;
    await fetch(patchIdUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { id: { stringValue: docId } } })
    });

    return res.json({
      success: true,
      message: 'Advertisement published successfully',
      id: docId,
      projectId: ADVERTISEMENT_PROJECT_ID,
      collection: 'advertisements'
    });
  } catch (error) {
    console.error("BeatBotAdmin Backend: POST /api/advertisements error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/advertisements/:id
 * Edit advertisement document in Firebase 4 (beatbotadvertisement)
 */
app.patch('/api/advertisements/:id', async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    mediaType,
    mediaUrl,
    thumbnailUrl,
    buttonText,
    destinationUrl,
    clickUrl,
    startAt,
    endAt,
    priority,
    status
  } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, error: 'Advertisement ID is required' });
  }

  const updatedAtIso = new Date().toISOString();

  try {
    const fieldsToUpdate = {};
    const fieldPaths = ['updatedAt'];

    fieldsToUpdate.updatedAt = { timestampValue: updatedAtIso };

    if (title !== undefined) {
      fieldsToUpdate.title = { stringValue: title.trim() };
      fieldPaths.push('title');
    }
    if (description !== undefined) {
      fieldsToUpdate.description = { stringValue: (description || '').trim() };
      fieldPaths.push('description');
    }
    if (mediaType !== undefined) {
      fieldsToUpdate.mediaType = { stringValue: mediaType.toLowerCase() };
      fieldPaths.push('mediaType');
    }
    if (mediaUrl !== undefined) {
      fieldsToUpdate.mediaUrl = { stringValue: mediaUrl.trim() };
      fieldPaths.push('mediaUrl');
    }
    if (thumbnailUrl !== undefined || mediaUrl !== undefined) {
      fieldsToUpdate.thumbnailUrl = { stringValue: (thumbnailUrl || mediaUrl || '').trim() };
      fieldPaths.push('thumbnailUrl');
    }
    if (buttonText !== undefined) {
      fieldsToUpdate.buttonText = { stringValue: (buttonText || '').trim() };
      fieldPaths.push('buttonText');
    }
    if (destinationUrl !== undefined || clickUrl !== undefined) {
      const urlVal = (clickUrl || destinationUrl || '').trim();
      fieldsToUpdate.destinationUrl = { stringValue: urlVal };
      fieldsToUpdate.clickUrl = { stringValue: urlVal };
      fieldPaths.push('destinationUrl');
      fieldPaths.push('clickUrl');
    }
    if (startAt !== undefined) {
      fieldsToUpdate.startAt = { timestampValue: new Date(startAt).toISOString() };
      fieldPaths.push('startAt');
    }
    if (endAt !== undefined) {
      fieldsToUpdate.endAt = { timestampValue: new Date(endAt).toISOString() };
      fieldPaths.push('endAt');
    }
    if (priority !== undefined) {
      fieldsToUpdate.priority = { integerValue: parseInt(priority, 10) || 1 };
      fieldPaths.push('priority');
    }
    if (status !== undefined) {
      fieldsToUpdate.status = { stringValue: status };
      fieldsToUpdate.active = { booleanValue: status === 'active' };
      fieldPaths.push('status');
      fieldPaths.push('active');
    }

    const maskQuery = fieldPaths.map(fp => `updateMask.fieldPaths=${fp}`).join('&');
    const patchUrl = `https://firestore.googleapis.com/v1/projects/${ADVERTISEMENT_PROJECT_ID}/databases/(default)/documents/advertisements/${id}?${maskQuery}&key=${ADVERTISEMENT_API_KEY}`;

    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: fieldsToUpdate })
    });

    const patchData = await patchRes.json();

    if (!patchRes.ok) {
      return res.status(patchRes.status || 500).json({ success: false, error: patchData.error?.message || "Failed to update advertisement" });
    }

    return res.json({
      success: true,
      message: 'Advertisement updated successfully',
      id
    });
  } catch (error) {
    console.error(`BeatBotAdmin Backend: PATCH /api/advertisements/${id} error:`, error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/advertisements/:id/status
 * Toggle advertisement status (active / inactive) in Firebase 4
 */
app.patch('/api/advertisements/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!id || !status) {
    return res.status(400).json({ success: false, error: 'ID and Status are required' });
  }

  try {
    const isActive = status === 'active';
    const patchUrl = `https://firestore.googleapis.com/v1/projects/${ADVERTISEMENT_PROJECT_ID}/databases/(default)/documents/advertisements/${id}?updateMask.fieldPaths=status&updateMask.fieldPaths=active&updateMask.fieldPaths=updatedAt&key=${ADVERTISEMENT_API_KEY}`;
    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          status: { stringValue: status },
          active: { booleanValue: isActive },
          updatedAt: { timestampValue: new Date().toISOString() }
        }
      })
    });

    const patchData = await patchRes.json();
    if (!patchRes.ok) {
      return res.status(patchRes.status || 500).json({ success: false, error: patchData.error?.message || "Failed to toggle status" });
    }

    return res.json({ success: true, message: `Status updated to ${status}`, id, status, active: isActive });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/advertisements/:id
 * Delete advertisement document from Firebase 4 (beatbotadvertisement)
 */
app.delete('/api/advertisements/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ success: false, error: 'Advertisement ID is required' });
  }

  try {
    const deleteUrl = `https://firestore.googleapis.com/v1/projects/${ADVERTISEMENT_PROJECT_ID}/databases/(default)/documents/advertisements/${id}?key=${ADVERTISEMENT_API_KEY}`;
    const delRes = await fetch(deleteUrl, { method: 'DELETE' });

    if (!delRes.ok) {
      return res.status(delRes.status || 500).json({ success: false, error: "Failed to delete advertisement" });
    }

    return res.json({
      success: true,
      message: 'Advertisement deleted successfully',
      id
    });
  } catch (error) {
    console.error(`BeatBotAdmin Backend: DELETE /api/advertisements/${id} error:`, error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 8. POST /api/delete-cloudinary-asset
 * Secure backend API for deleting audio & image assets from Cloudinary
 */
app.post('/api/delete-cloudinary-asset', async (req, res) => {
  const { public_id, resource_type, database_id } = req.body;

  if (!public_id) {
    return res.status(400).json({ success: false, error: 'public_id is required' });
  }

  // Cloudinary credentials map
  const configs = {
    database1: {
      cloud_name: 't95iimy3',
      api_key: '646549219323147',
      api_secret: 'W50zN4QxG4e_o1R848uQ1H7v89w'
    },
    database2: {
      cloud_name: 'qbn0stjj',
      api_key: '568652254395244',
      api_secret: '034w-sN4k49zT1G7v89w'
    }
  };

  const targetDb = database_id || 'database2';
  const cfg = configs[targetDb] || configs.database2;

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const crypto = require('crypto');
    const type = resource_type || 'image';

    const stringToSign = `public_id=${public_id}&timestamp=${timestamp}${cfg.api_secret}`;
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

    const formData = new URLSearchParams();
    formData.append('public_id', public_id);
    formData.append('api_key', cfg.api_key);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);

    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cfg.cloud_name}/${type}/destroy`;

    const response = await fetch(cloudinaryUrl, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    return res.json({ success: true, result });
  } catch (err) {
    console.error('Cloudinary destroy error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 404 handler for unmatched API routes (guarantees JSON error responses instead of HTML/Text)
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API endpoint ${req.method} ${req.originalUrl} not found`,
    endpoint: req.originalUrl,
    method: req.method
  });
});

// Fallback route: serve index.html for SPA page navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Express Server (bound to 0.0.0.0 for production readiness)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`BeatBot Admin Backend running on port ${PORT}`);
});

