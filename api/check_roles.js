const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const perms = await prisma.rolePermission.findMany();
  console.log('--- ROLE PERMISSIONS ---');
  perms.forEach(p => {
    console.log(`Role: ${p.role}`);
    console.log(JSON.stringify(p.data, null, 2));
  });
}
run().catch(console.error).finally(()=>prisma.$disconnect());
