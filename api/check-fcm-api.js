/**
 * Quick check to see if the Firebase Admin SDK can 
 * authenticate and access the project at all.
 * Also validates the service account and project settings.
 */
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, 'firebase-service-account.json'));

console.log('=== Firebase Project Diagnostics ===');
console.log('Project ID:', serviceAccount.project_id);
console.log('Client Email:', serviceAccount.client_email);
console.log('Private Key ID:', serviceAccount.private_key_id);

const app = admin.initializeApp({ 
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

async function checkProject() {
  const messaging = admin.messaging();
  
  // Test with a deliberately INVALID token to see if we get
  // "registration-token-not-registered" (which means the API works)
  // vs "third-party-auth-error" (which means an auth problem)
  console.log('\n--- Test 1: Send to invalid token (expect "registration-token-not-registered") ---');
  try {
    await messaging.send({
      token: 'invalid-token-12345',
      notification: { title: 'Test', body: 'Test' }
    });
  } catch (err) {
    console.log('Error code:', err.code);
    console.log('Error message:', err.message);
    if (err.code === 'messaging/registration-token-not-registered' || 
        err.code === 'messaging/invalid-argument') {
      console.log('✅ FCM API is working! The API correctly rejected an invalid token.');
    } else if (err.code === 'messaging/third-party-auth-error') {
      console.log('❌ This should NOT happen with an invalid token.');
      console.log('   This suggests a deeper project configuration issue.');
    } else {
      console.log('⚠️ Unexpected error. FCM API may not be enabled.');
    }
  }

  // Test 2: Try to get access token to see if service account works
  console.log('\n--- Test 2: Access token generation ---');
  try {
    const accessToken = await admin.credential.cert(serviceAccount).getAccessToken();
    console.log('✅ Access token generated successfully');
    console.log('Token expiry:', new Date(accessToken.expires_in * 1000 + Date.now()).toISOString());
  } catch (err) {
    console.log('❌ Failed to generate access token:', err.message);
  }
}

checkProject().catch(console.error);
