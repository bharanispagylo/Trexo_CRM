const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const task = await prisma.task.findFirst({ where: { title: 'api calling' }});
  console.log('DB actualHours:', task.actualHours, 'DB employeeHours:', task.employeeHours);
}
run().catch(console.error).finally(()=>prisma.$disconnect());
