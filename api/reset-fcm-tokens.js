/**
 * This script clears all FCM tokens from the database.
 * After running this, users must re-login or refresh the browser
 * to generate new FCM tokens with the current VAPID key.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetTokens() {
  // Show current tokens
  const users = await prisma.user.findMany({
    where: { fcmToken: { not: null } },
    select: { id: true, fullName: true, fcmToken: true }
  });
  
  console.log(`Found ${users.length} users with FCM tokens:`);
  users.forEach(u => console.log(`  - ${u.fullName} (ID: ${u.id}): ${u.fcmToken?.substring(0, 40)}...`));
  
  // Clear all tokens
  const result = await prisma.user.updateMany({
    where: { fcmToken: { not: null } },
    data: { fcmToken: null }
  });
  
  console.log(`\nCleared FCM tokens for ${result.count} users.`);
  console.log('\nNext steps:');
  console.log('  1. Restart the UI dev server');
  console.log('  2. Clear browser cache and service workers:');
  console.log('     - Open Chrome DevTools > Application > Service Workers');
  console.log('     - Unregister ALL service workers');
  console.log('     - Clear storage: Application > Clear Storage > Clear site data');
  console.log('  3. Refresh the page and log in again');
  console.log('  4. New FCM tokens will be generated with the current VAPID key');
  console.log('  5. Run test-fcm-detailed.js again to test');
}

resetTokens().catch(console.error).finally(() => prisma.$disconnect());
