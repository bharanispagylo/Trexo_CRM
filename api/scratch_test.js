const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const name = 'Mano_Sebastin';
    const nameWithSpaces = name.replace(/_/g, ' ');
    const nameParts = nameWithSpaces.split(' ').filter(Boolean);
    
    console.log('Name:', name);
    console.log('With spaces:', nameWithSpaces);
    console.log('Parts:', nameParts);

    const orConditions = [
      { id: name },
      { fullName: { contains: nameWithSpaces, mode: 'insensitive' } },
      { firstName: { contains: nameWithSpaces, mode: 'insensitive' } },
      { lastName: { contains: nameWithSpaces, mode: 'insensitive' } },
      { email: { contains: name, mode: 'insensitive' } }
    ];

    if (nameParts.length >= 2) {
      orConditions.push({
        AND: [
          { firstName: { contains: nameParts[0], mode: 'insensitive' } },
          { lastName: { contains: nameParts[nameParts.length - 1], mode: 'insensitive' } }
        ]
      });
    }

    const users = await prisma.user.findMany({
      where: { OR: orConditions }
    });

    console.log('\nFound users:', users.length);
    users.forEach(u => {
      console.log(`  - fullName: "${u.fullName}", firstName: "${u.firstName}", lastName: "${u.lastName}", email: "${u.email}"`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
