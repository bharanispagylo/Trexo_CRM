const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const lists = await prisma.taskList.findMany({ include: { project: true } });
  console.log('TASK LISTS:', lists.map(l => ({ id: l.id, name: l.name, projectId: l.projectId, projectName: l.project ? l.project.name : null })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
