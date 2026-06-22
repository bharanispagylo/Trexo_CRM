const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany();
  console.log('USERS:', users.map(u => ({ id: u.id, fullName: u.fullName, email: u.email })));
  
  const tasks = await prisma.task.findMany();
  console.log('TOTAL TASKS:', tasks.length);
  
  const aneesh = users.find(u => u.email === 'Aneesh@gmail.com');
  console.log('ANEESH:', aneesh);
  
  const aneeshTasks = tasks.filter(t => {
    if (!t.assignees) return false;
    return t.assignees.toLowerCase().includes(aneesh.id.toLowerCase()) || 
           t.assignees.toLowerCase().includes('aneesh');
  });
  console.log('ANEESH TASKS COUNT:', aneeshTasks.length);
  console.log('ANEESH TASKS SAMPLE:', aneeshTasks.slice(0, 5).map(t => ({ id: t.id, title: t.title, status: t.status, assignees: t.assignees, taskListId: t.taskListId })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
