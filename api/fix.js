const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  console.log('Updating all worklogs to isBilled = true...');
  await prisma.workLog.updateMany({
    data: { isBilled: true }
  });

  console.log('Recalculating actualHours and employeeHours for all tasks...');
  const tasks = await prisma.task.findMany();
  for (const task of tasks) {
    const logs = await prisma.workLog.findMany({ where: { taskId: task.id } });
    const billed = logs.filter(l => l.isBilled).reduce((s, l) => s + l.hoursWorked, 0);
    const actual = logs.filter(l => !l.isBilled).reduce((s, l) => s + l.hoursWorked, 0);
    
    await prisma.task.update({
      where: { id: task.id },
      data: { 
        actualHours: billed,
        employeeHours: actual
      }
    });
  }
  console.log('Done!');
}

fix().catch(console.error).finally(() => prisma.$disconnect());
