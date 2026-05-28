const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const tasks = await prisma.task.findMany();
  for (const task of tasks) {
    const logs = await prisma.workLog.findMany({ where: { taskId: task.id } });
    console.log(`Task: ${task.title}, actualHours: ${task.actualHours}, employeeHours: ${task.employeeHours}`);
    for (const log of logs) {
      console.log(`  Log ID: ${log.id}, isBilled: ${log.isBilled}, hours: ${log.hoursWorked}, type: ${typeof log.isBilled}`);
    }
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
