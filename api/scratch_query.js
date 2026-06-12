const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        title: {
          in: [
            'Build the About Page',
            'Build contact page',
            'FRONTEND PAGE',
            'BACK BUTTON',
            'Implement Data Synchronization Pipelines'
          ]
        }
      },
      include: {
        projectRef: true,
        taskList: true
      }
    });

    console.log(`Found ${tasks.length} matching tasks:`);
    tasks.forEach(t => {
      console.log(`Task: "${t.title}" (ID: ${t.id}, Status: ${t.status})`);
      console.log(`  Project: ${t.projectRef ? `${t.projectRef.name} (ID: ${t.projectRef.id})` : 'None'}`);
      console.log(`  TaskList: ${t.taskList ? `${t.taskList.name} (ID: ${t.taskList.id})` : 'None'}`);
    });
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
