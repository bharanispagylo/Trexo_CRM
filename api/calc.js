const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const tasks = await prisma.task.findMany({
      where: { title: 'api calling' }
  });
  if(tasks.length === 0) return console.log('no task');
  const task = tasks[0];
  const allLogs = await prisma.workLog.findMany({ where: { taskId: task.id } });
  const billedHours = allLogs.filter(l => l.isBilled).reduce((sum, l) => sum + l.hoursWorked, 0);
  const employeeHours = allLogs.filter(l => !l.isBilled).reduce((sum, l) => sum + l.hoursWorked, 0);
  console.log('Task actual DB:', task.actualHours, 'employee DB:', task.employeeHours);
  console.log('Billed calculated:', billedHours, 'Employee calculated:', employeeHours);

  await prisma.task.update({
    where: { id: task.id },
    data: { actualHours: billedHours, employeeHours: employeeHours }
  });
  console.log('Fixed calculation');
}
run().catch(console.error).finally(()=>prisma.$disconnect());
