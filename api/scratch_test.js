const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    // Find a project first
    const project = await prisma.project.findFirst();
    if (!project) {
      console.log('No project found in database.');
      return;
    }
    console.log('Testing TaskList creation for project ID:', project.id);
    const newTaskList = await prisma.taskList.create({
      data: {
        name: 'Test Task List Programmatic',
        projectId: project.id
      }
    });
    console.log('Success:', newTaskList);
  } catch (error) {
    console.error('Error creating TaskList:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
