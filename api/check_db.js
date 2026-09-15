const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const projects = await prisma.project.findMany({
    include: {
      taskLists: { include: { tasks: true } }
    }
  });

  console.log('=== PROJECTS ===');
  for (const p of projects) {
    console.log(`Project: ${p.name} (ID: ${p.id})`);
    console.log(`  TaskLists count: ${p.taskLists.length}`);
    for (const tl of p.taskLists) {
      console.log(`    TaskList: "${tl.name}" (ID: ${tl.id}), Tasks count: ${tl.tasks.length}`);
    }

    const unassignedTasks = await prisma.task.findMany({
      where: {
        projectId: p.id,
        OR: [
          { taskListId: null },
          { taskListId: '' }
        ]
      }
    });
    console.log(`  Unassigned tasks (taskListId null) count for project ${p.name}: ${unassignedTasks.length}`);
    if (unassignedTasks.length > 0) {
      console.log(`  Sample unassigned tasks:`, unassignedTasks.slice(0, 3).map(t => ({ id: t.id, taskNo: t.taskNo, title: t.title })));
    }
  }

  const allTaskLists = await prisma.taskList.findMany();
  console.log('=== ALL TASK LISTS ===');
  for (const tl of allTaskLists) {
    console.log(`TaskList: "${tl.name}" (ID: ${tl.id}), ProjectId: ${tl.projectId}`);
  }

  const orphanedTasks = await prisma.task.findMany({
    where: {
      projectId: null
    }
  });
  console.log('=== ORPHANED TASKS (projectId null) ===', orphanedTasks.length);
}

run().catch(console.error).finally(() => prisma.$disconnect());
