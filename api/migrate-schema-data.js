const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateData() {
  console.log('Starting data migration (Name -> UUID)...');

  try {
    // 1. Fetch all users to build a lookup map
    const users = await prisma.user.findMany();
    console.log(`Fetched ${users.length} users.`);

    const findUserIdByName = (nameStr) => {
      if (!nameStr) return null;
      const cleanName = nameStr.trim().toLowerCase();
      const user = users.find(u => {
        const full = (u.fullName || '').toLowerCase();
        const firstLast = (`${u.firstName || ''} ${u.lastName || ''}`).trim().toLowerCase();
        return full === cleanName || firstLast === cleanName || (u.firstName || '').toLowerCase() === cleanName;
      });
      return user ? user.id : null;
    };

    const convertCommaSeparatedNames = (str) => {
      if (!str) return str;
      const names = str.split(',').map(n => n.trim()).filter(Boolean);
      const ids = names.map(findUserIdByName).filter(Boolean);
      return ids.length > 0 ? ids.join(',') : null;
    };

    // 2. Update Tasks (assignees, projectName removal is schema level but we don't need to touch data for removed columns)
    const tasks = await prisma.task.findMany({ where: { assignees: { not: null, not: '' } } });
    let tasksUpdated = 0;
    for (const task of tasks) {
      const newAssignees = convertCommaSeparatedNames(task.assignees);
      // Only update if it actually changed and isn't already a UUID (crude check: contains '-')
      if (newAssignees && newAssignees !== task.assignees && !task.assignees.includes('-')) {
        await prisma.task.update({
          where: { id: task.id },
          data: { assignees: newAssignees }
        });
        tasksUpdated++;
      } else if (!newAssignees && !task.assignees.includes('-')) {
         // Data loss: couldn't map name to ID. Set to null to prevent FK/logic issues later if we enforced it, 
         // but since assignees is a comma string, we'll just clear it if no mapping found.
         await prisma.task.update({
          where: { id: task.id },
          data: { assignees: null }
        });
        tasksUpdated++;
      }
    }
    console.log(`Updated ${tasksUpdated} Tasks.`);

    // 3. Update Projects (members)
    const projects = await prisma.project.findMany({ where: { members: { not: null, not: '' } } });
    let projectsUpdated = 0;
    for (const project of projects) {
      const newMembers = convertCommaSeparatedNames(project.members);
      if (newMembers && newMembers !== project.members && !project.members.includes('-')) {
        await prisma.project.update({
          where: { id: project.id },
          data: { members: newMembers }
        });
        projectsUpdated++;
      } else if (!newMembers && !project.members.includes('-')) {
        await prisma.project.update({
          where: { id: project.id },
          data: { members: null }
        });
        projectsUpdated++;
      }
    }
    console.log(`Updated ${projectsUpdated} Projects.`);

    // 4. Update Comments (author)
    const comments = await prisma.comment.findMany();
    let commentsUpdated = 0;
    for (const comment of comments) {
      if (comment.author && !comment.author.includes('-')) { // Not a UUID
        const newAuthorId = findUserIdByName(comment.author);
        if (newAuthorId) {
          await prisma.comment.update({
            where: { id: comment.id },
            data: { author: newAuthorId }
          });
          commentsUpdated++;
        } else {
          // If we can't find the user, we have to delete the comment or assign it to a dummy user.
          // Since author will become a strict FK, invalid UUIDs will break the database constraint.
          console.warn(`[Warning] Comment ${comment.id} has unresolvable author: "${comment.author}". Deleting comment to satisfy future FK constraint.`);
          await prisma.comment.delete({ where: { id: comment.id } });
        }
      }
    }
    console.log(`Updated ${commentsUpdated} Comments.`);

    // 5. Update ProjectQueries (sentTo)
    const queries = await prisma.projectQuery.findMany({ where: { sentTo: { not: null, not: '' } } });
    let queriesUpdated = 0;
    for (const query of queries) {
      if (query.sentTo && !query.sentTo.includes('-')) {
        const newSentToId = findUserIdByName(query.sentTo);
        await prisma.projectQuery.update({
          where: { id: query.id },
          data: { sentTo: newSentToId || null } // null if not found
        });
        queriesUpdated++;
      }
    }
    console.log(`Updated ${queriesUpdated} ProjectQueries.`);

    // 6. Update Notifications (userId)
    const notifications = await prisma.notification.findMany();
    let notificationsUpdated = 0;
    for (const notif of notifications) {
      if (notif.userId && !notif.userId.includes('-')) {
        const newUserId = findUserIdByName(notif.userId);
        if (newUserId) {
          await prisma.notification.update({
            where: { id: notif.id },
            data: { userId: newUserId }
          });
          notificationsUpdated++;
        } else {
          // Unresolvable notification, delete it to prevent future FK issues if we add one (though currently it's just String)
          await prisma.notification.delete({ where: { id: notif.id } });
        }
      }
    }
    console.log(`Updated ${notificationsUpdated} Notifications.`);

    // 7. Update Reports (assignees)
    const reports = await prisma.report.findMany({ where: { assignees: { not: null, not: '' } } });
    let reportsUpdated = 0;
    for (const report of reports) {
      const newAssignees = convertCommaSeparatedNames(report.assignees);
      if (newAssignees && newAssignees !== report.assignees && !report.assignees.includes('-')) {
        await prisma.report.update({
          where: { id: report.id },
          data: { assignees: newAssignees }
        });
        reportsUpdated++;
      } else if (!newAssignees && !report.assignees.includes('-')) {
        await prisma.report.update({
          where: { id: report.id },
          data: { assignees: null }
        });
        reportsUpdated++;
      }
    }
    console.log(`Updated ${reportsUpdated} Reports.`);

    console.log('Data migration complete!');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

migrateData();
