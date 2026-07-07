const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const project = await prisma.project.findFirst();
    if (!project) {
      console.log("No project found to test with.");
      return;
    }
    console.log("Attempting to insert project query with invalid sentToId...");
    const query = await prisma.projectQuery.create({
      data: {
        queryId: "TEST-0001",
        title: "Test foreign key query",
        description: "Test description",
        sentToId: "Non-existent User or Free Text",
        projectId: project.id
      }
    });
    console.log("SUCCESS! Database allowed arbitrary text in sentToId:", query);
    // Cleanup
    await prisma.projectQuery.delete({ where: { id: query.id } });
  } catch (err) {
    console.log("FAILED! Foreign key constraint is enforced:", err.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
