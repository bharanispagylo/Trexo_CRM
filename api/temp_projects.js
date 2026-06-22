const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const projects = await prisma.project.findMany();
  console.log('PROJECTS MEMBERS:', projects.map(p => ({ name: p.name, members: p.members })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
