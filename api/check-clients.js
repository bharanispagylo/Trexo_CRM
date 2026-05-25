const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Connecting to database with URL:', process.env.DATABASE_URL ? 'Loaded' : 'Not Loaded');
    await prisma.$connect();
    
    console.log('Fetching all clients...');
    const clients = await prisma.client.findMany();
    console.log('Clients list:', clients.map(c => ({ id: c.id, name: c.name })));
    
    const emptyIdClients = clients.filter(c => c.id === '');
    if (emptyIdClients.length > 0) {
      console.log('Found clients with empty ID string!');
      // Let's delete them or update them
      const result = await prisma.client.deleteMany({
        where: { id: '' }
      });
      console.log('Deleted empty-ID clients:', result);
    } else {
      console.log('No clients with empty ID found.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
