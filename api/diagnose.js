const dns = require('dns');
const net = require('net');
const { PrismaClient } = require('@prisma/client');

const hosts = [
  'aws-1-ap-south-1.pooler.supabase.com',
  'db.xdtvtcavumzblzsxbuyb.supabase.co'
];

const ports = [5432, 6543];

const passwords = ['HqL98s0QqVLKVHAe', 'DlaRoWDaVFjrwlpx'];

function checkDns(host) {
  return new Promise((resolve) => {
    dns.lookup(host, (err, address, family) => {
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, address, family });
      }
    });
  });
}

function checkPort(host, port, timeout = 4000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = { success: false, error: null };

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      status.success = true;
      socket.destroy();
    });

    socket.on('timeout', () => {
      status.error = 'Timeout';
      socket.destroy();
    });

    socket.on('error', (err) => {
      status.error = err.message;
    });

    socket.on('close', () => {
      resolve(status);
    });

    socket.connect(port, host);
  });
}

async function checkPrismaConnection(host, port, password) {
  const pgbouncer = port === 6543 ? '?pgbouncer=true&connection_limit=1' : '';
  // Since port 5432 or 6543 could need different URLs:
  const url = `postgresql://postgres.xdtvtcavumzblzsxbuyb:${password}@${host}:${port}/postgres${pgbouncer}`;
  
  const prismaInstance = new PrismaClient({
    datasources: {
      db: { url }
    }
  });

  try {
    await prismaInstance.$connect();
    await prismaInstance.$queryRaw`SELECT 1`;
    await prismaInstance.$disconnect();
    return { success: true, url };
  } catch (err) {
    try { await prismaInstance.$disconnect(); } catch (e) {}
    return { success: false, error: err.message };
  }
}

async function runDiagnostics() {
  console.log('=== STARTING SUPABASE DATABASE DIAGNOSTICS ===\n');

  console.log('--- 1. DNS Lookup Diagnostic ---');
  for (const host of hosts) {
    const res = await checkDns(host);
    if (res.success) {
      console.log(`✓ DNS: ${host} successfully resolved to ${res.address} (IPv${res.family})`);
    } else {
      console.log(`✗ DNS: ${host} FAILED to resolve: ${res.error}`);
    }
  }
  console.log('');

  console.log('--- 2. TCP Port Connectivity Diagnostic ---');
  for (const host of hosts) {
    for (const port of ports) {
      console.log(`Testing TCP connection to ${host}:${port}...`);
      const res = await checkPort(host, port);
      if (res.success) {
        console.log(`  ✓ REACHABLE: TCP port ${port} is OPEN on ${host}`);
      } else {
        console.log(`  ✗ UNREACHABLE: TCP port ${port} is CLOSED or BLOCKED on ${host} (${res.error})`);
      }
    }
  }
  console.log('');

  console.log('--- 3. Prisma Connection Diagnostic ---');
  for (const host of hosts) {
    for (const port of ports) {
      for (const password of passwords) {
        const maskedUrl = `postgresql://postgres.xdtvtcavumzblzsxbuyb:***@${host}:${port}/postgres${port === 6543 ? '?pgbouncer=true&connection_limit=1' : ''}`;
        console.log(`Testing connection: ${maskedUrl}...`);
        const res = await checkPrismaConnection(host, port, password);
        if (res.success) {
          console.log(`  ✓ CONNECTED: Successful connection using Prisma!`);
          console.log(`  💡 Copy and use this working DATABASE_URL in your .env:\n     ${res.url}\n`);
        } else {
          console.log(`  ✗ FAILED: ${res.error.replace(/\n/g, ' ')}\n`);
        }
      }
    }
  }
  console.log('\n=== DIAGNOSTICS COMPLETE ===');
}

runDiagnostics().catch(console.error);
