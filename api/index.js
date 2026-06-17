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

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// In-memory store for Forgot Password OTP codes
const otpStore = new Map();


// Self-healing database column verification
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
        const foundUser = await prisma.user.findFirst({
          where: {
            OR: [
              { fullName: { contains: nameWithSpaces, mode: 'insensitive' } },
              { firstName: { contains: nameWithSpaces, mode: 'insensitive' } },
              { lastName: { contains: nameWithSpaces, mode: 'insensitive' } },
              { email: { contains: item, mode: 'insensitive' } }
            ]
          }
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

const notifyEmailsByNames = async (userIds, subject, message, type) => {
  if (!userIds) return;
  const names = (typeof userIds === 'string' ? userIds.split(',') : userIds).map(u => u.trim()).filter(Boolean);
  if (names.length === 0) return;
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: names.map(name => {
          const nameWithSpaces = name.replace(/_/g, ' ');
          return {
            OR: [
              { id: name },
              { fullName: { contains: nameWithSpaces, mode: 'insensitive' } },
              { firstName: { contains: nameWithSpaces, mode: 'insensitive' } },
              { lastName: { contains: nameWithSpaces, mode: 'insensitive' } },
              { email: { contains: name, mode: 'insensitive' } }
            ]
          };
        })
      }
    });

    for (const u of users) {
      if (u.email) {
        const userContext = {
          ...message,
          buttonLink: `https://trexo-crm-fqxl.vercel.app?email=${encodeURIComponent(u.email)}`
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
  const prefix = task.parentId ? 'S' : 'T';
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
app.use(express.json());

// Clean up empty string ID on POST requests so that default generator works
app.use((req, res, next) => {
  if (req.method === 'POST' && req.body && req.body.id === '') {
    delete req.body.id;
  }
  next();
});

// Request logging middleware
app.use((req, res, next) => {
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

    if (!user || user.password !== password) {
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

    await prisma.user.update({
      where: { email: normalizedEmail },
      data: { password: newPassword }
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
    // Map sentToId → sentTo so frontend stays compatible
    const mapped = projects.map(p => ({
      ...p,
      queries: (p.queries || []).map(q => ({ ...q, sentTo: q.sentToId }))
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
      createNotification(project.members, `New Project: ${project.name}`, `You have been added to the project team.`);
      notifyEmailsByNames(project.members, `New Project: ${project.name}`, {
        author: 'Admin',
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
    const taskLists = await prisma.taskList.findMany({
      include: { tasks: true, project: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(taskLists);
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
    const { tasks, project, ...rest } = req.body;
    const taskList = await prisma.taskList.update({
      where: { id: req.params.id },
      data: rest
    });
    res.json(taskList);
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

app.post('/api/tasks', async (req, res) => {
  try {
    console.log('POST /api/tasks body:', req.body);
    let { id, comments, createdAt, ...taskData } = req.body;
    
    // Sanitize and convert dates
    ['dueDate', 'assignedDate', 'deliveredDate'].forEach(key => {
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

    const task = await prisma.task.create({
      data: taskData
    });
    if (task.assignees) {
      createNotification(task.assignees, `New Task Assigned: ${task.title}`, `You have been assigned to a new task.`);
      const { taskListName, projectName } = await getTaskDetailsForEmail(task);
      notifyEmailsByNames(task.assignees, `New Task Assigned: ${task.title}`, {
        author: 'Admin',
        action: 'assigned you to',
        itemTitle: task.title,
        boardName: taskListName,
        projectName: projectName,
        buttonText: 'View Item',
        taskId: getTaskDisplayId(task)
      }, 'task');
    }
    res.json(task);
  } catch (error) {
    console.error('POST /api/tasks error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    console.log('PUT /api/tasks body:', req.body);
    let { id, createdAt, comments, ...taskData } = req.body;
    
    // Fetch existing task to compare assignees
    const existingTask = await prisma.task.findUnique({
      where: { id: req.params.id }
    });
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Sanitize and convert dates
    ['dueDate', 'assignedDate', 'deliveredDate'].forEach(key => {
      if (taskData[key]) {
        const d = new Date(taskData[key]);
        if (!isNaN(d.getTime())) {
          taskData[key] = d;
        } else {
          taskData[key] = null; // Use null for invalid/empty dates
        }
      } else {
        taskData[key] = null;
      }
    });

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
        author: 'A team member',
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
        // Exclude the author from notifications
        const assignees = task.assignees.split(',').map(a => a.trim()).filter(a => a && a.toLowerCase() !== (authorId || '').toLowerCase());
        createNotification(assignees, `New Comment on ${task.title}`, `${commentAuthorName} commented: "${comment.text.substring(0, 30)}..."`);
        
        const { taskListName, projectName } = await getTaskDetailsForEmail(task);

        // Email assignees about the comment
        notifyEmailsByNames(assignees, `New Comment on ${task.title}`, {
          author: commentAuthorName,
          action: 'commented on',
          itemTitle: task.title,
          boardName: taskListName,
          projectName: projectName,
          commentText: comment.text,
          buttonText: 'Reply on Trexo CRM',
          taskId: getTaskDisplayId(task)
        }, 'comment');
      }
      
      // Notify mentioned users
      const mentions = comment.text.match(/@([a-zA-Z0-9_]+)/g);
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
          buttonText: 'Reply on Trexo CRM',
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
      include: {
        clientRef: true,
        projectRef: true,
        workLogs: true
      }
    });

    const reportsToInsert = tasks.map(task => {
      let deliveredDate = task.deliveredDate || task.dueDate;
      if (task.workLogs && task.workLogs.length > 0) {
        const dates = task.workLogs.map(wl => new Date(wl.logDate));
        deliveredDate = new Date(Math.max(...dates));
      }

      return {
        id: task.id,
        taskNo: task.taskNo,
        title: task.title,
        companyName: task.clientRef ? (task.clientRef.company || task.clientRef.name) : null,
        projectName: task.projectName || (task.projectRef ? task.projectRef.name : null),
        projectId: task.projectId,
        clientId: task.clientId,
        assignees: task.assignees,
        billableHours: task.approvedHours || 0.0,
        alreadyBilled: task.actualHours || 0.0,
        deliveredDate: deliveredDate
      };
    });

    await prisma.$transaction([
      prisma.report.deleteMany(),
      prisma.report.createMany({
        data: reportsToInsert
      })
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
      where: whereClause
    });

    const taskIds = reportRecords.map(r => r.id);
    const dbTasks = await prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, parentId: true }
    });
    const taskParentMap = new Map(dbTasks.map(t => [t.id, t.parentId]));

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
      where: whereClause
    });

    const taskIds = reportRecords.map(r => r.id);
    const dbTasks = await prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, parentId: true }
    });
    const taskParentMap = new Map(dbTasks.map(t => [t.id, t.parentId]));

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
      taskActualHours: r.alreadyBilled
    }));

    res.json(mapped);
  } catch (error) {
    console.error('GET /api/reports/range error:', error);
    res.status(500).json({ error: error.message });
  }
});


// 12. Role Permissions
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


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;

