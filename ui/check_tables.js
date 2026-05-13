const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://xdtvtcavumzblzsxbuyb.supabase.co',
  'sb_publishable_pW1nFJVpzMFna2h5oeX0uQ_TwJPZ1O1'
);

async function listTables() {
  // Try common table name variants
  const names = ['employees', 'employee', 'Employees', 'Employee', 'emp', 'staff',
                 'salaries', 'salary', 'leaves', 'leave', 'attendance',
                 'projects', 'project', 'teams', 'team', 'tasks', 'task', 'bugs'];
  
  for (const name of names) {
    const { data, error } = await supabase.from(name).select('*').limit(1);
    if (!error) {
      const cols = data && data.length > 0 ? Object.keys(data[0]).join(', ') : '(empty - columns unknown)';
      console.log(` TABLE EXISTS: "${name}" → Columns: ${cols}`);
    }
  }
}

listTables().then(() => process.exit(0));
