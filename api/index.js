require('dotenv').config();

const fs = require('fs');
const path = require('path');

process.on('uncaughtException', (err) => {
  const logMessage = `[${new Date().toISOString()}] Uncaught Exception: ${err.message}\n${err.stack}\n\n`;
  fs.appendFileSync(path.join(__dirname, 'crash.log'), logMessage);
  console.error(logMessage);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  const logMessage = `[${new Date().toISOString()}] Unhandled Rejection: ${reason}\n\n`;
  fs.appendFileSync(path.join(__dirname, 'crash.log'), logMessage);
  console.error(logMessage);
});

if (!process.env.VERCEL) {
  try {
    console.log('[Startup] Generating Prisma Client...');
    require('child_process').execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('[Startup] Prisma Client successfully regenerated!');
  } catch (err) {
    console.error('[Startup] Prisma generate warning:', err.message);
  }

  // NOTE: db push (port 5432 direct) is skipped - handled by self-healing block below via pooler (port 6543)
  // To manually sync schema, use: Supabase Dashboard → SQL Editor
}

const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { sendNotificationEmail, sendOtpEmail } = require('./emailSender');
const { hashPassword, verifyPassword } = require('./cryptoUtils');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'spagylo-browser-ext-secret-2024';
const JWT_EXPIRES_IN = '30d';

function signBrowserToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

async function verifyBrowserToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.status !== 'Active') {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    req.browserUser = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const app = express();

// ── Prisma singleton (prevents connection pool exhaustion in Vercel serverless) ──
if (!global._prismaClient) {
  // Append connection_limit=1 to avoid exceeding Supabase pooler limit on serverless
  const dbUrl = (process.env.DATABASE_URL || '');
  const dbUrlWithLimit = dbUrl.includes('connection_limit')
    ? dbUrl
    : dbUrl + (dbUrl.includes('?') ? '&' : '?') + 'connection_limit=1';
  global._prismaClient = new PrismaClient({
    datasources: { db: { url: dbUrlWithLimit } },
    log: process.env.VERCEL ? [] : ['warn', 'error'],
  });
}
const prisma = global._prismaClient;

const PORT = process.env.PORT || 5000;


// In-memory store for Forgot Password OTP codes
const otpStore = new Map();


// Self-healing database column verification — skip on Vercel (runs on every cold start, wastes connections)
if (!process.env.VERCEL) {
  prisma.$connect()
    .then(async () => {
    console.log('[Self-Healing] Database connected, verifying columns...');

    // All columns that may be missing from the tasks table due to schema drift
    const taskColumnFixes = [
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_no TEXT;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS delivered_date TIMESTAMP;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "assignedDate" TIMESTAMP;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type TEXT;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tag TEXT;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "isBillable" BOOLEAN DEFAULT false;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS billable_amount FLOAT DEFAULT 0;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours FLOAT DEFAULT 0;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "approvedHours" FLOAT DEFAULT 0;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "actualHours" FLOAT DEFAULT 0;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachments TEXT;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "taskListId" TEXT;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id TEXT;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by TEXT;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS creator_id TEXT;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurring_template_id TEXT;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_frequency TEXT;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_detail TEXT;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS next_occurrence TIMESTAMP;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_occurrence TIMESTAMP;',
    ];

    for (const sql of taskColumnFixes) {
      try {
        await prisma.$executeRawUnsafe(sql);
        const colName = sql.match(/ADD COLUMN IF NOT EXISTS "?(\w+)"?/i)?.[1];
        console.log(`[Self-Healing] Column ${colName} verified/added successfully.`);
      } catch (e) {
        console.warn(`[Self-Healing] Warning for: ${sql.substring(0, 60)}...`, e.message);
      }
    }

    // All columns that may be missing from the task_lists table due to schema drift
    const taskListColumnFixes = [
      'ALTER TABLE task_lists ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;',
      'ALTER TABLE task_lists ADD COLUMN IF NOT EXISTS favorited_by TEXT;',
    ];

    for (const sql of taskListColumnFixes) {
      try {
        await prisma.$executeRawUnsafe(sql);
        const colName = sql.match(/ADD COLUMN IF NOT EXISTS "?(\w+)"?/i)?.[1];
        console.log(`[Self-Healing] TaskList column ${colName} verified/added successfully.`);
      } catch (e) {
        console.warn(`[Self-Healing] Warning for: ${sql.substring(0, 60)}...`, e.message);
      }
    }

    // All columns that may be missing from the attendance table due to schema drift
    try {
      const tableExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM pg_tables 
          WHERE schemaname = 'public' 
          AND tablename = 'attendance'
        );
      `;

      if (tableExists?.[0]?.exists) {
        const attendanceColumnFixes = [
          'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS photo_url TEXT;',
          'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS location TEXT;',
        ];

        for (const sql of attendanceColumnFixes) {
          try {
            await prisma.$executeRawUnsafe(sql);
            const colName = sql.match(/ADD COLUMN IF NOT EXISTS "?(\w+)"?/i)?.[1];
            console.log(`[Self-Healing] Attendance Column ${colName} verified/added successfully.`);
          } catch (e) {
            console.warn(`[Self-Healing] Warning for: ${sql.substring(0, 60)}...`, e.message);
          }
        }
      } else {
        console.log('[Self-Healing] Attendance table does not exist, skipping column verification.');
      }
    } catch (e) {
      console.warn('[Self-Healing] Failed to check if attendance table exists:', e.message);
    }

    // Ensure teams table has role and designation columns
    const teamsColumnFixes = [
      'ALTER TABLE teams ADD COLUMN IF NOT EXISTS role TEXT DEFAULT \'Employee\';',
      'ALTER TABLE teams ADD COLUMN IF NOT EXISTS designation TEXT;',
    ];
    for (const sql of teamsColumnFixes) {
      try {
        await prisma.$executeRawUnsafe(sql);
        const colName = sql.match(/ADD COLUMN IF NOT EXISTS "?(\w+)"?/i)?.[1];
        console.log(`[Self-Healing] Teams column ${colName} verified/added successfully.`);
      } catch (e) {
        console.warn(`[Self-Healing] Warning for: ${sql.substring(0, 60)}...`, e.message);
      }
    }

    // Ensure users table has firstName, lastName, and fullName columns
    const usersColumnFixes = [
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS "firstName" TEXT;',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastName" TEXT;',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS "fullName" TEXT;',
    ];
    for (const sql of usersColumnFixes) {
      try {
        await prisma.$executeRawUnsafe(sql);
        const colName = sql.match(/ADD COLUMN IF NOT EXISTS "?(\w+)"?/i)?.[1];
        console.log(`[Self-Healing] Users column ${colName} verified/added successfully.`);
      } catch (e) {
        console.warn(`[Self-Healing] Warning for: ${sql.substring(0, 60)}...`, e.message);
      }
    }

    try {
      await prisma.task.deleteMany({ where: { clientId: '' } });
      await prisma.project.deleteMany({ where: { clientId: '' } });
      await prisma.estimation.deleteMany({ where: { clientId: '' } });
      await prisma.client.deleteMany({ where: { id: '' } });
      console.log('[Self-Healing] Cleared all database records with empty client ID.');
    } catch (e) {
      console.warn('[Self-Healing] Database clean empty client ID warning:', e.message);
    }
    })
    .catch(console.error);
}



// Helper to create notifications for multiple users
const createNotification = async (userIds, title, message) => {
  if (!userIds || !prisma.notification) return;
  const usersOrNames = (typeof userIds === 'string' ? userIds.split(',') : userIds).map(u => u.trim()).filter(Boolean);
  
  if (usersOrNames.length === 0) return;

  try {
    const validUserIds = [];
    const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
    
    for (const item of usersOrNames) {
      if (isUUID(item)) {
        validUserIds.push(item);
      } else {
        const nameWithSpaces = item.replace(/_/g, ' ');
        const nameParts = nameWithSpaces.split(' ').filter(Boolean);
        const orConditions = [
          { fullName: { contains: nameWithSpaces, mode: 'insensitive' } },
          { firstName: { contains: nameWithSpaces, mode: 'insensitive' } },
          { lastName: { contains: nameWithSpaces, mode: 'insensitive' } },
          { email: { contains: item, mode: 'insensitive' } }
        ];
        // If name has multiple parts (e.g. "Mano Sebastin"), also match firstName+lastName
        if (nameParts.length >= 2) {
          orConditions.push({
            AND: [
              { firstName: { contains: nameParts[0], mode: 'insensitive' } },
              { lastName: { contains: nameParts[nameParts.length - 1], mode: 'insensitive' } }
            ]
          });
        }
        const foundUser = await prisma.user.findFirst({
          where: { OR: orConditions }
        });
        if (foundUser) validUserIds.push(foundUser.id);
      }
    }

    // De-duplicate validUserIds
    const uniqueUserIds = [...new Set(validUserIds)];

    for (const uid of uniqueUserIds) {
      await prisma.notification.create({
        data: { userId: uid, title, message }
      });
    }

  } catch (err) {
    console.error('[Notification Error]', err.message);
  }
};

const notifyAdmins = async (title, message) => {
  try {
    const admins = await prisma.user.findMany({ where: { role: 'Admin' } });
    const adminNames = admins.map(a => a.fullName || `${a.firstName} ${a.lastName}`.trim());
    await createNotification(adminNames, title, message);
  } catch (err) {}
};

const filterBugRecipients = async (recipients, assignees, creatorId) => {
  if (!assignees || !recipients) return recipients || [];
  const rawAssignees = (typeof assignees === 'string' ? assignees.split(',') : assignees).map(a => a.trim()).filter(Boolean);
  if (rawAssignees.length === 0) return recipients;

  try {
    const assigneeUsers = await prisma.user.findMany({
      where: {
        OR: rawAssignees.map(a => ({
          OR: [
            { id: a },
            { fullName: { equals: a, mode: 'insensitive' } },
            { email: { equals: a, mode: 'insensitive' } }
          ]
        }))
      },
      select: { id: true }
    });
    const assigneeIds = new Set(assigneeUsers.map(u => u.id));

    return recipients.filter(id => {
      if (!id) return false;
      if (assigneeIds.has(id) && id !== creatorId) {
        return false;
      }
      return true;
    });
  } catch (e) {
    return recipients;
  }
};

const notifyEmailsByNames = async (userIds, subject, message, type) => {
  if (!userIds) return;
  const names = (typeof userIds === 'string' ? userIds.split(',') : userIds).map(u => u.trim()).filter(Boolean);
  if (names.length === 0) return;
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: names.map(name => {
          const nameWithSpaces = name.replace(/_/g, ' ');
          const nameParts = nameWithSpaces.split(' ').filter(Boolean);
          const orConditions = [
            { id: name },
            { fullName: { contains: nameWithSpaces, mode: 'insensitive' } },
            { firstName: { contains: nameWithSpaces, mode: 'insensitive' } },
            { lastName: { contains: nameWithSpaces, mode: 'insensitive' } },
            { email: { contains: name, mode: 'insensitive' } }
          ];
          // If name has multiple parts (e.g. "Mano Sebastin"), also match firstName+lastName
          if (nameParts.length >= 2) {
            orConditions.push({
              AND: [
                { firstName: { contains: nameParts[0], mode: 'insensitive' } },
                { lastName: { contains: nameParts[nameParts.length - 1], mode: 'insensitive' } }
              ]
            });
          }
          return { OR: orConditions };
        })
      }
    });

    const frontendUrl = process.env.FRONTEND_URL || 'https://crm.spagylo.com';

    for (const u of users) {
      if (u.email) {
        // Determine the correct route based on notification type, with deep-link to specific item
        let route = '/';
        if (type === 'task' || type === 'comment') {
          route = message.taskId ? `/tasks/${message.taskId}` : '/tasks';
        } else if (type === 'project') {
          route = message.projectName ? `/projects/${message.projectName.replace(/ /g, '-')}` : '/projects';
        }

        const userContext = {
          ...message,
          buttonLink: `${frontendUrl}${route}`
        };
        await sendNotificationEmail(u.email, subject, userContext, type);
      }
    }
  } catch (err) {
    console.error('[Email Notification Error]', err.message);
  }
};

const getTaskDisplayId = (task) => {
  if (!task) return '';
  const no = task.taskNo || (task.id ? `TSK-${task.id.substring(0, 6).toUpperCase()}` : '');
  const digits = no.replace(/\D/g, '');
  if (!digits) return no;
  if (task.parentId) {
    return `S${digits}`;
  }
  let prefix = 'T';
  const type = (task.taskType || '').toLowerCase();
  if (type === 'bug') {
    prefix = 'B';
  } else if (type === 'calls/meetings') {
    prefix = 'C';
  } else if (no && /^[A-Za-z]/.test(no) && !no.startsWith('TSK-')) {
    prefix = no.charAt(0).toUpperCase();
  }
  return `${prefix}${digits}`;
};

const getTaskDetailsForEmail = async (task) => {
  let taskListName = task.status || 'To Do';
  let projectName = task.projectName || 'General';

  if (task.taskListId) {
    try {
      const tl = await prisma.taskList.findUnique({
        where: { id: task.taskListId }
      });
      if (tl) taskListName = tl.name;
    } catch (e) {
      console.error('Error fetching task list name:', e.message);
    }
  }

  if (!task.projectName && task.projectId) {
    try {
      const proj = await prisma.project.findUnique({
        where: { id: task.projectId }
      });
      if (proj) projectName = proj.name;
    } catch (e) {
      console.error('Error fetching project name:', e.message);
    }
  }

  return { taskListName, projectName };
};

const sanitizeTaskData = (taskData) => {
  if (!prisma.task || !prisma.task.fields) return taskData;
  const sanitized = {};
  Object.keys(taskData).forEach(key => {
    if (key in prisma.task.fields) {
      let val = taskData[key];
      if ((key === 'clientId' || key === 'projectId' || key === 'taskListId' || key === 'parentId') && val === '') {
        val = null;
      }
      sanitized[key] = val;
    }
  });
  return sanitized;
};

const sanitizeLeaveData = (leaveData) => {
  const allowedKeys = ['name', 'type', 'period', 'days', 'dates', 'reason', 'status', 'attachments'];
  const sanitized = {};
  Object.keys(leaveData).forEach(key => {
    if (allowedKeys.includes(key)) {
      sanitized[key] = leaveData[key];
    }
  });
  return sanitized;
};

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Clean up empty string ID on POST requests so that default generator works
app.use((req, res, next) => {
  if (req.method === 'POST' && req.body && req.body.id === '') {
    delete req.body.id;
  }
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  if (req.url.startsWith('/api/api/')) {
    req.url = req.url.replace(/^\/api\/api\//, '/api/');
  }
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Root route to check API status
app.get('/', (req, res) => {
  res.json({ message: 'Trexo CRM API is running successfully!' });
});

// Chrome DevTools well-known integration endpoint to prevent console 404 errors
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.json({});
});

// Database diagnostics and auto-repair route
app.get('/api/test-db', async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const fs = require('fs');
  const path = require('path');
  
  const passwords = ['HqL98s0QqVLKVHAe', 'DlaRoWDaVFjrwlpx'];
  const hosts = [
    'aws-1-ap-south-1.pooler.supabase.com',
    'db.xdtvtcavumzblzsxbuyb.supabase.co'
  ];
  const ports = [5432, 6543];
  
  let results = [];
  let workingUrl = null;
  
  for (const host of hosts) {
    for (const port of ports) {
      for (const pwd of passwords) {
        const pgbouncer = port === 6543 ? '?pgbouncer=true&connection_limit=1' : '';
        const url = `postgresql://postgres.xdtvtcavumzblzsxbuyb:${pwd}@${host}:${port}/postgres${pgbouncer}`;
        
        results.push(`Testing URL: postgresql://postgres.xdtvtcavumzblzsxbuyb:***@${host}:${port}/postgres${pgbouncer}`);
        
        const tempPrisma = new PrismaClient({
          datasources: {
            db: { url }
          }
        });
        
        try {
          await tempPrisma.$connect();
          await tempPrisma.$queryRaw`SELECT 1`;
          results.push(`  -> SUCCESS! Connected to database successfully.`);
          workingUrl = url;
          await tempPrisma.$disconnect();
          break;
        } catch (err) {
          results.push(`  -> FAILED: ${err.message}`);
          try { await tempPrisma.$disconnect(); } catch (e) {}
        }
      }
      if (workingUrl) break;
    }
    if (workingUrl) break;
  }
  
  if (workingUrl) {
    results.push(`\n[Auto-Fix] Found working connection URL! Updating .env file...`);
    try {
      const envPath = path.join(__dirname, '.env');
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      envContent = envContent.replace(/DATABASE_URL\s*=\s*["'].*?["']/g, `DATABASE_URL="${workingUrl}"`);
      envContent = envContent.replace(/DATABASE_URL\s*=\s*[^\s]+/g, `DATABASE_URL="${workingUrl}"`);
      
      fs.writeFileSync(envPath, envContent);
      results.push(`[Auto-Fix] .env file successfully updated! Please restart the backend server.`);
    } catch (e) {
      results.push(`[Auto-Fix] Failed to update .env: ${e.message}`);
    }
  } else {
    results.push(`\n[Auto-Fix] No working connection combination found. Please verify if your Supabase database is paused or if there is a network firewall blocking outbound connections to ports 5432/6543.`);
  }
  
  res.send(`<pre>${results.join('\n')}</pre>`);
});

// --- ROUTES ---

// 0. Users (Administration)
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    console.error('GET /api/users error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch users', 
      details: error.message,
      code: error.code
    });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { fullName, firstName, lastName, workLogs, ...rest } = req.body;
    
    // Determine names
    let finalFullName = fullName || `${firstName || ''} ${lastName || ''}`.trim();
    let finalFirstName = firstName || finalFullName.split(' ')[0] || '';
    let finalLastName = lastName || finalFullName.split(' ').slice(1).join(' ') || '';

    // Sanitize unique fields: convert empty strings to null to avoid unique constraint violations
    const sanitizedRest = { ...rest };
    if (sanitizedRest.empId === '' || sanitizedRest.empId === undefined) sanitizedRest.empId = null;
    if (sanitizedRest.email === '' || sanitizedRest.email === undefined) sanitizedRest.email = null;

    if (sanitizedRest.password) {
      sanitizedRest.password = await hashPassword(sanitizedRest.password);
    }

    const user = await prisma.user.create({
      data: {
        firstName: finalFirstName,
        lastName: finalLastName,
        fullName: finalFullName,
        ...sanitizedRest
      }
    });
    res.json(user);
  } catch (error) {
    console.error('POST /api/users error:', error);
    // Return the specific error message to the frontend for debugging
    res.status(500).json({ 
      error: error.message,
      code: error.code,
      meta: error.meta 
    });
  }
});



