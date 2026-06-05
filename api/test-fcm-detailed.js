const admin = require('firebase-admin');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const serviceAccount = require(path.join(__dirname, 'firebase-service-account.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const messaging = admin.messaging();

async function run() {
  // Get latest token from DB
  const users = await prisma.user.findMany({
    where: { fcmToken: { not: null } },
    select: { fullName: true, fcmToken: true }
  });
  
  console.log('Users with FCM tokens:');
  users.forEach(u => console.log(`  ${u.fullName}: ${u.fcmToken?.substring(0, 30)}...`));
  
  if (users.length === 0) {
    console.log('No users with FCM tokens found!');
    return;
  }
  for (const user of users) {
    console.log(`\n--- Sending to ${user.fullName} ---`);
    try {
      const messageId = await messaging.send({
        token: user.fcmToken,
        notification: { title: 'Test from send() API', body: 'Single message test' }
      });
      console.log('SUCCESS! Message ID:', messageId);
    } catch (err) {
      console.error('send() FAILED:');
      console.error('  Code:', err.code);
      console.error('  Message:', err.message);
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
