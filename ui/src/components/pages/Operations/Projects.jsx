import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import './Projects.css';
import { usePermissions } from '../../../hooks/usePermissions';

export default function Projects({ user }) {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currentView, setCurrentView] = useState('list'); // 'list' or 'detail'
  const [selectedProject, setSelectedProject] = useState(null);
  const [newListName, setNewListName] = useState('');

  const [form, setForm] = useState({ name: '', status: 'Active' });
  const [expandedProjectId, setExpandedProjectId] = useState(null);
  const { can, getLevel } = usePermissions();

  // ── FETCH DATA ──
  const fetchData = async () => {
    setLoading(true);
    try {
      const [projData, empData] = await Promise.all([
        api.get('/projects'),
        api.get('/employees')
      ]);
      setProjects(projData || []);
      setEmployees(empData || []);
      
      // Update selected project if we are in detail view
      if (selectedProject) {
        const updated = projData.find(p => p.id === selectedProject.id);
        if (updated) setSelectedProject(updated);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // ── DETAIL VIEW HANDLERS ──
  const toggleMemberDetail = async (empName) => {
    if (!selectedProject) return;
    
    const target = empName.trim();
    const currentMembers = (selectedProject.members || '')
      .split(',')
      .map(m => m.trim())
      .filter(m => m !== "");
    
    const exists = currentMembers.some(m => m.toLowerCase() === target.toLowerCase());
    
    let updatedMembers;
    if (exists) {
      // Remove (case-insensitive)
      updatedMembers = currentMembers.filter(m => m.toLowerCase() !== target.toLowerCase());
    } else {
      // Add
      updatedMembers = [...currentMembers, target];
    }

    try {
      await api.put(`/projects/${selectedProject.id}`, {
        members: updatedMembers.join(', ')
      });
      fetchData();
    } catch (error) {
      console.error('Update members error:', error);
    }
  };

  const handleAddList = async () => {
    if (!newListName.trim() || !selectedProject) return;
    try {
      await api.post('/task-lists', {
        name: newListName,
        projectId: selectedProject.id
      });
      setNewListName('');
      fetchData();
    } catch (error) {
      console.error('Add list error:', error);
    }
  };

  const [newTaskNames, setNewTaskNames] = useState({}); // { listId: 'name' }

  const handleAddTask = async (listId) => {
    const taskName = newTaskNames[listId];
    if (!taskName?.trim()) return;

    try {
      await api.post('/tasks', {
        title: taskName,
        taskListId: listId,
        status: 'To Do'
      });
      setNewTaskNames({ ...newTaskNames, [listId]: '' });
      fetchData();
    } catch (error) {
      console.error('Add task error:', error);
    }
  };

  const handleRemoveTask = async (taskId) => {
    if (!window.confirm('Remove this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      fetchData();
    } catch (error) {
      console.error('Delete task error:', error);
    }
  };

  // ── LIST HANDLERS ──
  const handleAdd = async () => {
    if (!form.name.trim()) return;
    try {
      await api.post('/projects', {
        name: form.name,
        status: form.status
      });
      setForm({ name: '', status: 'Active' });
      setShowForm(false);
      fetchData();
    } catch (error) {
      console.error('Insert error:', error);
      alert('Failed to add project');
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm('Remove this project?')) return;
    try {
      await api.delete(`/projects/${id}`);
      fetchData();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleRemoveList = async (listId) => {
    if (!window.confirm('Delete this task list?')) return;
    try {
      await api.delete(`/task-lists/${listId}`);
      fetchData();
    } catch (error) {
      console.error('Delete list error:', error);
    }
  };

  // ── RENDER DETAIL VIEW ──
  if (currentView === 'detail' && selectedProject) {
    const rawMembers = (selectedProject.members || '').split(',').map(m => m.trim()).filter(m => m !== "");
    const projMembers = [...new Set(rawMembers)];

    return (
      <div className="projects-page page-container detail-view">
        <div className="saas-tabs" style={{ marginBottom: '1.5rem' }}>
          <button className="saas-tab" onClick={() => setCurrentView('list')}>← Back to Projects</button>
          <button className="saas-tab active">Team Management</button>
        </div>

        <div className="saas-form-card">
          <div className="form-header">
            <div>
               <h3 className="form-title">{selectedProject.name}</h3>
               <span className={`status-pill ${selectedProject.status?.toLowerCase()}`} style={{ marginTop: '0.5rem', display: 'inline-block' }}>
                 {selectedProject.status}
               </span>
            </div>
          </div>

          {can('projects', 'assign') && (
            <div className="saas-field" style={{ marginTop: '2rem' }}>
              <label className="saas-label">Assign New Team Member</label>
              <select className="saas-select" style={{ maxWidth: '400px' }} onChange={(e) => toggleMemberDetail(e.target.value)} value="">
                <option value="" disabled>Select employee...</option>
                {employees
                  .filter(emp => {
                     const name = emp.name.trim();
                     return !projMembers.some(pm => pm.toLowerCase() === name.toLowerCase());
                  })
                  .map(emp => (
                    <option key={emp.id} value={emp.name}>{emp.name}</option>
                  ))
                }
                {employees.filter(emp => !projMembers.some(pm => pm.toLowerCase() === emp.name.trim().toLowerCase())).length === 0 && (
                  <option disabled>All employees are already assigned.</option>
                )}
              </select>
            </div>
          )}

          <div className="saas-table-container" style={{ marginTop: '1.5rem' }}>
            <table className="saas-table">
              <thead>
                <tr>
                  <th style={{ fontSize: '0.65rem' }}>Active Team Members ({projMembers.length})</th>
                  <th style={{ textAlign: 'right', fontSize: '0.65rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {projMembers.length === 0 ? (
                  <tr><td colSpan="2" style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8', fontSize: '0.85rem' }}>No members assigned to this project yet.</td></tr>
                ) : (
                  projMembers.map((m, idx) => (
                    <tr key={`${m}-${idx}`}>
                      <td style={{ fontWeight: '600', fontSize: '0.9rem', color: '#1E293B' }}>{m}</td>
                      <td style={{ textAlign: 'right' }}>
                        {can('projects', 'assign') && (
                          <button className="action-btn" style={{ color: '#EF4444' }} onClick={() => toggleMemberDetail(m)}>Remove</button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Task Lists Management */}
        <div className="saas-table-container" style={{ marginTop: '2rem' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--saas-border)' }}>
             <span style={{ fontWeight: '700', color: '#475569' }}>Project Task Lists</span>
             {can('projects', 'create') && (
               <div className="add-list-inline" style={{ marginTop: 0 }}>
                  <input 
                    className="saas-input" 
                    placeholder="New List Name..." 
                    style={{ width: '200px', height: '36px', fontSize: '0.85rem' }}
                    value={newListName}
                    onChange={e => setNewListName(e.target.value)}
                  />
                  <button 
                    className="saas-btn-submit" 
                    style={{ padding: '0 1rem', height: '36px', fontSize: '0.8rem' }}
                    onClick={handleAddList}
                  >
                    + Add List
                  </button>
               </div>
             )}
           </div>
           
           <div className="task-lists-container" style={{ background: 'white', padding: '1.5rem' }}>
             <div className="task-lists-grid">
                {(selectedProject.taskLists || []).map(list => (
                  <div key={list.id} className="task-list-card" style={{ display: 'block', minWidth: '280px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <span className="task-list-name" style={{ fontSize: '0.9rem', fontWeight: '700' }}>{list.name}</span>
                      {can('projects', 'delete') && <button className="action-btn" onClick={() => handleRemoveList(list.id)}>✕</button>}
                    </div>

                    {/* Tasks List */}
                    <div className="inline-tasks" style={{ marginBottom: '1rem' }}>
                       {(list.tasks || []).map(task => (
                         <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #F1F5F9' }}>
                            <span style={{ fontSize: '0.85rem', color: '#334155' }}>{task.title}</span>
                            {can('tasks', 'delete') && <button className="action-btn" style={{ fontSize: '0.6rem', color: '#EF4444' }} onClick={() => handleRemoveTask(task.id)}>Remove</button>}
                         </div>
                       ))}
                       {(list.tasks || []).length === 0 && <div style={{ fontSize: '0.8rem', color: '#94A3B8', padding: '0.5rem 0' }}>No tasks yet.</div>}
                    </div>

                    {/* Add Task Form */}
                    {can('tasks', 'create') && (
                      <div className="add-task-inline" style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                         <input 
                           className="saas-input" 
                           placeholder="Task name..." 
                           style={{ height: '32px', fontSize: '0.75rem', flex: 1 }}
                           value={newTaskNames[list.id] || ''}
                           onChange={e => setNewTaskNames({...newTaskNames, [list.id]: e.target.value})}
                           onKeyPress={e => e.key === 'Enter' && handleAddTask(list.id)}
                         />
                         <button 
                           className="saas-btn-submit" 
                           style={{ height: '32px', padding: '0 0.75rem', fontSize: '0.7rem' }}
                           onClick={() => handleAddTask(list.id)}
                         >
                           + Task
                         </button>
                      </div>
                    )}
                  </div>
                ))}
                {(selectedProject.taskLists || []).length === 0 && <div style={{ color: '#94A3B8', fontSize: '0.9rem', textAlign: 'center', width: '100%', padding: '2rem' }}>No task lists created for this project.</div>}
             </div>
           </div>
        </div>
      </div>
    );
  }

  // ── RENDER LIST VIEW ──
  return (
    <div className="projects-page page-container">
      {/* Tab Navigation */}
      <div className="saas-tabs">
         <button className="saas-tab active">All Projects</button>
         <button className="saas-tab">Milestones</button>
         <button className="saas-tab">External</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
         <button className="saas-btn-submit" onClick={() => setShowForm(true)}>+ New Project</button>
      </div>

      {/* Add Project Form (Simplified) */}
      {showForm && (
        <div className="saas-form-card">
          <div className="form-header">
            <h3 className="form-title">Launch New Project</h3>
            <button className="action-btn" style={{ color: '#94A3B8' }} onClick={() => setShowForm(false)}>✕</button>
          </div>
          
          <div className="form-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <div className="saas-field">
              <label className="saas-label">Project Name</label>
              <input className="saas-input" placeholder="e.g. Phoenix Redesign" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div className="saas-field">
              <label className="saas-label">Status</label>
              <select className="saas-select" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="form-actions" style={{ display: 'flex', gap: '1rem' }}>
            <button className="saas-btn-submit" onClick={handleAdd}>Create Project</button>
            <button className="saas-btn-cancel" onClick={() => setShowForm(false)}>Discard</button>
          </div>
        </div>
      )}

      {/* Projects Table */}
      <div className="saas-table-container">
        <table className="saas-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>Project Name</th>
              <th>Status</th>
              <th>Team</th>
              <th>Lists</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>Syncing workspace...</td></tr>
            ) : projects.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>No projects in this view.</td></tr>
            ) : (
              projects.map(proj => (
                <React.Fragment key={proj.id}>
                  <tr>
                    <td>
                      <button 
                        className="action-btn" 
                        style={{ color: '#64748B', transform: expandedProjectId === proj.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
                        onClick={() => setExpandedProjectId(expandedProjectId === proj.id ? null : proj.id)}
                      >
                        ▶
                      </button>
                    </td>
                    <td className="project-name-cell">
                      <button 
                        className="action-btn" 
                        style={{ color: 'var(--saas-primary-green)', padding: 0, fontSize: '0.95rem', textAlign: 'left' }}
                        onClick={() => {
                          setSelectedProject(proj);
                          setCurrentView('detail');
                        }}
                      >
                        {proj.name}
                      </button>
                    </td>
                    <td>
                      <span className={`status-pill ${proj.status?.toLowerCase() || 'active'}`}>
                        {proj.status || 'Active'}
                      </span>
                    </td>
                    <td>
                      <span className="task-count-badge" style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }}>
                        {(proj.members || '').split(',').filter(m => m.trim()).length}
                      </span>
                    </td>
                    <td>
                      <span className="task-count-badge" style={{ background: '#F1F5F9', color: '#64748B' }}>
                        {(proj.taskLists || []).length}
                      </span>
                    </td>
                    <td>
                      {(getLevel('projects', 'delete') === 'All' || (getLevel('projects', 'delete') === 'Self' && (user?.fullName || user?.name) && (proj.members || '').toLowerCase().includes((user?.fullName || user?.name).toLowerCase()))) && (
                        <button className="action-btn" onClick={() => handleRemove(proj.id)}>Remove</button>
                      )}
                    </td>
                  </tr>
                  {expandedProjectId === proj.id && (
                    <tr>
                      <td colSpan="6" style={{ padding: 0 }}>
                        <div className="task-lists-container">
                          <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#475569' }}>Task Lists in {proj.name}</h4>
                          <div className="task-lists-grid">
                            {(proj.taskLists || []).map(list => (
                              <div key={list.id} className="task-list-card">
                                <span className="task-list-name">{list.name}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                   <span className="task-count-badge">0 Tasks</span>
                                   {can('projects', 'delete') && <button className="action-btn" style={{ fontSize: '0.65rem' }} onClick={() => handleRemoveList(list.id)}>✕</button>}
                                </div>
                              </div>
                            ))}
                            {(proj.taskLists || []).length === 0 && <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>No task lists found.</div>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
