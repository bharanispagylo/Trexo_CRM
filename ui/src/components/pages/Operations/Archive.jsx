import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../api/client';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAlert } from '../../../context/AlertContext';
import { TaskDetailView, PriorityFlag, TaskTitleTooltip, getDisplayId } from './Tasks';
import './Tasks.css';
import './TaskGroups.css';
import './Archive.css';

export default function Archive({ user }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingTask, setViewingTask] = useState(null);

  const { can, getLevel } = usePermissions();
  const { alert, confirm, toast } = useAlert();

  // Determine permission levels for archive actions
  const viewLevel   = getLevel('archive', 'view');
  const restoreLevel = getLevel('archive', 'restore');
  const deleteLevel  = getLevel('archive', 'delete');

  // Helper: is current user the assignee of a task?
  const isAssignedToMe = useCallback((task) => {
    if (!user) return false;
    const userId = user.id || '';
    const userName = (user.fullName || user.firstName || '').trim().toLowerCase();
    const assignees = (task.assignees || '').split(',').map(a => a.trim()).filter(Boolean);
    // Match by ID (preferred) or by name
    return assignees.some(a => a === userId || a.toLowerCase() === userName);
  }, [user]);

  const fetchArchivedTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/tasks');
      const all = data || [];
      const archived = all.filter(t => t.status === 'Archived' || t.status === 'Archive');
      setTasks(archived);
    } catch (err) {
      console.error('Failed to fetch archived tasks:', err);
      toast('Failed to load archived tasks', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchArchivedTasks();
  }, [fetchArchivedTasks]);

  const canView    = can('archive', 'view');
  const canRestore = can('archive', 'restore');
  const canDelete  = can('archive', 'delete');

  const handleRestore = (task) => {
    confirm(
      `Restore "${task.title || 'Untitled Task'}" to active tasks?`,
      async () => {
        try {
          const targetStatus = task.previousStatus && task.previousStatus !== 'Archived' && task.previousStatus !== 'Archive' ? task.previousStatus : 'To Do';
          await api.put(`/tasks/${task.id}`, { status: targetStatus });
          toast('Task restored successfully!', 'success');
          fetchArchivedTasks();
        } catch (err) {
          console.error('Restore error:', err);
          alert('Failed to restore task', 'error');
        }
      },
      'Restore Task'
    );
  };

  const handleDelete = (task) => {
    confirm(
      `Permanently delete "${task.title || 'Untitled Task'}"? This cannot be undone.`,
      async () => {
        try {
          await api.delete(`/tasks/${task.id}`);
          toast('Task permanently deleted', 'success');
          fetchArchivedTasks();
        } catch (err) {
          console.error('Delete error:', err);
          alert('Failed to delete task', 'error');
        }
      },
      'Permanently Delete Task'
    );
  };

  // Scope tasks based on Self/All permission level
  const visibleTasks = tasks.filter(t => {
    if (viewLevel === 'All') return true;
    if (viewLevel === 'Self') return isAssignedToMe(t);
    return false; // 'None'
  });

  const filteredTasks = visibleTasks.filter(t => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = (t.title || '').toLowerCase();
    const taskNo = (t.taskNo || '').toLowerCase();
    const displayId = getDisplayId(t).toLowerCase();
    const proj = (t.projectName || '').toLowerCase();
    return title.includes(q) || taskNo.includes(q) || displayId.includes(q) || proj.includes(q);
  });

  if (!canView) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        <h2>Access Denied</h2>
        <p>You do not have permission to view archived tasks.</p>
      </div>
    );
  }

  return (
    <div className="tg-page-container">
      {/* Header / Search */}
      <div className="tg-header-row" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-start' }}>
          <div className="tg-search-wrapper archive-search-wrapper">
            <svg className="tg-search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Search archived tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="tg-search-input archive-search-input"
            />
          </div>
        </div>
      </div>

      {/* Main Content Table / Cards */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading archived tasks...</div>
      ) : filteredTasks.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#cbd5e1" strokeWidth="1.5" style={{ marginBottom: '1rem' }}>
            <polyline points="21 8 21 21 3 21 3 8"></polyline>
            <rect x="1" y="3" width="22" height="5"></rect>
            <line x1="10" y1="12" x2="14" y2="12"></line>
          </svg>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#475569' }}>No Archived Tasks Found</h3>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>Tasks marked with "Archived" status will appear here.</p>
        </div>
      ) : (
        <div className="archive-table-container">
          <table className="archive-table">
            <thead>
              <tr className="archive-thead-row">
                <th className="col-task">TASK</th>
                <th className="col-project">PROJECT</th>
                <th className="col-status">PREVIOUS STATUS</th>
                <th className="col-priority">PRIORITY</th>
                <th className="col-actions">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => {
                return (
                  <tr key={t.id} className="archive-row">
                    <td className="cell-task" data-label="TASK">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <TaskTitleTooltip text={`${getDisplayId(t)} ${t.title || 'Untitled Task'}`}>
                          <span className="cu-task-id-prefix">{getDisplayId(t)}</span>
                          <span 
                            className="cu-task-title" 
                            style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', cursor: 'pointer' }}
                            onClick={() => setViewingTask(t)}
                          >
                            {t.title || 'Untitled Task'}
                          </span>
                        </TaskTitleTooltip>
                      </div>
                    </td>
                    <td className="cell-project" data-label="PROJECT">
                      {t.projectName || '-'}
                    </td>
                    <td className="cell-status" data-label="PREVIOUS STATUS">
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: (() => {
                        const s = (t.previousStatus || 'To Do').toLowerCase().trim();
                        if (s === 'in progress') return '#2563eb';
                        if (s === 'to do') return '#78350f';
                        if (s === 'in testing') return '#7c3aed';
                        if (s === 're-opened') return '#db2777';
                        if (s === 'prod deployed') return '#ea580c';
                        if (s === 'prod verified') return '#0d9488';
                        if (s === 'delivered' || s === 'completed') return '#16a34a';
                        return '#475569';
                      })(), textTransform: 'uppercase' }}>
                        {t.previousStatus || 'To Do'}
                      </span>
                    </td>
                    <td className="cell-priority" data-label="PRIORITY">
                      <PriorityFlag priority={t.priority} />
                    </td>
                    <td className="cell-actions" data-label="ACTIONS">
                      <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setViewingTask(t)}
                          style={{ width: '28px', height: '28px', border: 'none', background: 'transparent', color: '#475569', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          title="View Details"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                        {canRestore && (restoreLevel === 'All' || (restoreLevel === 'Self' && isAssignedToMe(t))) && (
                          <button
                            onClick={() => handleRestore(t)}
                            style={{ width: '28px', height: '28px', border: 'none', background: 'transparent', color: '#2563eb', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Restore Task"
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                          </button>
                        )}
                        {canDelete && (deleteLevel === 'All' || (deleteLevel === 'Self' && isAssignedToMe(t))) && (
                          <button
                            onClick={() => handleDelete(t)}
                            style={{ width: '28px', height: '28px', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Delete Permanently"
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Task Details Drawer Modal */}
      {viewingTask && (
        <div className="task-drawer-overlay" onClick={e => { if (e.target === e.currentTarget) setViewingTask(null); }}>
          <div className="task-drawer-panel">
            <TaskDetailView
              task={viewingTask}
              onClose={() => setViewingTask(null)}
              onSave={async () => {
                setViewingTask(null);
                fetchArchivedTasks();
              }}
              currentUser={user}
            />
          </div>
        </div>
      )}
    </div>
  );
}
