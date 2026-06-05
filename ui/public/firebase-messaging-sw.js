// Give the service worker access to Firebase Messaging.
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
const firebaseConfig = {
  apiKey: "AIzaSyBfIuqNTcrvupm6MjAoBp0Qa-8Egis0lOE",
  authDomain: "spagylo-crm.firebaseapp.com",
  projectId: "spagylo-crm",
  storageBucket: "spagylo-crm.firebasestorage.app",
  messagingSenderId: "300784222313",
  appId: "1:300784222313:web:21f7fdc26f08eae954e2f8"
};

try {
  if (typeof firebase !== 'undefined' && firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") {
    if (firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
    }

    const messaging = firebase.messaging();

    messaging.setBackgroundMessageHandler((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message ', payload);
      const notificationTitle = (payload.notification && payload.notification.title) || 'Trexo CRM Notification';
      const notificationOptions = {
        body: (payload.notification && payload.notification.body) || 'You have a new update.',
        icon: '/favicon.ico',
        data: payload.data
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  } else {
    console.warn('[firebase-messaging-sw.js] Firebase Config not yet configured. Background notifications are disabled.');
  }
} catch (err) {
  console.error('[firebase-messaging-sw.js] Exception during script evaluation:', err);
}
