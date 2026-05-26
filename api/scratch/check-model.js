const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('Prisma Leave model fields metadata:');
console.log(Object.keys(prisma.leave || {}));
if (prisma.leave && prisma.leave.fields) {
  console.log(prisma.leave.fields);
} else {
  console.log('No fields metadata helper found.');
}
prisma.$disconnect();
