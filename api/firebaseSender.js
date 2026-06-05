const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
let messaging = null;

if (fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    messaging = admin.messaging();
    console.log('[Firebase] Push notifications initialized successfully');
  } catch (err) {
    console.error('[Firebase Error] Failed to initialize Firebase Admin:', err.message);
  }
} else {
  console.warn('[Firebase Warning] firebase-service-account.json not found in api directory. FCM push notifications are disabled.');
}

/**
 * Send a desktop push notification to specific users
 * @param {string|string[]} userIds - Single UUID or comma-separated UUIDs of users to notify
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} prisma - Prisma client instance
 */
const sendPushNotification = async (userIds, title, body, prisma) => {
  console.log(`[Firebase DEBUG] sendPushNotification called with:`, { userIds, title, body });
  
  if (!messaging) {
    console.log('[Firebase] Skipping push notification (FCM not initialized):', title, '-', body);
    return;
  }

  if (!userIds) {
    console.log('[Firebase DEBUG] userIds is null/undefined, skipping');
    return;
  }
  const ids = (typeof userIds === 'string' ? userIds.split(',') : userIds).map(u => u.trim()).filter(Boolean);
  console.log(`[Firebase DEBUG] Parsed IDs:`, ids);
  
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { fullName: true, fcmToken: true }
    });

    console.log(`[Firebase DEBUG] Found ${users.length} users:`, users.map(u => ({ name: u.fullName, hasToken: !!u.fcmToken, token: u.fcmToken?.substring(0, 20) + '...' })));

    const tokens = users.map(u => u.fcmToken).filter(Boolean);
    if (tokens.length === 0) {
      console.log(`[Firebase] No active FCM tokens found for users: ${names.join(', ')}`);
      return;
    }

    const message = {
      notification: { title, body },
      tokens: tokens
    };

    console.log(`[Firebase DEBUG] Sending to ${tokens.length} tokens...`);
    const response = await messaging.sendEachForMulticast(message);
    console.log(`[Firebase] Push notification sent. Success count: ${response.successCount}, Failure count: ${response.failureCount}`);
    
    // Log individual results for debugging
    if (response.responses) {
      response.responses.forEach((resp, idx) => {
        if (resp.success) {
          console.log(`[Firebase DEBUG] Token ${idx}: SUCCESS, messageId: ${resp.messageId}`);
        } else {
          console.log(`[Firebase DEBUG] Token ${idx}: FAILED, error: ${resp.error?.code} - ${resp.error?.message}`);
        }
      });
    }
  } catch (err) {
    console.error('[Firebase Push Error]', err.message);
  }
};

module.exports = {
  sendPushNotification
};
