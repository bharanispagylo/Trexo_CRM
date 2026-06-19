const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany();
  const tasks = await prisma.task.findMany();
  
  users.forEach(user => {
    const userName = (user.fullName || user.firstName || '').trim().toLowerCase();
    const cleanName = userName.replace(/[^a-z0-9]/g, '');
    const cleanEmail = (user.email || '').toLowerCase().trim();
    const cleanEmailPrefix = cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '');
    const userId = user.id;

    let matchedCount = 0;
    tasks.forEach(t => {
      if (!t.assignees) return;
      const assigneesList = t.assignees.split(',').map(s => s.trim().toLowerCase());
      const isMatched = assigneesList.some(assignee => {
        if (userId && assignee === userId.toLowerCase().trim()) return true;
        const cleanAssignee = assignee.replace(/[^a-z0-9]/g, '');
        if (assignee === cleanEmail) return true;
        if (cleanAssignee === cleanEmailPrefix) return true;
        if (cleanName && (cleanAssignee.includes(cleanName) || cleanName.includes(cleanAssignee))) return true;
        return false;
      });
      if (isMatched) {
        matchedCount++;
      }
    });
    
    console.log(`User: ${user.fullName || 'No Name'} (${user.email}) | Matched Tasks: ${matchedCount}`);
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
