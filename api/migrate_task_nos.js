const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find all tasks ordered by createdAt ASC
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${tasks.length} total tasks in the database.`);

  let updatedCount = 0;
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const targetNo = `T${i + 1}`;
    
    // We only update if it is not already set to T + digits or if it contains TSK-
    const currentNo = task.taskNo || '';
    const digits = currentNo.replace(/\D/g, '');
    const isSequentialFormat = currentNo.startsWith('T') && digits && !currentNo.startsWith('TSK-');

    if (!isSequentialFormat || currentNo !== targetNo) {
      await prisma.task.update({
        where: { id: task.id },
        data: { taskNo: targetNo }
      });
      updatedCount++;
    }
  }

  console.log(`Successfully migrated task numbers. Updated ${updatedCount} out of ${tasks.length} tasks.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
