const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  console.log('Testing Prisma connection and query for TaskList...');
  
  // 1. Fetch task lists to check if schema query executes successfully
  const lists = await prisma.taskList.findMany({
    include: { project: true, tasks: true }
  });
  console.log(`Successfully fetched ${lists.length} task lists.`);
  console.log('Sample task lists:', JSON.stringify(lists.slice(0, 2), null, 2));

  // 2. Fetch projects to ensure project relations work
  const projects = await prisma.project.findMany();
  console.log(`Successfully fetched ${projects.length} projects.`);

  if (projects.length > 0) {
    // 3. Create a test task list with isFavorite
    console.log('Creating test task group...');
    const testList = await prisma.taskList.create({
      data: {
        name: 'Test Auto Verification Group',
        projectId: projects[0].id,
        isFavorite: true
      }
    });
    console.log('Created test task list:', testList);

    // 4. Update the favorite status
    console.log('Updating test task group favorite status...');
    const updatedList = await prisma.taskList.update({
      where: { id: testList.id },
      data: { isFavorite: false }
    });
    console.log('Updated test task list:', updatedList);

    // 5. Clean up/delete the test list
    console.log('Deleting test task group...');
    await prisma.taskList.delete({
      where: { id: testList.id }
    });
    console.log('Test task group cleaned up successfully.');
  } else {
    console.log('No projects found, skipping test list creation.');
  }
}

verify()
  .then(() => console.log('Verification finished successfully!'))
  .catch((err) => {
    console.error('Verification failed with error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
