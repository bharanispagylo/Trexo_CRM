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
  })
  .catch(console.error);

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

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
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
    const { fullName, firstName, lastName, ...rest } = req.body;
    
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


app.put('/api/users/:id', async (req, res) => {
  try {
    const { fullName, firstName, lastName, ...rest } = req.body;
    
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
    const leave = await prisma.leave.create({
      data: req.body
    });
    res.json(leave);
  } catch (error) {
    console.error('POST /api/leaves error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/leaves/:id', async (req, res) => {
  try {
    const leave = await prisma.leave.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(leave);
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
    const { estimatedHours, actualHours, billableHours, taskLists, ...rest } = req.body;
    const data = { ...rest };
    if (estimatedHours !== undefined) data.estimatedHours = parseFloat(estimatedHours) || 0;
    if (actualHours !== undefined) data.actualHours = parseFloat(actualHours) || 0;
    if (billableHours !== undefined) data.billableHours = parseFloat(billableHours) || 0;

    const project = await prisma.project.create({ data });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const { estimatedHours, actualHours, billableHours, taskLists, ...rest } = req.body;
    const data = { ...rest };
    if (estimatedHours !== undefined) data.estimatedHours = parseFloat(estimatedHours) || 0;
    if (actualHours !== undefined) data.actualHours = parseFloat(actualHours) || 0;
    if (billableHours !== undefined) data.billableHours = parseFloat(billableHours) || 0;

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data
    });
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
      include: { tasks: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(taskLists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/task-lists', async (req, res) => {
  try {
    const taskList = await prisma.taskList.create({
      data: req.body
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
    const { name } = req.body;
    const taskList = await prisma.taskList.update({
      where: { id: req.params.id },
      data: { name }
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
    ['dueDate', 'startDate', 'endDate', 'assignedDate', 'deliveredDate'].forEach(key => {
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
    ['dueDate', 'startDate', 'endDate', 'assignedDate', 'deliveredDate'].forEach(key => {
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
    res.json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id/comments/:commentId/like', async (req, res) => {
  try {
    const comment = await prisma.comment.update({
      where: { id: req.params.commentId },
      data: { likes: { increment: 1 } }
    });
    res.json(comment);
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
        sentTo,
        status: status || 'Open',
        solved: solved === undefined ? false : Boolean(solved),
        priority: priority || 'Medium',
        projectId
      }
    });
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

// 10. Role Permissions
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


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