app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  console.log(`Login attempt for email: ${email}`);
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    const isMatch = user ? await verifyPassword(password, user.password) : false;
    if (!user || !isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'Your account is pending admin approval or has been deactivated.' });
    }

    res.json(user);
  } catch (error) {
    console.error('POST /api/login error:', error);
    res.status(500).json({ 
      error: 'Login failed', 
      details: error.message,
      code: error.code
    });
  }
});

app.post('/api/forgot-password/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(404).json({ error: 'User with this email does not exist.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in otpStore (valid for 10 minutes)
    otpStore.set(normalizedEmail, {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      verified: false
    });

    // Send email
    const emailSent = await sendOtpEmail(user.email, otp);
    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send OTP email. Please try again.' });
    }

    console.log(`[OTP] Generated OTP ${otp} for email ${normalizedEmail}`);
    res.json({ message: 'OTP verification code has been sent to your email.' });
  } catch (error) {
    console.error('POST /api/forgot-password/request-otp error:', error);
    res.status(500).json({ error: 'Failed to request OTP', details: error.message });
  }
});

app.post('/api/forgot-password/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

    const normalizedEmail = email.trim().toLowerCase();
    const entry = otpStore.get(normalizedEmail);

    if (!entry) {
      return res.status(400).json({ error: 'No OTP requested for this email.' });
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    if (entry.otp !== otp.trim()) {
      return res.status(400).json({ error: 'Invalid OTP code. Please try again.' });
    }

    // Mark as verified and set a fresh expiration (e.g. 5 minutes to complete the reset)
    otpStore.set(normalizedEmail, {
      ...entry,
      verified: true,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    res.json({ message: 'OTP verified successfully. You can now reset your password.' });
  } catch (error) {
    console.error('POST /api/forgot-password/verify-otp error:', error);
    res.status(500).json({ error: 'Failed to verify OTP', details: error.message });
  }
});

app.post('/api/forgot-password/reset-password', async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;
    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Email, new password, and confirm password are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const entry = otpStore.get(normalizedEmail);

    if (!entry || !entry.verified) {
      return res.status(400).json({ error: 'OTP verification is required before resetting password.' });
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({ error: 'Session expired. Please start the process again.' });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: { password: hashedPassword }
    });

    // Clear from OTP store
    otpStore.delete(normalizedEmail);

    console.log(`Password reset successfully via OTP for: ${normalizedEmail}`);
    res.json({ message: 'Password has been successfully reset.' });
  } catch (error) {
    console.error('POST /api/forgot-password/reset-password error:', error);
    res.status(500).json({ error: 'Failed to reset password', details: error.message });
  }
});



