import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || ""
};

const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY || "";

let messaging = null;

if (firebaseConfig.apiKey) {
  try {
    const app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
}

export const requestForToken = async (userId, api) => {
  console.log('FCM VAPID Key in use:', vapidKey);
  if (!messaging) {
    console.warn("Firebase Messaging is not initialized. Please configure REACT_APP_FIREBASE_... env variables.");
    return null;
  }
  
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      let tokenOptions = { vapidKey: vapidKey };
      
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          tokenOptions.serviceWorkerRegistration = registration;
        } catch (swErr) {
          console.warn('Service worker registration failed, falling back to default:', swErr);
        }
      }

      const currentToken = await getToken(messaging, tokenOptions);
      if (currentToken) {
        console.log('FCM Token received:', currentToken);
        // Send token to backend API
        await api.post('/users/update-fcm-token', {
          userId,
          fcmToken: currentToken
        });
        return currentToken;
      } else {
        console.log('No registration token available. Request permission to generate one.');
      }
    } else {
      console.log('Notification permission denied.');
    }
  } catch (err) {
    console.error('An error occurred while retrieving token:', err);
  }
  return null;
};

export const onMessageListener = (callback) => {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    callback(payload);
  });
};
