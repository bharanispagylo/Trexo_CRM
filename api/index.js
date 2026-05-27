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

  try {
    console.log('[Startup] Pushing database schema (db push)...');
    require('child_process').execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
    console.log('[Startup] Database schema successfully pushed!');
  } catch (err) {
    console.error('[Startup] Prisma db push warning/error:', err.message);
  }
}

const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Self-healing database column verification
prisma.$connect()
  .then(async () => {
    console.log('[Self-Healing] Database connected, verifying columns...');
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_no TEXT;');
      console.log('[Self-Healing] Column task_no verified/added successfully.');
    } catch (e) {
      console.warn('[Self-Healing] Column task_no addition warning:', e.message);
    }
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS delivered_date TIMESTAMP;');
      console.log('[Self-Healing] Column delivered_date verified/added successfully.');
    } catch (e) {
      console.warn('[Self-Healing] Column delivered_date addition warning:', e.message);
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
  const users = (typeof userIds === 'string' ? userIds.split(',') : userIds).map(u => u.trim()).filter(Boolean);
  try {
    for (const user of users) {
      await prisma.notification.create({
        data: { userId: user, title, message }
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

const sanitizeTaskData = (taskData) => {
  if (!prisma.task || !prisma.task.fields) return taskData;
  const sanitized = {};
  Object.keys(taskData).forEach(key => {
    if (key in prisma.task.fields) {
      sanitized[key] = taskData[key];
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

    const user = await prisma.user.create({
      data: {
        firstName: finalFirstName,
        lastName: finalLastName,
        fullName: finalFullName,
        ...rest
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

app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ error: 'Email and new password are required' });
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await prisma.user.update({
      where: { email },
      data: { password: newPassword }
    });
    
    console.log(`Password reset directly for: ${email}`);
    res.json({ message: 'Password has been successfully reset.' });
  } catch (error) {
    console.error('POST /api/forgot-password error:', error);
    res.status(500).json({ error: 'Failed to process request', details: error.message });
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
  try {
    await prisma.user.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
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
    res.json(projects);
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

    const project = await prisma.project.create({ data });
    if (project.members) {
      createNotification(project.members, `New Project: ${project.name}`, `You have been added to the project team.`);
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
      orderBy: { createdAt: 'desc' }
    });
    res.json(tasks);
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
    if (taskData.approvedHours !== undefined) taskData.approvedHours = parseFloat(taskData.approvedHours) || 0;
    if (taskData.actualHours !== undefined) taskData.actualHours = parseFloat(taskData.actualHours) || 0;
    
    // Universal model field sanitizer to protect Prisma against drift
    taskData = sanitizeTaskData(taskData);

    const task = await prisma.task.create({
      data: taskData
    });
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
    if (taskData.approvedHours !== undefined) taskData.approvedHours = parseFloat(taskData.approvedHours) || 0;
    if (taskData.actualHours !== undefined) taskData.actualHours = parseFloat(taskData.actualHours) || 0;

    // Universal model field sanitizer to protect Prisma against drift
    taskData = sanitizeTaskData(taskData);

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: taskData
    });
    
    // Notify assignees about task update
    if (task.assignees) {
      createNotification(task.assignees, `Task Updated: ${task.title}`, `Task has been updated by a team member.`);
    }

    res.json(task);
  } catch (error) {
    console.error('PUT /api/tasks error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
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
      orderBy: { createdAt: 'desc' }
    });
    res.json(comments);
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
    const totalHours = allLogs.reduce((sum, l) => sum + l.hoursWorked, 0);
    await prisma.task.update({
      where: { id: req.params.id },
      data: { 
        actualHours: totalHours
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
    const totalHours = allLogs.reduce((sum, l) => sum + l.hoursWorked, 0);
    await prisma.task.update({
      where: { id: log.taskId },
      data: { 
        actualHours: totalHours
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
    const totalHours = allLogs.reduce((sum, l) => sum + l.hoursWorked, 0);
    await prisma.task.update({
      where: { id: log.taskId },
      data: { 
        actualHours: totalHours
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks/:id/comments', async (req, res) => {
  try {
    const comment = await prisma.comment.create({
      data: {
        taskId: req.params.id,
        text: req.body.text,
        author: req.body.author || 'Anonymous',
        parentId: req.body.parentId || null
      }
    });

    // Notify assignees about the new comment
    try {
      const task = await prisma.task.findUnique({ where: { id: req.params.id } });
      if (task && task.assignees) {
        // Exclude the author from notifications
        const assignees = task.assignees.split(',').map(a => a.trim()).filter(a => a && a.toLowerCase() !== comment.author.toLowerCase());
        createNotification(assignees, `New Comment on ${task.title}`, `${comment.author} commented: "${comment.text.substring(0, 30)}..."`);
      }
    } catch (e) {
      console.error('Failed to send comment notification', e);
    }

    res.json(comment);
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
        sentTo,
        status: status || 'Open',
        solved: solved === undefined ? false : Boolean(solved),
        priority: priority || 'Medium',
        projectId
      }
    });
    if (query.sentTo) {
      createNotification([query.sentTo], `New Query Assigned`, `You have a new query: ${query.title}`);
    }
    res.json(query);
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
    if (sentTo !== undefined) updateData.sentTo = sentTo;
    if (status !== undefined) updateData.status = status;
    if (solved !== undefined) updateData.solved = Boolean(solved);
    if (priority !== undefined) updateData.priority = priority;

    const query = await prisma.projectQuery.update({
      where: { id: req.params.id },
      data: updateData
    });
    if (query.sentTo) {
      createNotification([query.sentTo], `Query Updated`, `Query ${query.title} was updated.`);
    }
    res.json(query);
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
        projectName: finalProjectName,
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
app.get('/api/reports/monthly', async (req, res) => {
  try {
    const { month, year, project, assignee, client } = req.query;
    
    // Default to current month/year if not provided
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth(); // 0-indexed
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();
    
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
    
    const whereClause = {
      logDate: {
        gte: startDate,
        lte: endDate,
      }
    };

    if (assignee && assignee !== 'All Assignees') {
      whereClause.user = { fullName: { contains: assignee } }; // This is an approximation
    }

    const taskFilters = {};
    if (project && project !== 'All Projects') {
      taskFilters.projectName = project;
    }
    if (client && client !== 'All Clients') {
      taskFilters.clientId = client;
    }

    if (Object.keys(taskFilters).length > 0) {
      whereClause.task = taskFilters;
    }

    const logs = await prisma.workLog.findMany({
      where: whereClause,
      include: {
        task: {
          include: { clientRef: true, projectRef: true }
        },
        user: true
      }
    });

    // Aggregate by task
    const taskMap = {};
    logs.forEach(log => {
      const taskId = log.taskId;
      if (!taskMap[taskId]) {
        taskMap[taskId] = {
          ...log.task,
          actualHours: 0,
          approvedHours: log.task.approvedHours, // Use task's manually entered billable hours
          workLogPeriodString: `${month}/${year}`,
          deliveredDate: log.logDate // using logDate as reference
        };
      }
      taskMap[taskId].actualHours += log.hoursWorked;
    });

    res.json(Object.values(taskMap));
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
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const whereClause = {
      logDate: {
        gte: start,
        lte: end,
      }
    };
    
    const taskFilters = {};
    if (project && project !== 'All Projects') {
      taskFilters.projectName = project;
    }
    if (client && client !== 'All Clients') {
      taskFilters.clientId = client;
    }
    if (Object.keys(taskFilters).length > 0) {
      whereClause.task = taskFilters;
    }

    const logs = await prisma.workLog.findMany({
      where: whereClause,
      include: {
        task: {
          include: { clientRef: true, projectRef: true }
        },
        user: true
      }
    });
    
    // Aggregate by task
    const taskMap = {};
    logs.forEach(log => {
      const taskId = log.taskId;
      if (!taskMap[taskId]) {
        taskMap[taskId] = {
          ...log.task,
          actualHours: 0,
          approvedHours: log.task.approvedHours, // Use task's manually entered billable hours
          deliveredDate: log.logDate
        };
      }
      taskMap[taskId].actualHours += log.hoursWorked;
    });

    res.json(Object.values(taskMap));
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
