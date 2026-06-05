# Trexo CRM - Firebase Push Notification Setup Guide

This guide details how to set up, configure, and activate Firebase Cloud Messaging (FCM) push notifications for both the backend API and the frontend UI in the Trexo CRM application.

---

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** and follow the prompts to create a new project (e.g., `Trexo-CRM`).
3. (Optional) Enable Google Analytics for the project if prompted.

---

## Step 2: Configure the Backend (Admin SDK)

The backend uses the `firebase-admin` SDK to trigger and send notifications when tasks are assigned, re-assigned, or when users are mentioned in comments.

### 1. Generate Private Key (Service Account JSON)
1. In the Firebase Console, click the gear icon (**⚙️**) next to **Project Overview** in the left sidebar and select **Project Settings**.
2. Navigate to the **Service accounts** tab.
3. Click the **Generate new private key** button at the bottom of the page.
4. A JSON file will download (e.g., `trexo-crm-firebase-adminsdk-xxxxx-xxxxxx.json`).

### 2. Add Credentials to backend
1. Rename the downloaded JSON file to exactly:
   ```
   firebase-service-account.json
   ```
2. Place this file in the backend `api/` directory:
   ```
   d:/Trexo_CRM/api/firebase-service-account.json
   ```

*Note: The backend self-detects this file on startup. If found, it will output `[Firebase] Push notifications initialized successfully` in the logs.*

---

## Step 3: Configure the Frontend (Client SDK)

The frontend uses the Firebase Web SDK to request permission from the user's browser, retrieve a registration token, and handle incoming messages.

### 1. Register a Web App
1. Go back to the **Project Settings** in the Firebase Console.
2. Under the **General** tab, scroll down to the **Your apps** section.
3. Click **Add app** (or select the **`</>`** Web icon).
4. Enter a nickname (e.g., `Trexo CRM Web`) and click **Register app**.
5. Copy the contents of the `firebaseConfig` object shown on the screen. It looks like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "xxxxxx.firebaseapp.com",
     projectId: "xxxxxx",
     storageBucket: "xxxxxx.firebasestorage.app",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:xxxxxxxxxxxx"
   };
   ```

### 2. Generate the VAPID Key (Web Push Certificate)
1. In the **Project Settings**, go to the **Cloud Messaging** tab.
2. Scroll down to the **Web configuration** section.
3. Under **Web Push certificates**, click **Generate key pair**.
4. Copy the long public key string generated (this is your VAPID key).

### 3. Add Frontend Environment Variables
Open or create the file `d:/Trexo_CRM/ui/.env` and add the config parameters copied from above:
```env
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=xxxxxx.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=xxxxxx
REACT_APP_FIREBASE_STORAGE_BUCKET=xxxxxx.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=1234567890
REACT_APP_FIREBASE_APP_ID=1:1234567890:web:xxxxxxxxxxxx
REACT_APP_FIREBASE_VAPID_KEY=your_generated_vapid_key
```

### 4. Update the Service Worker Config
Open the service worker file at `d:/Trexo_CRM/ui/public/firebase-messaging-sw.js` and update the `firebaseConfig` block (lines 7–14) with your exact configuration values:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "xxxxxx.firebaseapp.com",
  projectId: "xxxxxx",
  storageBucket: "xxxxxx.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:xxxxxxxxxxxx"
};
```

---

## Step 4: Run and Verify the Setup

1. Start both the backend and frontend servers using:
   ```bash
   npm run dev
   ```
2. Open the browser and log in to the CRM.
3. Your browser should prompt you: **"Show notifications? [Allow] [Block]"**. Click **Allow**.
4. Check your browser console. You should see logs like:
   * `FCM Token received: d1x...`
   * Check your backend terminal to confirm the token has updated: `Update FCM Token success...`
5. Test push notifications by:
   * Creating a task and assigning it to a user.
   * Mentioning a user in a comment on a task.