app.put('/api/users/:id', async (req, res) => {
  try {
    const { fullName, firstName, lastName, workLogs, ...rest } = req.body;
    
    let updateData = { ...rest };
    
    if (fullName || firstName || lastName) {
      let finalFullName = fullName || `${firstName || ''} ${lastName || ''}`.trim();
      updateData.fullName = finalFullName;
      updateData.firstName = firstName || finalFullName.split(' ')[0] || '';
      updateData.lastName = lastName || finalFullName.split(' ').slice(1).join(' ') || '';
    }

    // Sanitize unique fields: convert empty strings to null to avoid unique constraint violations
    if (updateData.empId === '') updateData.empId = null;
    if (updateData.email === '') updateData.email = null;

    if (updateData.password && updateData.password.trim() !== '') {
      updateData.password = await hashPassword(updateData.password);
    } else {
      delete updateData.password;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.delete('/api/users/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    // 1. Delete comments authored by this user
    await prisma.comment.deleteMany({
      where: { authorId: userId }
    });
    // 2. Clear sentToId on queries assigned to this user
    await prisma.projectQuery.updateMany({
      where: { sentToId: userId },
      data: { sentToId: null }
    });
    // 3. Delete the user
    await prisma.user.delete({
      where: { id: userId }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/users/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all tasks assigned to a specific user
app.get('/api/users/:id/tasks', async (req, res) => {
  try {
    const userId = req.params.id;
    const allTasks = await prisma.task.findMany();
    const userTasks = allTasks.filter(t => {
      if (!t.assignees) return false;
      return t.assignees.split(',').map(a => a.trim()).includes(userId);
    });
    res.json(userTasks);
  } catch (error) {
    console.error('GET /api/users/:id/tasks error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk reassign all tasks from one user to another
app.post('/api/users/:id/reassign-tasks', async (req, res) => {
  try {
    const oldUserId = req.params.id;
    const { newUserId } = req.body;
    if (!newUserId) return res.status(400).json({ error: 'newUserId is required' });

    const allTasks = await prisma.task.findMany();
    const userTasks = allTasks.filter(t => {
      if (!t.assignees) return false;
      return t.assignees.split(',').map(a => a.trim()).includes(oldUserId);
    });

    let updatedCount = 0;
    for (const task of userTasks) {
      const assigneeList = task.assignees.split(',').map(a => a.trim());
      const updated = assigneeList.map(a => a === oldUserId ? newUserId : a);
      await prisma.task.update({
        where: { id: task.id },
        data: { assignees: updated.join(',') }
      });
      updatedCount++;
    }

    res.json({ success: true, updatedCount });
  } catch (error) {
    console.error('POST /api/users/:id/reassign-tasks error:', error);
    res.status(500).json({ error: error.message });
  }
});


// 1. Employees
app.get('/api/employees', async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/employees', async (req, res) => {
  try {
    const { dept, ...employeeData } = req.body;
    const employee = await prisma.employee.create({
      data: employeeData
    });
    notifyAdmins(`New Employee Added`, `${employee.name} has been added to the system.`);
    createNotification([employee.name], `Welcome!`, `Your employee profile has been created.`);
    res.json(employee);
  } catch (error) {
    console.error('POST /api/employees error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: req.body
    });
    createNotification([employee.name], `Profile Updated`, `Your employee profile was updated.`);
    res.json(employee);
  } catch (error) {
    console.error('PUT /api/employees error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    await prisma.employee.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Salaries
app.get('/api/salaries', async (req, res) => {
  try {
    const salaries = await prisma.salary.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(salaries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/salaries', async (req, res) => {
  try {
    const salary = await prisma.salary.create({
      data: req.body
    });
    res.json(salary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Leaves
app.get('/api/leaves', async (req, res) => {
  try {
    const leaves = await prisma.leave.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(leaves);
  } catch (error) {
    console.error('GET /api/leaves error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/leaves', async (req, res) => {
  try {
    console.log('POST /api/leaves body:', req.body);
    const sanitized = sanitizeLeaveData(req.body);

    const leave = await prisma.leave.create({
      data: sanitized
    });
    notifyAdmins(`New Leave Request`, `${leave.employeeName || leave.name} requested leave.`);
    res.json(leave);
  } catch (error) {
    console.error('POST /api/leaves error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/leaves/:id', async (req, res) => {
  try {
    const sanitized = sanitizeLeaveData(req.body);
    const leave = await prisma.leave.update({
      where: { id: req.params.id },
      data: sanitized
    });
    createNotification([leave.employeeName], `Leave Updated`, `Your leave request status is now: ${leave.status}`);
    res.json(leave);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/leaves/:id', async (req, res) => {
  try {
    await prisma.leave.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Attendance
app.get('/api/attendance', async (req, res) => {
  try {
    const attendance = await prisma.attendance.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/attendance', async (req, res) => {
  try {
    const attendance = await prisma.attendance.create({
      data: {
        ...req.body,
        date: new Date(req.body.date)
      }
    });
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/attendance/:id', async (req, res) => {
  try {
    // Optional: parse date string if it exists in the update payload
    let updateData = { ...req.body };
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }
    const attendance = await prisma.attendance.update({
      where: { id: req.params.id },
      data: updateData
    });
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Teams CRUD
app.get('/api/teams', async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(teams);
  } catch (error) {
    console.error('GET /api/teams error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/teams', async (req, res) => {
  try {
    const { name, role, designation } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Member name is required' });
    }
    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        role: role || 'Employee',
        designation: designation || null,
      }
    });
    res.json(team);
  } catch (error) {
    console.error('POST /api/teams error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/teams/:id', async (req, res) => {
  try {
    const { name, role, designation } = req.body;
    const team = await prisma.team.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(role !== undefined && { role }),
        ...(designation !== undefined && { designation }),
      }
    });
    res.json(team);
  } catch (error) {
    console.error('PUT /api/teams error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/teams/:id', async (req, res) => {
  try {
    await prisma.team.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/teams error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Projects
app.get('/api/projects', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const projects = await prisma.project.findMany({
      include: {
        taskLists: {
          include: { tasks: true }
        },
        queries: true,
        attachments: true
      },
      orderBy: { createdAt: 'desc' }
    });
    // Map sentToId → sentTo so frontend stays compatible, and map isFavorite for taskLists
    const mapped = projects.map(p => ({
      ...p,
      queries: (p.queries || []).map(q => ({ ...q, sentTo: q.sentToId })),
      taskLists: (p.taskLists || []).map(list => {
        const favoritedByArr = list.favoritedBy ? list.favoritedBy.split(',').map(id => id.trim()).filter(Boolean) : [];
        return {
          ...list,
          isFavorite: userId ? favoritedByArr.includes(userId) : false
        };
      })
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { estimatedHours, actualHours, billableHours, taskLists, queries, attachments, clientRef, tasks, estimations, ...rest } = req.body;
    const data = { ...rest };
    if (estimatedHours !== undefined) data.estimatedHours = parseFloat(estimatedHours) || 0;
    if (actualHours !== undefined) data.actualHours = parseFloat(actualHours) || 0;
    if (billableHours !== undefined) data.billableHours = parseFloat(billableHours) || 0;
    if (data.clientId === '') data.clientId = null;

    const project = await prisma.project.create({ data });
    if (project.members) {
      const userIdFromHeader = req.headers['x-user-id'];
      let creatorName = 'Admin';
      if (userIdFromHeader) {
        const userObj = await prisma.user.findUnique({
          where: { id: userIdFromHeader }
        });
        if (userObj) {
          creatorName = userObj.fullName || `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim() || userObj.email;
        }
      }

      createNotification(project.members, `New Project: ${project.name}`, `You have been added to the project team.`);
      notifyEmailsByNames(project.members, `New Project: ${project.name}`, {
        author: creatorName,
        action: 'added you to',
        itemTitle: project.name,
        boardName: 'Projects Board',
        projectName: project.name,
        buttonText: 'View Project'
      }, 'project');
    }
    notifyAdmins(`Project Created`, `Project ${project.name} was created.`);
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const { estimatedHours, actualHours, billableHours, taskLists, queries, attachments, clientRef, tasks, estimations, ...rest } = req.body;
    const data = { ...rest };
    if (estimatedHours !== undefined) data.estimatedHours = parseFloat(estimatedHours) || 0;
    if (actualHours !== undefined) data.actualHours = parseFloat(actualHours) || 0;
    if (billableHours !== undefined) data.billableHours = parseFloat(billableHours) || 0;
    if (data.clientId === '') data.clientId = null;

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data
    });
    if (project.members) {
      createNotification(project.members, `Project Updated`, `Project ${project.name} has been updated.`);
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const taskListCount = await prisma.taskList.count({ where: { projectId: req.params.id } });
    if (taskListCount > 0) {
      return res.status(400).json({ error: 'Cannot delete project because it has associated task groups.' });
    }
    await prisma.project.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// 5a. Task Lists
app.get('/api/task-lists', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const taskLists = await prisma.taskList.findMany({
      include: { tasks: true, project: true },
      orderBy: { createdAt: 'desc' }
    });
    const mapped = taskLists.map(list => {
      const favoritedByArr = list.favoritedBy ? list.favoritedBy.split(',').map(id => id.trim()).filter(Boolean) : [];
      return {
        ...list,
        isFavorite: userId ? favoritedByArr.includes(userId) : false
      };
    });
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/task-lists', async (req, res) => {
  try {
    const { tasks, project, ...rest } = req.body;
    const taskList = await prisma.taskList.create({
      data: rest
    });
    res.json(taskList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/task-lists/:id', async (req, res) => {
  try {
    // Delete all tasks associated with this task list
    await prisma.task.deleteMany({
      where: { taskListId: req.params.id }
    });
    // Now delete the task list itself
    await prisma.taskList.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/task-lists/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { tasks, project, isFavorite, ...rest } = req.body;
    let updatedData = { ...rest };
    
    if (isFavorite !== undefined && userId) {
      // Fetch current task list to get favoritedBy
      const currentList = await prisma.taskList.findUnique({
        where: { id: req.params.id }
      });
      if (currentList) {
        let favoritedByArr = currentList.favoritedBy ? currentList.favoritedBy.split(',').map(id => id.trim()).filter(Boolean) : [];
        if (isFavorite) {
          if (!favoritedByArr.includes(userId)) {
            favoritedByArr.push(userId);
          }
        } else {
          favoritedByArr = favoritedByArr.filter(id => id !== userId);
        }
        updatedData.favoritedBy = favoritedByArr.join(',');
      }
    } else if (isFavorite !== undefined) {
      updatedData.isFavorite = isFavorite;
    }
    
    const taskList = await prisma.taskList.update({
      where: { id: req.params.id },
      data: updatedData
    });
    
    // Return with the user's specific favorite status
    const favoritedByArr = taskList.favoritedBy ? taskList.favoritedBy.split(',').map(id => id.trim()).filter(Boolean) : [];
    res.json({
      ...taskList,
      isFavorite: userId ? favoritedByArr.includes(userId) : (taskList.isFavorite || false)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Teams
app.get('/api/teams', async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/teams', async (req, res) => {
  try {
    const team = await prisma.team.create({
      data: req.body
    });
    res.json(team);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
      include: { projectRef: { select: { name: true } } }
    });
    const result = tasks.map(({ projectRef, ...t }) => ({
      ...t,
      projectName: projectRef?.name || ''
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tasks/:idOrDisplayId', async (req, res) => {
  try {
    const param = req.params.idOrDisplayId;
    let task = null;

    // Check if it is a UUID
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(param);

    if (isUuid) {
      task = await prisma.task.findUnique({
        where: { id: param },
        include: { projectRef: { select: { name: true } } }
      });
    } else {
      // It's a display ID, e.g. T359369 or S12345
      const digits = param.substring(1);
      const tasks = await prisma.task.findMany({
        where: {
          taskNo: {
            contains: digits
          }
        },
        include: { projectRef: { select: { name: true } } }
      });

      task = tasks.find(t => getTaskDisplayId(t).toLowerCase() === param.toLowerCase());
    }

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    let recurrenceFrequency = task.recurrenceFrequency;
    let recurrenceDetail = task.recurrenceDetail;
    let taskTypeOverride = task.taskType;
    if (task.recurringTemplateId) {
      const template = await prisma.task.findUnique({
        where: { id: task.recurringTemplateId },
        select: { recurrenceFrequency: true, recurrenceDetail: true, taskType: true }
      });
      if (template) {
        recurrenceFrequency = template.recurrenceFrequency;
        recurrenceDetail = template.recurrenceDetail;
        taskTypeOverride = 'Recurring Task';
      }
    }

    const result = {
      ...task,
      projectName: task.projectRef?.name || '',
      recurrenceFrequency,
      recurrenceDetail,
      taskType: taskTypeOverride
    };
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    console.log('POST /api/tasks body:', req.body);
    let { id, comments, createdAt, createdBy: createdByName, ...taskData } = req.body;
    
    // Resolve creator ID and creator name from headers
    const userIdFromHeader = req.headers['x-user-id'];
    let finalCreatorId = userIdFromHeader || null;
    let finalCreatedBy = createdByName || null;

    if (userIdFromHeader) {
      const userObj = await prisma.user.findUnique({
        where: { id: userIdFromHeader }
      });
      if (userObj) {
        finalCreatedBy = userObj.fullName || `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim() || userObj.email;
      }
    }

    taskData.creatorId = finalCreatorId;
    taskData.createdBy = finalCreatedBy;

    
    // Sanitize and convert dates
    ['dueDate', 'assignedDate', 'deliveredDate', 'nextOccurrence', 'lastOccurrence'].forEach(key => {
      if (taskData[key]) {
        const d = new Date(taskData[key]);
        if (!isNaN(d.getTime())) {
          taskData[key] = d;
        } else {
          delete taskData[key];
        }
      } else {
        delete taskData[key];
      }
    });

    if (taskData.taskType === 'Recurring Task' && taskData.recurrenceFrequency) {
      taskData.nextOccurrence = getInitialRecurrenceDate(taskData.recurrenceFrequency, taskData.recurrenceDetail, taskData.dueDate || new Date());
    }

    // Sanitize numbers
    ['estimatedHours', 'approvedHours', 'actualHours', 'employeeHours', 'billableAmount'].forEach(key => {
      if (taskData[key] !== undefined) {
        if (taskData[key] === '' || taskData[key] === null || taskData[key] === undefined) {
          taskData[key] = null;
        } else {
          const val = parseFloat(taskData[key]);
          taskData[key] = isNaN(val) ? null : val;
        }
      }
    });
    
    // Universal model field sanitizer to protect Prisma against drift
    taskData = sanitizeTaskData(taskData);

    // Auto-generate sequential task number if not provided or placeholder
    if (!taskData.taskNo || taskData.taskNo.startsWith('TSK-')) {
      const allTasks = await prisma.task.findMany({
        select: { taskNo: true }
      });
      let maxNo = 0;
      let prefix = 'T';
      const type = (taskData.taskType || '').toLowerCase();
      if (type === 'bug') {
        prefix = 'B';
      } else if (type === 'calls/meetings') {
        prefix = 'C';
      }
      for (const t of allTasks) {
        if (t.taskNo) {
          const digits = parseInt(t.taskNo.replace(/\D/g, ''), 10);
          if (!isNaN(digits) && digits > maxNo && digits < 50000) {
            maxNo = digits;
          }
        }
      }
      taskData.taskNo = `${prefix}${maxNo + 1}`;
    }

    const task = await prisma.task.create({
      data: taskData
    });
    const isBugTask = (task.taskType && (task.taskType.trim().toLowerCase() === 'bug' || task.taskType.trim().toLowerCase() === 'bug report')) || (task.taskNo && task.taskNo.startsWith('B'));

    // Helper: get a flat list of assigned user IDs from a comma-separated string
    const getAssigneeIds = (assigneesStr) => (assigneesStr || '').split(',').map(s => s.trim()).filter(Boolean);
    // Helper: check if creator self-assigned (creator ID is in the assignees list)
    const creatorId = task.creatorId || finalCreatorId || null;
    const assigneeIds = getAssigneeIds(task.assignees);
    const isSelfAssigned = creatorId && assigneeIds.includes(creatorId);

    if (isBugTask) {
      // For Bug tasks, notify assignees (excluding creator if self-assigned or creator)
      // Other users, including admins, will not receive notifications unless assigned.
      try {
        const creatorIdentifiers = [creatorId, finalCreatorId, task.createdBy].filter(Boolean).map(s => s.toLowerCase());
        const bugRecipients = assigneeIds.filter(id => !creatorIdentifiers.includes(id.toLowerCase()));

        if (bugRecipients.length > 0) {
          createNotification(bugRecipients, `New Bug Report: ${task.title}`, `A new bug report has been created: ${task.title}`);
          const { taskListName, projectName } = await getTaskDetailsForEmail(task);
          notifyEmailsByNames(bugRecipients, `New Bug Report: ${task.title}`, {
            author: finalCreatedBy || createdByName || task.createdBy || 'User',
            action: 'created bug report',
            itemTitle: task.title,
            boardName: taskListName,
            projectName: projectName,
            buttonText: 'View Item',
            taskId: getTaskDisplayId(task)
          }, 'task');
        }
      } catch (notifErr) {
        console.error('Error sending bug report notifications:', notifErr);
      }
    } else if (task.assignees) {
      // For all other task types (regular, Calls/Meetings, Recurring Task):
      // Exclude creator from notification if they self-assigned
      const notifyAssigneeIds = isSelfAssigned
        ? assigneeIds.filter(id => id !== creatorId)
        : assigneeIds;
      const notifyAssignees = notifyAssigneeIds.join(',');

      if (notifyAssignees) {
        createNotification(notifyAssignees, `New Task Assigned: ${task.title}`, `You have been assigned to a new task.`);
        const { taskListName, projectName } = await getTaskDetailsForEmail(task);
        notifyEmailsByNames(notifyAssignees, `New Task Assigned: ${task.title}`, {
          author: finalCreatedBy || createdByName || 'Admin',
          action: 'assigned you to',
          itemTitle: task.title,
          boardName: taskListName,
          projectName: projectName,
          buttonText: 'View Item',
          taskId: getTaskDisplayId(task)
        }, 'task');
      }
    }
    res.json(task);
  } catch (error) {
    console.error('POST /api/tasks error:', error);
    res.status(500).json({ error: error.message });
  }
});

const isUpdaterAssignee = async (task, updaterId) => {
  if (!updaterId) return false;
  if (!task.assignees) return false;

  const assigneesList = task.assignees.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
  if (assigneesList.includes(updaterId.toLowerCase())) {
    return true;
  }

  // Look up updater user details
  const updater = await prisma.user.findUnique({ where: { id: updaterId } });
  if (!updater) return false;

  const updaterEmail = (updater.email || '').toLowerCase();
  const updaterFullName = (updater.fullName || '').toLowerCase();
  const updaterFirstName = (updater.firstName || '').toLowerCase();
  const updaterLastName = (updater.lastName || '').toLowerCase();

  for (const assignee of assigneesList) {
    if (assignee === updaterEmail) return true;
    if (assignee === updaterFullName) return true;
    if (assignee === updaterFirstName) return true;
    if (assignee === updaterLastName) return true;
  }

  return false;
};

app.put('/api/tasks/:id', async (req, res) => {
  try {
    console.log('PUT /api/tasks body:', req.body);
    let { id, createdAt, comments, updatedBy: updatedByName, ...taskData } = req.body;
    
    const userIdFromHeader = req.headers['x-user-id'];
    let finalUpdaterName = updatedByName || null;
    if (userIdFromHeader) {
      const userObj = await prisma.user.findUnique({
        where: { id: userIdFromHeader }
      });
      if (userObj) {
        finalUpdaterName = userObj.fullName || `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim() || userObj.email;
      }
    }
    
    // Fetch existing task to compare assignees
    const existingTask = await prisma.task.findUnique({
      where: { id: req.params.id }
    });
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Sanitize and convert dates
    ['dueDate', 'assignedDate', 'deliveredDate', 'nextOccurrence', 'lastOccurrence'].forEach(key => {
      if (taskData[key] !== undefined) {
        if (taskData[key]) {
          const d = new Date(taskData[key]);
          if (!isNaN(d.getTime())) {
            taskData[key] = d;
          } else {
            taskData[key] = null;
          }
        } else {
          taskData[key] = null;
        }
      }
    });

    // Recurrence frequency and detail delegation logic
    if (taskData.recurrenceFrequency !== undefined || taskData.recurrenceDetail !== undefined) {
      const frequencyVal = taskData.recurrenceFrequency !== undefined ? taskData.recurrenceFrequency : existingTask.recurrenceFrequency;
      const detailVal = taskData.recurrenceDetail !== undefined ? taskData.recurrenceDetail : existingTask.recurrenceDetail;

      if (existingTask.recurringTemplateId) {
        // Save on the template instead of the instance
        const updateData = {};
        if (taskData.recurrenceFrequency !== undefined) {
          updateData.recurrenceFrequency = taskData.recurrenceFrequency;
        }
        if (taskData.recurrenceDetail !== undefined) {
          updateData.recurrenceDetail = taskData.recurrenceDetail;
        }

        // Get existing template to see if we need to update nextOccurrence
        const templateTask = await prisma.task.findUnique({ where: { id: existingTask.recurringTemplateId } });
        if (templateTask) {
          const finalFreq = updateData.recurrenceFrequency !== undefined ? updateData.recurrenceFrequency : templateTask.recurrenceFrequency;
          const finalDetail = updateData.recurrenceDetail !== undefined ? updateData.recurrenceDetail : templateTask.recurrenceDetail;
          
          updateData.nextOccurrence = getInitialRecurrenceDate(finalFreq, finalDetail, templateTask.dueDate || new Date());
        }

        await prisma.task.update({
          where: { id: existingTask.recurringTemplateId },
          data: updateData
        });

        // Remove from current payload so it's not saved at the instance level
        delete taskData.recurrenceFrequency;
        delete taskData.recurrenceDetail;
      } else {
        // This is the template task. Save it directly.
        taskData.nextOccurrence = getInitialRecurrenceDate(frequencyVal, detailVal, taskData.dueDate || existingTask.dueDate || new Date());
      }
    }

    if (taskData.taskType === 'Recurring Task' && !existingTask.nextOccurrence) {
      taskData.nextOccurrence = getInitialRecurrenceDate(
        taskData.recurrenceFrequency || existingTask.recurrenceFrequency,
        taskData.recurrenceDetail || existingTask.recurrenceDetail,
        taskData.dueDate || existingTask.dueDate || new Date()
      );
    }

    // Sanitize numbers
    ['estimatedHours', 'approvedHours', 'actualHours', 'employeeHours', 'billableAmount'].forEach(key => {
      if (taskData[key] !== undefined) {
        if (taskData[key] === '' || taskData[key] === null || taskData[key] === undefined) {
          taskData[key] = null;
        } else {
          const val = parseFloat(taskData[key]);
          taskData[key] = isNaN(val) ? null : val;
        }
      }
    });
    
    // Prevent UI from overwriting auto-calculated log totals
    delete taskData.actualHours;
    delete taskData.employeeHours;

    // Universal model field sanitizer to protect Prisma against drift
    taskData = sanitizeTaskData(taskData);

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: taskData
    });

    // Check if status changed to "Delivered" and the updater is one of the assignees
    const newStatus = taskData.status;
    const oldStatus = existingTask.status;
    if (newStatus !== undefined && newStatus === 'Delivered' && oldStatus !== 'Delivered') {
      try {
        const updaterId = req.headers['x-user-id'];
        if (await isUpdaterAssignee(existingTask, updaterId)) {
          let creatorEmail = null;
          let creatorName = 'Creator';

          // First try using creatorId
          if (existingTask.creatorId) {
            const creatorUser = await prisma.user.findUnique({ where: { id: existingTask.creatorId } });
            if (creatorUser && creatorUser.email) {
              creatorEmail = creatorUser.email;
              creatorName = creatorUser.fullName || `${creatorUser.firstName || ''} ${creatorUser.lastName || ''}`.trim() || creatorUser.email;
            }
          }

          // Next try using createdBy
          if (!creatorEmail && existingTask.createdBy) {
            const nameOrEmail = existingTask.createdBy.trim();
            if (nameOrEmail.includes('@')) {
              creatorEmail = nameOrEmail;
            } else {
              const creatorUser = await prisma.user.findFirst({
                where: {
                  OR: [
                    { email: { equals: nameOrEmail, mode: 'insensitive' } },
                    { fullName: { equals: nameOrEmail, mode: 'insensitive' } },
                    { firstName: { equals: nameOrEmail, mode: 'insensitive' } },
                    { lastName: { equals: nameOrEmail, mode: 'insensitive' } }
                  ]
                }
              });
              if (creatorUser && creatorUser.email) {
                creatorEmail = creatorUser.email;
                creatorName = creatorUser.fullName || `${creatorUser.firstName || ''} ${creatorUser.lastName || ''}`.trim() || creatorUser.email;
              }
            }
          }

          if (creatorEmail) {
            const frontendUrl = process.env.FRONTEND_URL || 'https://crm.spagylo.com';
            const route = task.id ? `/tasks/${task.id}` : '/tasks';
            
            // Resolve updater's name
            let updaterName = updatedByName;
            if (!updaterName && updaterId) {
              const updaterUser = await prisma.user.findUnique({ where: { id: updaterId } });
              if (updaterUser) {
                updaterName = updaterUser.fullName || `${updaterUser.firstName || ''} ${updaterUser.lastName || ''}`.trim() || updaterUser.email;
              }
            }
            if (!updaterName) {
              updaterName = 'An assignee';
            }

            const { taskListName, projectName } = await getTaskDetailsForEmail(task);

            const userContext = {
              author: updaterName,
              action: 'changed status to Delivered for',
              itemTitle: task.title,
              boardName: taskListName,
              projectName: projectName,
              buttonText: 'View Item',
              taskId: getTaskDisplayId(task),
              buttonLink: `${frontendUrl}${route}`
            };

            await sendNotificationEmail(creatorEmail, `Task Delivered: ${task.title}`, userContext, 'task');
          }
        }
      } catch (err) {
        console.error('[Delivered Notification Error]', err.message);
      }
    }

    
    // Determine newly added assignees to avoid spamming existing assignees
    const getAssigneesList = (assigneesStr) => {
      if (!assigneesStr) return [];
      return assigneesStr.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
    };

    let addedAssigneesStr = '';
    if (taskData.assignees !== undefined) {
      const oldAssigneesNormalized = getAssigneesList(existingTask.assignees);
      const newAssigneesRaw = (taskData.assignees || '').split(',').map(a => a.trim()).filter(Boolean);
      const addedAssigneesRaw = newAssigneesRaw.filter(a => !oldAssigneesNormalized.includes(a.toLowerCase()));
      addedAssigneesStr = addedAssigneesRaw.join(', ');
    }

    // Notify newly assigned users about task assignment
    if (addedAssigneesStr) {
      const isReassignment = existingTask.assignees && existingTask.assignees.trim().length > 0;
      const notificationTitle = isReassignment ? `Task Reassigned: ${task.title}` : `Task Assigned: ${task.title}`;
      const notificationMsg = isReassignment ? `You have been reassigned to this task.` : `You have been assigned to this task.`;

      createNotification(addedAssigneesStr, notificationTitle, notificationMsg);
      const { taskListName, projectName } = await getTaskDetailsForEmail(task);
      notifyEmailsByNames(addedAssigneesStr, notificationTitle, {
        author: finalUpdaterName || updatedByName || 'Admin',
        action: isReassignment ? 'reassigned you to' : 'assigned you to',
        itemTitle: task.title,
        boardName: taskListName,
        projectName: projectName,
        buttonText: 'View Item',
        taskId: getTaskDisplayId(task)
      }, 'task');
    }

    res.json(task);
  } catch (error) {
    console.error('PUT /api/tasks error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const existing = await prisma.task.findUnique({
      where: { id: req.params.id }
    });
    if (!existing) {
      return res.json({ success: true });
    }
    await prisma.task.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Comments
app.get('/api/tasks/:id/comments', async (req, res) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { taskId: req.params.id },
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });
    const mapped = comments.map(c => ({
      ...c,
      author: c.user?.fullName || c.user?.firstName || 'Anonymous'
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── TASK WORK LOGS ──────────────────────────────────────────────────────────
app.get('/api/tasks/:id/worklogs', async (req, res) => {
  try {
    const logs = await prisma.workLog.findMany({
      where: { taskId: req.params.id },
      include: { user: true },
      orderBy: { logDate: 'desc' }
    });
    res.json(logs);
  } catch (error) {
    console.error('GET worklogs error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks/:id/worklogs', async (req, res) => {
  try {
    const log = await prisma.workLog.create({
      data: {
        taskId: req.params.id,
        userId: req.body.userId,
        logDate: new Date(req.body.logDate),
        hoursWorked: parseFloat(req.body.hoursWorked),
        description: req.body.description,
        isBilled: req.body.isBilled || false
      }
    });

    const allLogs = await prisma.workLog.findMany({ where: { taskId: req.params.id } });
    const billedHours = allLogs.filter(l => l.isBilled).reduce((sum, l) => sum + l.hoursWorked, 0);
    const employeeHours = allLogs.filter(l => !l.isBilled).reduce((sum, l) => sum + l.hoursWorked, 0);
    await prisma.task.update({
      where: { id: req.params.id },
      data: { 
        actualHours: billedHours,
        employeeHours: employeeHours
      }
    });

    res.json(log);
  } catch (error) {
    console.error('POST worklogs error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/worklogs/:logId', async (req, res) => {
  try {
    const { logDate, hoursWorked, description, isBilled } = req.body;
    const log = await prisma.workLog.update({
      where: { id: req.params.logId },
      data: {
        logDate: new Date(logDate),
        hoursWorked: parseFloat(hoursWorked),
        description,
        isBilled: isBilled || false
      }
    });

    const allLogs = await prisma.workLog.findMany({ where: { taskId: log.taskId } });
    const billedHours = allLogs.filter(l => l.isBilled).reduce((sum, l) => sum + l.hoursWorked, 0);
    const employeeHours = allLogs.filter(l => !l.isBilled).reduce((sum, l) => sum + l.hoursWorked, 0);
    await prisma.task.update({
      where: { id: log.taskId },
      data: { 
        actualHours: billedHours,
        employeeHours: employeeHours
      }
    });

    res.json(log);
  } catch (error) {
    console.error('PUT worklogs error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/worklogs', async (req, res) => {
  try {
    const { startDate, endDate, userId, includeCalls } = req.query;
    const where = {};
    if (startDate || endDate) {
      where.logDate = {};
      if (startDate) where.logDate.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.logDate.lte = end;
      }
    }
    if (userId && userId !== 'all') where.userId = userId;
    where.isBilled = false;
    // Exclude calls/meetings tasks unless explicitly requested
    if (includeCalls !== 'true') {
      where.task = { taskType: { not: 'calls/meetings' } };
    }
    const logs = await prisma.workLog.findMany({
      where,
      include: { user: true, task: { select: { id: true, title: true, status: true, taskType: true, estimatedHours: true, approvedHours: true, actualHours: true } } },
      orderBy: { logDate: 'desc' }
    });
    res.json(logs);
  } catch (error) {
    console.error('GET /api/worklogs error:', error);
    res.status(500).json({ error: error.message });
  }
});


app.delete('/api/worklogs/:logId', async (req, res) => {
  try {
    const log = await prisma.workLog.findUnique({ where: { id: req.params.logId } });
    if (!log) return res.status(404).json({ error: 'Not found' });
    
    await prisma.workLog.delete({ where: { id: req.params.logId } });
    
    const allLogs = await prisma.workLog.findMany({ where: { taskId: log.taskId } });
    const billedHours = allLogs.filter(l => l.isBilled).reduce((sum, l) => sum + l.hoursWorked, 0);
    const employeeHours = allLogs.filter(l => !l.isBilled).reduce((sum, l) => sum + l.hoursWorked, 0);
    await prisma.task.update({
      where: { id: log.taskId },
      data: { 
        actualHours: billedHours,
        employeeHours: employeeHours
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks/:id/comments', async (req, res) => {
  try {
    const authorName = req.body.author || 'Anonymous';
    let authorId = req.body.authorId;

    if (authorId) {
      // Verify authorId exists in the database
      const userExists = await prisma.user.findUnique({
        where: { id: authorId }
      });
      if (!userExists) {
        authorId = null;
      }
    }

    if (!authorId) {
      // Find the author's user ID since Prisma requires it
      const userRecord = await prisma.user.findFirst({
        where: {
          OR: [
            { fullName: authorName },
            { firstName: authorName },
            { lastName: authorName },
            { email: authorName }
          ]
        }
      });
      authorId = userRecord?.id;
    }

    if (!authorId) {
       const fallbackUser = await prisma.user.findFirst();
       authorId = fallbackUser?.id;
    }

    const comment = await prisma.comment.create({
      data: {
        taskId: req.params.id,
        text: req.body.text,
        authorId: authorId,
        parentId: req.body.parentId || null
      },
      include: { user: true }
    });

    const commentAuthorName = comment.user?.fullName || comment.user?.firstName || authorName;

    // Notify assignees about the new comment
    try {
      const task = await prisma.task.findUnique({ where: { id: req.params.id } });
      if (task && task.assignees) {
        // Exclude the commenter from receiving their own notification (compare by UUID, name, or email)
        const assignees = task.assignees
          .split(',')
          .map(a => a.trim())
          .filter(a => {
            if (!a) return false;
            // Compare as UUID/ID
            if (comment.authorId && a.toLowerCase() === comment.authorId.toLowerCase()) return false;
            if (comment.user && comment.user.id && a.toLowerCase() === comment.user.id.toLowerCase()) return false;
            // Compare as name/email
            const aLower = a.toLowerCase();
            if (commentAuthorName && aLower === commentAuthorName.toLowerCase()) return false;
            if (comment.user) {
              const firstLower = (comment.user.firstName || '').toLowerCase();
              const lastLower = (comment.user.lastName || '').toLowerCase();
              const fullLower = (comment.user.fullName || '').toLowerCase();
              const emailLower = (comment.user.email || '').toLowerCase();
              if (firstLower && aLower === firstLower) return false;
              if (lastLower && aLower === lastLower) return false;
              if (fullLower && aLower === fullLower) return false;
              if (emailLower && aLower === emailLower) return false;
            }
            return true;
          });

        if (assignees.length > 0) {
          const previewText = comment.text ? comment.text.substring(0, 60) : '(attachment)';
          createNotification(assignees, `New Comment on ${task.title}`, `${commentAuthorName} commented: "${previewText}..."`);

          const { taskListName, projectName } = await getTaskDetailsForEmail(task);

          // Email assignees about the comment
          notifyEmailsByNames(assignees, `New Comment on: ${task.title}`, {
            author: commentAuthorName,
            action: 'commented on',
            itemTitle: task.title,
            boardName: taskListName,
            projectName: projectName,
            commentText: comment.text || '(attachment)',
            buttonText: 'View Task',
            taskId: getTaskDisplayId(task)
          }, 'comment');
        }
      }
      
      // Notify mentioned users
      const mentions = (comment.text || '').match(/@([a-zA-Z0-9_]+)/g);
      if (mentions) {
        const mentionedNames = mentions.map(m => m.substring(1));
        createNotification(mentionedNames, `You were mentioned in ${task ? task.title : 'a task'}`, `${commentAuthorName} mentioned you: "${comment.text.substring(0, 30)}..."`);
        
        let taskListName = 'Tasks Board';
        let projectName = 'General';
        if (task) {
          const details = await getTaskDetailsForEmail(task);
          taskListName = details.taskListName;
          projectName = details.projectName;
        }

        notifyEmailsByNames(mentionedNames, `You were mentioned in ${task ? task.title : 'a task'}`, {
          author: commentAuthorName,
          action: 'mentioned you in an update on',
          itemTitle: task ? task.title : 'a task',
          boardName: taskListName,
          projectName: projectName,
          commentText: comment.text,
          buttonText: 'Reply on Spagylo CRM',
          taskId: getTaskDisplayId(task)
        }, 'comment');
      }
    } catch (e) {
      console.error('Failed to send comment notification', e);
    }

    res.json({
      ...comment,
      author: commentAuthorName
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id/comments/:commentId/react', async (req, res) => {
  try {
    const { emoji, user } = req.body;
    const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
    let reactions = comment.reactions || {};
    if (typeof reactions === 'string') reactions = JSON.parse(reactions);
    
    if (!reactions[emoji]) reactions[emoji] = [];
    const idx = reactions[emoji].indexOf(user);
    if (idx > -1) {
      reactions[emoji].splice(idx, 1);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji].push(user);
    }

    const updated = await prisma.comment.update({
      where: { id: req.params.commentId },
      data: { reactions }
    });
    res.json(updated);
  } catch (error) {
    console.error('React error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/comments/:id', async (req, res) => {
  try {
    const comment = await prisma.comment.update({
      where: { id: req.params.id },
      data: {
        text: req.body.text
      },
      include: { user: true }
    });
    res.json({
      ...comment,
      author: comment.user?.fullName || comment.user?.firstName || 'Anonymous'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/comments/:id', async (req, res) => {
  try {
    await prisma.comment.deleteMany({
      where: { parentId: req.params.id }
    });
    await prisma.comment.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// 9. Project Queries
app.post('/api/project-queries', async (req, res) => {
  try {
    const { title, description, sentTo, status, solved, priority, projectId } = req.body;

    // Auto-generate queryId like QRY-0001
    const count = await prisma.projectQuery.count({ where: { projectId } });
    const queryId = `QRY-${String(count + 1).padStart(4, '0')}`;

    const query = await prisma.projectQuery.create({
      data: {
        queryId,
        title,
        description,
        sentToId: sentTo || null,
        status: status || 'Open',
        solved: solved === undefined ? false : Boolean(solved),
        priority: priority || 'Medium',
        projectId
      }
    });
    if (query.sentToId) {
      createNotification([query.sentToId], `New Query Assigned`, `You have a new query: ${query.title}`);
    }
    res.json({ ...query, sentTo: query.sentToId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/project-queries/:id', async (req, res) => {
  try {
    const { title, description, sentTo, status, solved, priority } = req.body;
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (sentTo !== undefined) updateData.sentToId = sentTo || null;
    if (status !== undefined) updateData.status = status;
    if (solved !== undefined) updateData.solved = Boolean(solved);
    if (priority !== undefined) updateData.priority = priority;

    const query = await prisma.projectQuery.update({
      where: { id: req.params.id },
      data: updateData
    });
    if (query.sentToId) {
      createNotification([query.sentToId], `Query Updated`, `Query ${query.title} was updated.`);
    }
    res.json({ ...query, sentTo: query.sentToId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/project-queries/:id', async (req, res) => {
  try {
    await prisma.projectQuery.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9a. Clients
app.get('/api/clients', async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const { projects, tasks, estimations, parentAgency, agencyClients, ...rest } = req.body;
    if (rest.parentAgencyId === '') rest.parentAgencyId = null;
    const client = await prisma.client.create({
      data: rest
    });
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const { projects, tasks, estimations, parentAgency, agencyClients, ...rest } = req.body;
    if (rest.parentAgencyId === '') rest.parentAgencyId = null;
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: rest
    });
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    const projectsCount = await prisma.project.count({ where: { clientId: req.params.id } });
    if (projectsCount > 0) {
      return res.status(400).json({ error: 'Cannot delete client because they have associated projects.' });
    }
    await prisma.client.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9b. Estimations
app.get('/api/estimations', async (req, res) => {
  try {
    const estimations = await prisma.estimation.findMany({
      include: { clientRef: true, projectRef: true, taskRef: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(estimations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/estimations', async (req, res) => {
  try {
    const count = await prisma.estimation.count();
    const estimationNo = `EST-${String(count + 1).padStart(4, '0')}`;
    
    // Clean up input fields to match prisma
    const { id, createdAt, updatedAt, projectRef, clientRef, taskRef, taskId, clientId, projectId, estimatedHours, ...rest } = req.body;
    
    const estimation = await prisma.estimation.create({
      data: {
        ...rest,
        estimationNo,
        estimatedHours: parseFloat(estimatedHours) || 0,
        clientId: clientId || null,
        projectId: projectId || null
      }
    });
    res.json(estimation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/estimations/:id', async (req, res) => {
  try {
    const { id, createdAt, updatedAt, projectRef, clientRef, taskRef, taskId, clientId, projectId, estimatedHours, ...rest } = req.body;
    
    const estimation = await prisma.estimation.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        estimatedHours: estimatedHours !== undefined ? parseFloat(estimatedHours) || 0 : undefined,
        clientId: clientId !== undefined ? (clientId || null) : undefined,
        projectId: projectId !== undefined ? (projectId || null) : undefined
      }
    });
    res.json(estimation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/estimations/:id', async (req, res) => {
  try {
    await prisma.estimation.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/estimations/:id/convert', async (req, res) => {
  try {
    const estimation = await prisma.estimation.findUnique({
      where: { id: req.params.id },
      include: { projectRef: true }
    });
    
    if (!estimation) return res.status(404).json({ error: 'Estimation not found' });
    if (estimation.status === 'Converted') return res.status(400).json({ error: 'Already converted' });

    const { projectId, assignees, assignedDate, dueDate, priority, taskListId, taskType } = req.body;

    let finalProjectId = projectId || estimation.projectId;
    let finalProjectName = estimation.projectRef ? estimation.projectRef.name : null;

    if (projectId && projectId !== estimation.projectId) {
      const proj = await prisma.project.findUnique({ where: { id: projectId } });
      if (proj) {
        finalProjectName = proj.name;
      }
    }

    // Create the task based on estimation
    const task = await prisma.task.create({
      data: {
        title: estimation.taskName,
        description: estimation.description,
        projectId: finalProjectId,
        clientId: estimation.clientId,
        estimatedHours: estimation.estimatedHours,
        status: 'To Do',
        priority: priority || 'Medium',
        taskType: taskType || 'Feature',
        assignees: assignees || null,
        assignedDate: assignedDate ? new Date(assignedDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        taskListId: taskListId || null,
      }
    });

    // Update estimation
    const updatedEst = await prisma.estimation.update({
      where: { id: estimation.id },
      data: { status: 'Converted', taskId: task.id }
    });

    res.json({ task, estimation: updatedEst });
  } catch (error) {
    console.error('Convert estimation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 10. Reports
const syncReportsTable = async () => {
  try {
    const tasks = await prisma.task.findMany({
      where: { status: 'Delivered' },
      include: {
        clientRef: true,
        projectRef: {
          include: { clientRef: true }
        },
      }
    });

    const reportsToInsert = tasks.map(task => {
      // Resolve clientId: prefer task's own clientId, fall back to project's clientId
      const resolvedClientId = task.clientId || (task.projectRef ? task.projectRef.clientId : null);

      // Resolve company name: prefer task's own clientRef, fall back to project's clientRef
      const resolvedClient = task.clientRef || (task.projectRef ? task.projectRef.clientRef : null);
      const resolvedCompanyName = resolvedClient ? (resolvedClient.company || resolvedClient.name) : null;

      // Resolve project name
      const resolvedProjectName = task.projectName || (task.projectRef ? task.projectRef.name : null);

      return {
        id: task.id,
        taskNo: task.taskNo,
        title: task.title,
        companyName: resolvedCompanyName,
        projectName: resolvedProjectName,
        projectId: task.projectId,
        clientId: resolvedClientId,
        assignees: task.assignees,
        billableHours: task.approvedHours || 0.0,
        alreadyBilled: task.actualHours || 0.0,
        deliveredDate: task.deliveredDate || task.updatedAt,
      };
    });

    await prisma.$transaction([
      prisma.report.deleteMany(),
      prisma.report.createMany({ data: reportsToInsert })
    ]);
  } catch (err) {
    console.error('Failed to sync reports table:', err);
  }
};

// 10. Reports
app.get('/api/reports/monthly', async (req, res) => {
  try {
    const { month, year, project, assignee, client } = req.query;
    
    await syncReportsTable();

    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();
    
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
    
    const whereClause = {
      deliveredDate: {
        gte: startDate,
        lte: endDate,
      }
    };

    if (assignee && assignee !== 'All Assignees') {
      whereClause.assignees = { contains: assignee, mode: 'insensitive' };
    }
    if (project && project !== 'All Projects') {
      whereClause.projectName = project;
    }
    if (client && client !== 'All Clients') {
      whereClause.clientId = client;
    }

    const reportRecords = await prisma.report.findMany({
      where: whereClause,
      orderBy: { deliveredDate: 'desc' }
    });

    const taskIds = reportRecords.map(r => r.id);
    const [dbTasks, workLogs] = await Promise.all([
      prisma.task.findMany({ where: { id: { in: taskIds } }, select: { id: true, parentId: true } }),
      prisma.workLog.findMany({ where: { taskId: { in: taskIds }, isBilled: false } })
    ]);
    const taskParentMap = new Map(dbTasks.map(t => [t.id, t.parentId]));
    const timeSpentMap = {};
    workLogs.forEach(l => { timeSpentMap[l.taskId] = (timeSpentMap[l.taskId] || 0) + (l.hoursWorked || 0); });

    const mapped = reportRecords.map(r => ({
      id: r.id,
      taskNo: r.taskNo,
      parentId: taskParentMap.get(r.id) || null,
      title: r.title,
      projectName: r.projectName,
      projectId: r.projectId,
      assignees: r.assignees,
      deliveredDate: r.deliveredDate,
      clientRef: r.companyName ? { company: r.companyName } : null,
      taskApprovedHours: r.billableHours,
      taskActualHours: r.alreadyBilled,
      timeSpent: timeSpentMap[r.id] || 0,
      workLogPeriodString: `${month || (targetMonth + 1)}/${year || targetYear}`
    }));

    res.json(mapped);
  } catch (error) {
    console.error('GET /api/reports/monthly error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 11. Custom Reports (Range)
app.get('/api/reports/range', async (req, res) => {
  try {
    const { startDate, endDate, project, assignee, client } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    
    await syncReportsTable();

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const whereClause = {
      deliveredDate: {
        gte: start,
        lte: end,
      }
    };

    if (assignee && assignee !== 'All Assignees') {
      whereClause.assignees = { contains: assignee, mode: 'insensitive' };
    }
    if (project && project !== 'All Projects') {
      whereClause.projectName = project;
    }
    if (client && client !== 'All Clients') {
      whereClause.clientId = client;
    }

    const reportRecords = await prisma.report.findMany({
      where: whereClause,
      orderBy: { deliveredDate: 'desc' }
    });

    const taskIds = reportRecords.map(r => r.id);
    const [dbTasks, workLogs] = await Promise.all([
      prisma.task.findMany({ where: { id: { in: taskIds } }, select: { id: true, parentId: true } }),
      prisma.workLog.findMany({ where: { taskId: { in: taskIds }, isBilled: false } })
    ]);
    const taskParentMap = new Map(dbTasks.map(t => [t.id, t.parentId]));
    const timeSpentMap = {};
    workLogs.forEach(l => { timeSpentMap[l.taskId] = (timeSpentMap[l.taskId] || 0) + (l.hoursWorked || 0); });

    const mapped = reportRecords.map(r => ({
      id: r.id,
      taskNo: r.taskNo,
      parentId: taskParentMap.get(r.id) || null,
      title: r.title,
      projectName: r.projectName,
      projectId: r.projectId,
      assignees: r.assignees,
      deliveredDate: r.deliveredDate,
      clientRef: r.companyName ? { company: r.companyName } : null,
      taskApprovedHours: r.billableHours,
      taskActualHours: r.alreadyBilled,
      timeSpent: timeSpentMap[r.id] || 0
    }));

    res.json(mapped);
  } catch (error) {
    console.error('GET /api/reports/range error:', error);
    res.status(500).json({ error: error.message });
  }
});


// 12. Reports - Tasks Work Log (status-based, filtered by logDate)
app.get('/api/reports/status-based', async (req, res) => {
  try {
    const { period = 'monthly', date, startDate: qStart, endDate: qEnd, project, assignee, client, status } = req.query;

    // ── Build date range from period ──────────────────────────────────────────
    let startDate, endDate;
    if (period === 'custom') {
      if (!qStart || !qEnd) return res.status(400).json({ error: 'startDate and endDate required for custom period' });
      startDate = new Date(qStart);
      startDate.setUTCHours(0, 0, 0, 0);
      endDate   = new Date(qEnd);
      endDate.setUTCHours(23, 59, 59, 999);
    } else {
      let targetDate;
      if (date) {
        targetDate = new Date(date);
      } else {
        const now = new Date();
        targetDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      }

      if (period === 'daily') {
        startDate = new Date(targetDate);
        startDate.setUTCHours(0, 0, 0, 0);
        endDate = new Date(targetDate);
        endDate.setUTCHours(23, 59, 59, 999);
      } else if (period === 'weekly') {
        const day = targetDate.getUTCDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        startDate = new Date(targetDate);
        startDate.setUTCDate(targetDate.getUTCDate() + diffToMonday);
        startDate.setUTCHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setUTCDate(startDate.getUTCDate() + 6);
        endDate.setUTCHours(23, 59, 59, 999);
      } else {
        // monthly
        startDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1, 0, 0, 0, 0));
        endDate   = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      }
    }

    // ── Step 1: fetch work logs in the date range ─────────────────────────────
    const workLogWhere = { logDate: { gte: startDate, lte: endDate } };
    if (assignee && assignee !== 'All Assignees') workLogWhere.userId = assignee;

    const workLogs = await prisma.workLog.findMany({ where: workLogWhere });

    if (workLogs.length === 0) return res.json([]);

    // ── Step 2: aggregate timeSpent per (task, user) ──────────────────────────
    const aggMap = {};
    workLogs.forEach(l => {
      const key = `${l.taskId}_${l.userId}`;
      if (!aggMap[key]) {
        aggMap[key] = {
          taskId: l.taskId,
          userId: l.userId,
          hours: 0
        };
      }
      aggMap[key].hours += Number(l.hoursWorked) || 0;
    });
    const aggEntries = Object.values(aggMap);
    const taskIds = Array.from(new Set(aggEntries.map(e => e.taskId)));

    // ── Step 3: fetch task details with optional filters ──────────────────────
    const taskWhere = { id: { in: taskIds } };
    if (status  && status  !== 'All')          taskWhere.status   = status;
    if (project && project !== 'All Projects') taskWhere.projectRef = { name: project };
    if (client  && client  !== 'All Clients')  taskWhere.clientId = client;

    const tasks = await prisma.task.findMany({
      where: taskWhere,
      include: { projectRef: { select: { name: true } } },
    });

    // ── Step 4: build result sorted by timeSpent desc ─────────────────────────
    const result = aggEntries
      .map(entry => {
        const t = tasks.find(task => task.id === entry.taskId);
        if (!t) return null; // Filtered out by task filters (project, status, client)
        return {
          id:             t.id,
          taskNo:         t.taskNo,
          parentId:       t.parentId,
          title:          t.title,
          projectName:    t.projectRef?.name || '',
          assignees:      entry.userId,
          status:         t.status,
          timeSpent:      entry.hours,
          billableHours:  t.approvedHours   || 0,
          estimatedHours: t.estimatedHours  || 0,
          dueDate:        t.dueDate,
          priority:       t.priority,
          taskType:       t.taskType,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.timeSpent - a.timeSpent);

    res.json(result);
  } catch (error) {
    console.error('GET /api/reports/status-based error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 13. Role Permissions
app.get('/api/roles/permissions', async (req, res) => {
  try {
    const perms = await prisma.rolePermission.findMany();
    res.json(perms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/roles/permissions', async (req, res) => {
  const { role, data } = req.body;
  try {
    const perm = await prisma.rolePermission.upsert({
      where: { role },
      update: { data },
      create: { role, data }
    });
    res.json(perm);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/roles/permissions/:role', async (req, res) => {
  const { role } = req.params;
  console.log(`Deleting role: ${role}`);
  try {
    await prisma.rolePermission.deleteMany({
      where: { role }
    });
    res.json({ message: `Role ${role} deleted` });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});


// 13. Project Attachments
app.get('/api/projects/:projectId/attachments', async (req, res) => {
  try {
    const attachments = await prisma.projectAttachment.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(attachments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:projectId/attachments', async (req, res) => {
  try {
    const attachment = await prisma.projectAttachment.create({
      data: {
        ...req.body,
        projectId: req.params.projectId
      }
    });
    res.json(attachment);
  } catch (error) {
    console.error('POST attachment error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/projects/:projectId/attachments/:id', async (req, res) => {
  try {
    await prisma.projectAttachment.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Notifications
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: { equals: req.params.userId, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit to recent 50
    });
    res.json(notifications);
  } catch (error) {
    console.error('GET /api/notifications error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true }
    });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/notifications/user/:userId/read-all', async (req, res) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: { equals: req.params.userId, mode: 'insensitive' }, isRead: false },
      data: { isRead: true }
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ══════════════════════════════════════════════════════════════════
//  BROWSER EXTENSION API
// ══════════════════════════════════════════════════════════════════

// POST /api/browser/login — authenticate and return JWT
app.post('/api/browser/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: 'insensitive' } } });
    const isMatch = user ? await verifyPassword(password, user.password) : false;
    if (!user || !isMatch) return res.status(401).json({ error: 'Invalid email or password' });
    if (user.status !== 'Active') return res.status(403).json({ error: 'Account is inactive or pending approval' });

    const token = signBrowserToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        role: user.role,
        empId: user.empId,
      }
    });
  } catch (err) {
    console.error('POST /api/browser/login error:', err);
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

// GET /api/browser/me — return current user info
app.get('/api/browser/me', verifyBrowserToken, (req, res) => {
  const u = req.browserUser;
  res.json({
    id: u.id,
    email: u.email,
    fullName: u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim(),
    role: u.role,
    empId: u.empId,
  });
});

// GET /api/browser/projects — return active projects for assignee selection
app.get('/api/browser/projects', verifyBrowserToken, async (req, res) => {
  try {
    const userId = req.browserUser?.id || null;
    const projects = await prisma.project.findMany({
      where: { status: 'Active' },
      select: {
        id: true,
        name: true,
        projectNo: true,
        members: true,
        taskLists: {
          select: {
            id: true,
            name: true,
            isFavorite: true,
            favoritedBy: true,
            tasks: {
              select: { assignees: true }
            }
          }
        }
      },
      orderBy: { name: 'asc' },
    });
    // Compute per-user isFavorite using favoritedBy (same logic as main /api/projects)
    const mapped = projects.map(p => ({
      ...p,
      taskLists: (p.taskLists || []).map(list => {
        const favoritedByArr = list.favoritedBy
          ? list.favoritedBy.split(',').map(id => id.trim()).filter(Boolean)
          : [];
        return {
          id: list.id,
          name: list.name,
          isFavorite: userId ? favoritedByArr.includes(userId) : false
        };
      })
    }));
    res.json(mapped);
  } catch (err) {
    console.error('GET /api/browser/projects error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/browser/users — return users for assignee selection
app.get('/api/browser/users', verifyBrowserToken, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { status: 'Active' },
      select: { id: true, fullName: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: { fullName: 'asc' },
    });
    const mapped = users.map(u => ({
      id: u.id,
      name: u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim(),
      email: u.email,
      role: u.role,
    }));
    res.json(mapped);
  } catch (err) {
    console.error('GET /api/browser/users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/browser/task — create a bug report task from the extension
app.post('/api/browser/task', verifyBrowserToken, async (req, res) => {
  try {
    const {
      comment,
      title,
      url,
      pageTitle,
      screenshot,          // base64 annotated JPEG
      elementSelector,
      elementXPath,
      elementHTML,
      elementText,
      elementTag,
      elementId,
      elementClasses,
      bounds,
      viewportWidth,
      viewportHeight,
      scrollX,
      scrollY,
      browser,
      userAgent,
      projectId,
      assignees,           // comma-separated user IDs or names
      priority,
      taskType,
      dueDate,
      deliveredDate,
      taskListId,
      severity,
      status,
      tags,
    } = req.body;

    if (!title) return res.status(400).json({ error: 'Title is required' });

    const reporter = req.browserUser;
    const reporterName = reporter.fullName || `${reporter.firstName || ''} ${reporter.lastName || ''}`.trim();
    const now = new Date();

    // User-entered comment/description only (no auto-generated metadata)
    const description = (comment || '').trim();

    // Store screenshot in the pipe-separated string format expected by the frontend
    const attachmentData = screenshot
      ? `${screenshot}|${reporterName}|${now.toISOString()}|browser-report-screenshot.jpg|${reporter.id || ''}`
      : null;

    // Auto-generate task number with B prefix for Bugs
    const allTasks = await prisma.task.findMany({
      select: { taskNo: true }
    });
    let maxNo = 0;
    let prefix = 'T';
    const finalTaskType = taskType || 'Bug';
    const type = finalTaskType.toLowerCase();
    if (type === 'bug' || type === 'bug report') {
      prefix = 'B';
    } else if (type === 'calls/meetings') {
      prefix = 'C';
    }
    for (const t of allTasks) {
      if (t.taskNo) {
        const digits = parseInt(t.taskNo.replace(/\D/g, ''), 10);
        if (!isNaN(digits) && digits > maxNo && digits < 50000) {
          maxNo = digits;
        }
      }
    }
    const taskNo = `${prefix}${maxNo + 1}`;

    // Resolve project
    let resolvedProjectId = null;
    let projectName = null;
    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } });
      if (project) { resolvedProjectId = project.id; projectName = project.name; }
    }

    const task = await prisma.task.create({
      data: {
        taskNo,
        title: title,
        description,
        taskType: finalTaskType,
        status: status || 'To Do',
        priority: priority || severity || 'Medium',
        projectId: resolvedProjectId,
        taskListId: taskListId || null,
        assignees: assignees || reporter.id,
        attachments: attachmentData,
        tag: tags ? `${tags}, browser-report` : 'browser-report',
        assignedDate: now,
        dueDate: (dueDate && dueDate.trim()) ? new Date(dueDate) : null,
        deliveredDate: (deliveredDate && deliveredDate.trim()) ? new Date(deliveredDate) : null,
        creatorId: reporter.id,
        createdBy: reporterName,
      }
    });

    // Send notification ONLY to assignees (excluding reporter if self-assigned)
    // Other users, including admins, will not receive notifications unless assigned.
    try {
      const reporterIdentifiers = [reporter.id, reporterName, reporter.email].filter(Boolean).map(s => s.toLowerCase());
      const assigneeIdList = (task.assignees || '').split(',').map(s => s.trim()).filter(Boolean);
      const bugRecipients = assigneeIdList.filter(id => !reporterIdentifiers.includes(id.toLowerCase()));

      if (bugRecipients.length > 0) {
        await createNotification(bugRecipients, `New Bug Report: ${task.title}`, `${reporterName} reported a bug task: ${task.title}`);
        const { taskListName, projectName: pName } = await getTaskDetailsForEmail(task);
        await notifyEmailsByNames(bugRecipients, `New Bug Report: ${task.title}`, {
          author: reporterName || 'User',
          action: 'created bug report',
          itemTitle: task.title,
          boardName: taskListName,
          projectName: pName,
          buttonText: 'View Item',
          taskId: getTaskDisplayId(task)
        }, 'task');
      }
    } catch (notifErr) {
      console.error('Error sending bug report notifications:', notifErr);
    }

    console.log(`[Browser Extension] Task ${taskNo} created by ${reporterName} from ${url}`);
    res.status(201).json({
      success: true,
      taskId: task.id,
      taskNo: task.taskNo,
      title: task.title,
    });
  } catch (err) {
    console.error('POST /api/browser/task error:', err);
    res.status(500).json({ error: 'Failed to create task', details: err.message });
  }
});

const runMigrationIfNecessary = async () => {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    let updatedCount = 0;
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const targetNo = `T${i + 1}`;
      
      const currentNo = task.taskNo || '';
      const digits = currentNo.replace(/\D/g, '');
      const isSequentialFormat = currentNo.startsWith('T') && digits && !currentNo.startsWith('TSK-');

      const isHugeId = digits && parseInt(digits, 10) >= 50000;

      if (isHugeId || !isSequentialFormat || currentNo !== targetNo) {
        await prisma.task.update({
          where: { id: task.id },
          data: { taskNo: targetNo }
        });
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      console.log(`[Startup Migration] Successfully migrated task numbers. Updated ${updatedCount} out of ${tasks.length} tasks.`);
    }
  } catch (err) {
    console.error('[Startup Migration Error]', err);
  }
};

const calculateNextRecurrence = (frequency, detail, baseDate) => {
  if (!frequency) return null;
  const nextDate = new Date(baseDate);
  const freq = frequency.toLowerCase();
  const det = (detail || '').trim();

  switch (freq) {
    case 'weekday': {
      const targetDay = {
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5
      }[det.toLowerCase()] || 1;

      nextDate.setDate(nextDate.getDate() + 1);
      for (let i = 0; i < 7; i++) {
        if (nextDate.getDay() === targetDay) {
          break;
        }
        nextDate.setDate(nextDate.getDate() + 1);
      }
      return nextDate;
    }
    case 'weekly': {
      const dayMap = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6
      };
      const targetDays = det
        .split(',')
        .map(d => dayMap[d.trim().toLowerCase()])
        .filter(d => d !== undefined);

      if (targetDays.length === 0) {
        nextDate.setDate(nextDate.getDate() + 7);
        return nextDate;
      }

      nextDate.setDate(nextDate.getDate() + 1);
      for (let i = 0; i < 8; i++) {
        if (targetDays.includes(nextDate.getDay())) {
          break;
        }
        nextDate.setDate(nextDate.getDate() + 1);
      }
      return nextDate;
    }
    case 'monthly': {
      if (det.toLowerCase().includes('last')) {
        const year = nextDate.getFullYear();
        const month = nextDate.getMonth();
        return new Date(year, month + 2, 0);
      } else {
        const targetDay = parseInt(det, 10) || 1;
        let targetMonth = (nextDate.getMonth() + 1) % 12;
        let targetYear = nextDate.getFullYear();
        if (nextDate.getMonth() === 11) {
          targetYear += 1;
        }
        let next = new Date(targetYear, targetMonth, targetDay);
        if (next.getMonth() !== targetMonth) {
          next = new Date(targetYear, targetMonth + 1, 0);
        }
        return next;
      }
    }
    case 'yearly': {
      let targetMonth = nextDate.getMonth();
      let targetDay = nextDate.getDate();

      if (det.includes('-')) {
        const parts = det.split('-');
        if (parts.length === 3) {
          targetMonth = parseInt(parts[1], 10) - 1;
          targetDay = parseInt(parts[2], 10);
        } else if (parts.length === 2) {
          const mStr = parts[0].toLowerCase();
          const monthsShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          const mIdx = monthsShort.indexOf(mStr);
          if (mIdx !== -1) {
            targetMonth = mIdx;
          } else {
            targetMonth = parseInt(parts[0], 10) - 1;
          }
          targetDay = parseInt(parts[1], 10);
        }
      }

      const nextYear = nextDate.getFullYear() + 1;
      let next = new Date(nextYear, targetMonth, targetDay);
      if (next.getMonth() !== targetMonth) {
        next = new Date(nextYear, targetMonth + 1, 0);
      }
      return next;
    }
    default:
      nextDate.setDate(nextDate.getDate() + 1);
      return nextDate;
  }
};

const getInitialRecurrenceDate = (frequency, detail, baseDate) => {
  if (!frequency) return null;
  const start = new Date(baseDate);
  const freq = frequency.toLowerCase();
  const det = (detail || '').trim();

  switch (freq) {
    case 'weekday': {
      const targetDay = {
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5
      }[det.toLowerCase()] || 1;
      
      for (let i = 0; i < 7; i++) {
        if (start.getDay() === targetDay) {
          return start;
        }
        start.setDate(start.getDate() + 1);
      }
      return start;
    }
    case 'weekly': {
      const dayMap = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6
      };
      const targetDays = det
        .split(',')
        .map(d => dayMap[d.trim().toLowerCase()])
        .filter(d => d !== undefined);

      if (targetDays.length === 0) {
        return start;
      }

      for (let i = 0; i < 8; i++) {
        if (targetDays.includes(start.getDay())) {
          return start;
        }
        start.setDate(start.getDate() + 1);
      }
      return start;
    }
    case 'monthly': {
      if (det.toLowerCase().includes('last')) {
        const year = start.getFullYear();
        const month = start.getMonth();
        const lastDay = new Date(year, month + 1, 0);
        if (lastDay >= baseDate) {
          return lastDay;
        }
        return new Date(year, month + 2, 0);
      } else {
        const targetDay = parseInt(det, 10) || 1;
        const year = start.getFullYear();
        const month = start.getMonth();
        let target = new Date(year, month, targetDay);
        if (target.getMonth() !== month) {
          target = new Date(year, month + 1, 0);
        }
        if (target >= baseDate) {
          return target;
        }
        let nextMonth = (month + 1) % 12;
        let nextYear = nextMonth === 0 ? year + 1 : year;
        let next = new Date(nextYear, nextMonth, targetDay);
        if (next.getMonth() !== nextMonth) {
          next = new Date(nextYear, nextMonth + 1, 0);
        }
        return next;
      }
    }
    case 'yearly': {
      let targetMonth = start.getMonth();
      let targetDay = start.getDate();

      if (det.includes('-')) {
        const parts = det.split('-');
        if (parts.length === 3) {
          targetMonth = parseInt(parts[1], 10) - 1;
          targetDay = parseInt(parts[2], 10);
        } else if (parts.length === 2) {
          const mStr = parts[0].toLowerCase();
          const monthsShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          const mIdx = monthsShort.indexOf(mStr);
          if (mIdx !== -1) {
            targetMonth = mIdx;
          } else {
            targetMonth = parseInt(parts[0], 10) - 1;
          }
          targetDay = parseInt(parts[1], 10);
        }
      }

      const year = start.getFullYear();
      let target = new Date(year, targetMonth, targetDay);
      if (target.getMonth() !== targetMonth) {
        target = new Date(year, targetMonth + 1, 0);
      }
      if (target >= baseDate) {
        return target;
      }
      let next = new Date(year + 1, targetMonth, targetDay);
      if (next.getMonth() !== targetMonth) {
        next = new Date(year + 1, targetMonth + 1, 0);
      }
      return next;
    }
    default:
      return start;
  }
};

const checkAndGenerateRecurringTasks = async () => {
  try {
    const now = new Date();
    const templates = await prisma.task.findMany({
      where: {
        taskType: 'Recurring Task',
        recurrenceFrequency: { not: null },
        nextOccurrence: { lte: now }
      }
    });

    for (const template of templates) {
      const currentNext = new Date(template.nextOccurrence);
      const nextDate = calculateNextRecurrence(template.recurrenceFrequency, template.recurrenceDetail, currentNext);

      await prisma.task.update({
        where: { id: template.id },
        data: {
          lastOccurrence: currentNext,
          nextOccurrence: nextDate
        }
      });

      // 1. Process parameter placeholders in the title
      let instanceTitle = template.title;
      const dayStr = String(currentNext.getDate());
      const yearStr = String(currentNext.getFullYear());
      const monthAbbrev = currentNext.toLocaleString('default', { month: 'short' });
      const monthFull = currentNext.toLocaleString('default', { month: 'long' });
      const monthNum = String(currentNext.getMonth() + 1).padStart(2, '0');

      instanceTitle = instanceTitle
        .replace(/{day}/gi, dayStr)
        .replace(/{date}/gi, dayStr)
        .replace(/{dd}/gi, dayStr.padStart(2, '0'))
        .replace(/{month}/g, monthAbbrev)
        .replace(/{Month}/g, monthFull)
        .replace(/{mmm}/gi, monthAbbrev)
        .replace(/{MMMM}/g, monthFull)
        .replace(/{month_num}/gi, monthNum)
        .replace(/{mm}/gi, monthNum)
        .replace(/{year}/gi, yearStr)
        .replace(/{yyyy}/gi, yearStr)
        .replace(/{YYYY}/gi, yearStr);

      // Support user's example style like: Maintenance for {Aug} {2026}
      const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const longMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      for (let i = 0; i < 12; i++) {
        instanceTitle = instanceTitle
          .replace(new RegExp(`{${shortMonths[i]}}`, 'gi'), monthAbbrev)
          .replace(new RegExp(`{${longMonths[i]}}`, 'gi'), monthFull);
      }
      instanceTitle = instanceTitle.replace(/{\d{4}}/g, yearStr);

      // 2. Sequential task number calculation
      const allTasks = await prisma.task.findMany({ select: { taskNo: true } });
      let maxNo = 0;
      for (const t of allTasks) {
        if (t.taskNo) {
          const digits = parseInt(t.taskNo.replace(/\D/g, ''), 10);
          if (!isNaN(digits) && digits > maxNo && digits < 50000) {
            maxNo = digits;
          }
        }
      }
      const taskNo = `T${maxNo + 1}`;

      // 3. Create the instance task
      const newInstance = await prisma.task.create({
        data: {
          taskNo,
          title: instanceTitle,
          description: template.description,
          taskType: 'Task', // Standard task type for the instance
          projectId: template.projectId,
          clientId: template.clientId,
          assignees: template.assignees,
          dueDate: currentNext,
          status: 'To Do',
          priority: template.priority,
          tag: template.tag,
          taskListId: template.taskListId,
          createdBy: template.createdBy,
          creatorId: template.creatorId,
          recurringTemplateId: template.id
        }
      });

      console.log(`[Recurring Task Scheduler] Generated instance task ${taskNo} (${newInstance.id}): "${instanceTitle}" from template ${template.id}`);
    }
  } catch (err) {
    console.error('[Recurring Task Scheduler] Error checking/generating recurring tasks:', err);
  }
};

app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  await checkAndGenerateRecurringTasks();
  setInterval(checkAndGenerateRecurringTasks, 10000); // Check every 10 seconds
});

module.exports = app;

