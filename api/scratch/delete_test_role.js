const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const roleName = 'test';
  console.log(`Attempting to delete role: ${roleName}`);
  try {
    const result = await prisma.rolePermission.deleteMany({
      where: { role: roleName }
    });
    console.log(`Deleted ${result.count} role(s) named "${roleName}".`);
  } catch (error) {
    console.error('Error deleting role:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
