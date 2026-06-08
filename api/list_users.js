const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const users = await prisma.user.findMany();
  console.log(JSON.stringify(users.map(u => ({ id: u.id, fullName: u.fullName, email: u.email, role: u.role, status: u.status })), null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());
