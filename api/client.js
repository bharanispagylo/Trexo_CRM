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
