/**
 * api/client.js
 *
 * Drop-in Supabase replacement for the Express + Prisma backend.
 * Every component calls api.get / api.post / api.put / api.delete —
 * this file handles those calls directly against Supabase so the
 * backend server (index.js) is not required.
 *
 * ✅  NO changes needed in any other file.
 * ✅  All original components (Employee, Salary, Leave, Attendance,
 *     Projects, Teams, Tasks, Bugs) work exactly as before.
 */

import { createClient } from '@supabase/supabase-js';

// ── Supabase client ───────────────────────────────────────
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

// ── Table map  (Express route → Supabase table name) ─────
const TABLE = {
  employees:  'employees',
  salaries:   'salaries',
  leaves:     'leaves',
  attendance: 'attendance',
  projects:   'projects',
  teams:      'teams',
  tasks:      'tasks',
  bugs:       'bugs',
  users:      'users',
  comments:   'comments',
  notifications: 'notifications'
};

/**
 * Parse "/api/employees" → "employees"
 * Parse "/api/employees/abc-123" → { table:"employees", id:"abc-123" }
 */
function parseRoute(route) {
  // strip leading /api/
  const clean = route.replace(/^\/api\//, '');
  const parts = clean.split('/');
  return { table: TABLE[parts[0]] || parts[0], id: parts[1] || null };
}

// ── api object ────────────────────────────────────────────
export const api = {

  // ── GET /api/<table> ────────────────────────────────────
  async get(route) {
    const clean = route.replace(/^\/api\//, '');
    const parts = clean.split('/');

    // 1. tasks/:id/comments
    if (parts[0] === 'tasks' && parts[2] === 'comments') {
      const taskId = parts[1];
      const { data, error } = await supabase
        .from('comments')
        .select('*, user:users(*)')
        .eq('taskId', taskId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return (data || []).map(c => ({
        ...c,
        author: c.user?.fullName || c.user?.firstName || 'Anonymous'
      }));
    }

    // 2. notifications/:userId
    if (parts[0] === 'notifications' && parts[1]) {
      const userId = parts[1];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw new Error(error.message);
      return (data || []).map(n => ({
        id: n.id,
        userId: n.user_id,
        title: n.title,
        message: n.message,
        isRead: n.is_read,
        createdAt: n.created_at,
        updatedAt: n.updated_at
      }));
    }

    const { table } = parseRoute(route);
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  },

  // ── POST /api/<table> ───────────────────────────────────
  async post(route, body) {
    const clean = route.replace(/^\/api\//, '');
    const parts = clean.split('/');

    // 1. tasks/:id/comments
    if (parts[0] === 'tasks' && parts[2] === 'comments') {
      const taskId = parts[1];
      const authorName = body.author || 'Anonymous';

      // Look up authorId
      const { data: users } = await supabase
        .from('users')
        .select('id, fullName, firstName')
        .or(`fullName.ilike.%${authorName}%,firstName.ilike.%${authorName}%`);

      let authorId = users?.[0]?.id;
      if (!authorId) {
        const { data: firstUser } = await supabase.from('users').select('id').limit(1);
        authorId = firstUser?.[0]?.id;
      }

      const { data: comment, error } = await supabase
        .from('comments')
        .insert([{
          taskId: taskId,
          text: body.text,
          author: authorId,
          parentId: body.parentId || null
        }])
        .select('*, user:users(*)')
        .single();

      if (error) throw new Error(error.message);

      return {
        ...comment,
        author: comment.user?.fullName || comment.user?.firstName || authorName
      };
    }

    const { table } = parseRoute(route);

    // attendance: ensure date is ISO string
    if (table === 'attendance' && body.date && typeof body.date === 'string') {
      body = { ...body, date: new Date(body.date).toISOString() };
    }

    const { data, error } = await supabase
      .from(table)
      .insert([body])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // ── PUT /api/<table>/:id ────────────────────────────────
  async put(route, body) {
    const clean = route.replace(/^\/api\//, '');
    const parts = clean.split('/');

    // 1. tasks/:id/comments/:commentId/react
    if (parts[0] === 'tasks' && parts[2] === 'comments' && parts[4] === 'react') {
      const commentId = parts[3];
      const { data: comment } = await supabase
        .from('comments')
        .select('reactions')
        .eq('id', commentId)
        .single();

      let reactions = comment?.reactions || {};
      if (typeof reactions === 'string') reactions = JSON.parse(reactions);
      
      if (!reactions[body.emoji]) reactions[body.emoji] = [];
      const idx = reactions[body.emoji].indexOf(body.user);
      if (idx > -1) {
        reactions[body.emoji].splice(idx, 1);
        if (reactions[body.emoji].length === 0) delete reactions[body.emoji];
      } else {
        reactions[body.emoji].push(body.user);
      }

      const { data: updated, error } = await supabase
        .from('comments')
        .update({ reactions })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return updated;
    }

    // 2. notifications/user/:userId/read-all
    if (parts[0] === 'notifications' && parts[1] === 'user' && parts[3] === 'read-all') {
      const userId = parts[2];
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .select();

      if (error) throw new Error(error.message);
      return data;
    }

    // 3. notifications/:id/read
    if (parts[0] === 'notifications' && parts[2] === 'read') {
      const id = parts[1];
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return {
        id: data.id,
        userId: data.user_id,
        title: data.title,
        message: data.message,
        isRead: data.is_read,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }

    const { table, id } = parseRoute(route);
    if (!id) throw new Error(`PUT requires an id: ${route}`);

    const { data, error } = await supabase
      .from(table)
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // ── DELETE /api/<table>/:id ─────────────────────────────
  async delete(route) {
    const { table, id } = parseRoute(route);
    if (!id) throw new Error(`DELETE requires an id: ${route}`);

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true };
  },
};
