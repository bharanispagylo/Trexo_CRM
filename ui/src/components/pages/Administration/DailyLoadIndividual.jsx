import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import './Reports.css';

const downloadCSV = (filename, headers, rowsData) => {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.map(escape).join(','),
    ...rowsData.map(r => r.map(escape).join(','))
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const isTaskAssignedToUser = (task, userObj) => {
  if (!task || !task.assignees || !userObj) return false;
  const rawAssignees = task.assignees.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
  const targetId = (userObj.id || '').toLowerCase().trim();
  const targetName = (userObj.fullName || userObj.name || `${userObj.firstName || ''} ${userObj.lastName || ''}`).toLowerCase().trim();
  const targetFirstName = (userObj.firstName || '').toLowerCase().trim();

  return rawAssignees.some(a => 
    a === targetId || 
    (targetName && a === targetName) || 
    (targetFirstName && a === targetFirstName)
  );
};

const STATUS_HEADER_META = {
  'To Do': { bg: '#78350f', fg: '#ffffff' },
  'to do': { bg: '#78350f', fg: '#ffffff' },
  'In Progress': { bg: '#2563eb', fg: '#ffffff' },
  'in progress': { bg: '#2563eb', fg: '#ffffff' }
};

export default function DailyLoadIndividual({ user, onTaskClick }) {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [allTasks, setAllTasks] = useState([]);
  const [allWorklogs, setAllWorklogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [userData, taskData, worklogData] = await Promise.all([
          api.get('/users').catch(() => []),
          api.get('/tasks').catch(() => []),
          api.get('/worklogs').catch(() => [])
        ]);
        const rawUsers = userData || [];
        const nonAdminUsers = rawUsers.filter(u => (u.role || '').toLowerCase().trim() !== 'admin');
        const sortedUsers = [...nonAdminUsers].sort((a, b) => {
          const nameA = a.fullName || a.name || `${a.firstName || ''} ${a.lastName || ''}`.trim() || '';
          const nameB = b.fullName || b.name || `${b.firstName || ''} ${b.lastName || ''}`.trim() || '';
          return nameA.localeCompare(nameB);
        });
        setUsers(sortedUsers);
        setAllTasks((taskData || []).filter(t => t.status !== 'Archived' && t.status !== 'Archive'));
        setAllWorklogs(worklogData || []);

        setSelectedUserId('all');
      } catch (err) {
        console.error('Error fetching Daily Load Individual report data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const selectedUserObj = users.find(u => u.id === selectedUserId);
  const selectedUserName = selectedUserId === 'all'
    ? 'All Member'
    : (selectedUserObj
      ? (selectedUserObj.fullName || selectedUserObj.name || `${selectedUserObj.firstName || ''} ${selectedUserObj.lastName || ''}`.trim() || selectedUserObj.email || '')
      : '');

  // Filter tasks assigned to selected user in status 'To Do' or 'In Progress'
  const matchingTasks = allTasks.filter(t => {
    const st = (t.status || '').toLowerCase().trim();
    const isTargetStatus = st === 'to do' || st === 'in progress';
    if (!isTargetStatus) return false;

    if (selectedUserId === 'all') {
      if (!t.assignees) return false;
      const rawAssignees = t.assignees.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
      return users.some(u => {
        const targetId = (u.id || '').toLowerCase().trim();
        const targetName = (u.fullName || u.name || `${u.firstName || ''} ${u.lastName || ''}`).toLowerCase().trim();
        const targetFirstName = (u.firstName || '').toLowerCase().trim();
        return rawAssignees.some(a => 
          a === targetId || 
          (targetName && a === targetName) || 
          (targetFirstName && a === targetFirstName)
        );
      });
    }

    return isTaskAssignedToUser(t, selectedUserObj);
  });

  // Calculate Remaining Hrs for each task
  const reportRows = matchingTasks.map(t => {
    const estHrs = Number(t.estimatedHours) || 0;

    // Find subtasks of this task
    const subtasks = allTasks.filter(st => st.parentId === t.id);
    const subtaskIds = subtasks.map(s => s.id);
    const relevantTaskIds = [t.id, ...subtaskIds];

    // Total worklog hours spent on this task and its subtasks
    const loggedHrs = allWorklogs
      .filter(w => relevantTaskIds.includes(w.taskId))
      .reduce((sum, w) => sum + (Number(w.hoursWorked) || 0), 0);

    const remainingHrs = Math.max(0, estHrs - loggedHrs);

    return {
      taskObj: t,
      id: t.id,
      title: t.title || 'Untitled Task',
      status: t.status || 'To Do',
      estimatedHours: estHrs,
      loggedHours: loggedHrs,
      remainingHours: remainingHrs
    };
  });

  const totalTasksCount = reportRows.length;
  const totalRemainingHours = reportRows.reduce((sum, r) => sum + r.remainingHours, 0);

  const handleExport = () => {
    const name = (selectedUserName || 'user').replace(/[^a-zA-Z0-9]/g, '_');
    downloadCSV(
      `daily-load-individual-${name}.csv`,
      ['TASK', 'STATUS', 'ESTIMATED HRS', 'TIMESPENT HRS', 'REMAINING HRS'],
      reportRows.map(r => [r.title, r.status, r.estimatedHours.toFixed(1), r.loggedHours.toFixed(1), r.remainingHours.toFixed(1)])
    );
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '0.75rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0f172a', margin: 0, flex: 1, minWidth: 0 }}>
          Daily Load - Individual{selectedUserName ? ` — ${selectedUserName}` : ''}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexShrink: 0 }}>
          <button
            onClick={handleExport}
            disabled={reportRows.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.45rem 1.1rem',
              background: 'white',
              color: reportRows.length === 0 ? '#94a3b8' : '#2563eb',
              border: `1.5px solid ${reportRows.length === 0 ? '#e2e8f0' : '#2563eb'}`,
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: reportRows.length === 0 ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <select
          value={selectedUserId}
          onChange={e => setSelectedUserId(e.target.value)}
          style={{
            padding: '0.45rem 1.6rem 0.45rem 0.75rem',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: '500',
            color: '#64748b',
            background: 'white',
            appearance: 'none',
            WebkitAppearance: 'none',
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.45rem center',
            minWidth: '220px'
          }}
        >
          <option value="all" style={{ color: '#475569' }}>All Member</option>
          {users.map(u => {
            const name = u.fullName || u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
            return <option key={u.id} value={u.id} style={{ color: '#475569' }}>{name}</option>;
          })}
        </select>
      </div>

      {/* Summary KPI cards */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.75rem 1.5rem', minWidth: '130px' }}>
          <span style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', whiteSpace: 'nowrap' }}>Tasks #</span>
          <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{totalTasksCount}</span>
        </div>
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '0.75rem 1.5rem', minWidth: '160px' }}>
          <span style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', whiteSpace: 'nowrap' }}>Total Remaining Hrs</span>
          <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{totalRemainingHours.toFixed(1)}h</span>
        </div>
      </div>

      {/* Report Table */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>Loading report data...</div>
      ) : reportRows.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '3rem', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          No pending tasks in 'To Do' or 'In Progress' status for this user.
        </div>
      ) : (
        <div className="reports-table-container" style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Desktop View */}
          <div className="desktop-table-view">
            <table className="reports-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '40%' }}>TASK</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '15%' }}>STATUS</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '15%', textAlign: 'right' }}>ESTIMATED HRS</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '15%', textAlign: 'right' }}>TIMESPENT HRS</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '15%', textAlign: 'right' }}>REMAINING HRS</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map(row => {
                  const meta = STATUS_HEADER_META[row.status] || { bg: '#f1f5f9', fg: '#475569' };
                  return (
                    <tr
                      key={row.id}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: onTaskClick ? 'pointer' : 'default', transition: 'background 0.15s' }}
                      onClick={() => onTaskClick && onTaskClick(row.taskObj)}
                    >
                      <td style={{ padding: '0.85rem 1.25rem', fontWeight: '600', color: '#0f172a', fontSize: '0.875rem' }}>
                        {row.title}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <span
                          style={{
                            background: meta.bg,
                            color: meta.fg,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            display: 'inline-block'
                          }}
                        >
                          {row.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: '600', color: '#475569', fontSize: '0.875rem' }}>
                        {row.estimatedHours.toFixed(1)}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: '600', color: '#475569', fontSize: '0.875rem' }}>
                        {row.loggedHours.toFixed(1)}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: '700', color: '#2563eb', fontSize: '0.9rem' }}>
                        {row.remainingHours.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="mobile-cards-view" style={{ padding: '1rem', background: '#fafbfc' }}>
            {reportRows.map(row => {
              const meta = STATUS_HEADER_META[row.status] || { bg: '#f1f5f9', fg: '#475569' };
              return (
                <div
                  key={row.id}
                  className="reports-mobile-card"
                  onClick={() => onTaskClick && onTaskClick(row.taskObj)}
                  style={{ cursor: onTaskClick ? 'pointer' : 'default' }}
                >
                  <div className="reports-mobile-card-header">
                    <span className="reports-mobile-card-title" style={{ fontSize: '0.92rem', fontWeight: '700', color: '#0f172a' }}>
                      {row.title}
                    </span>
                    <span style={{ fontSize: '0.68rem', fontWeight: '700', padding: '0.2rem 0.5rem', borderRadius: '5px', background: meta.bg, color: meta.fg, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {row.status}
                    </span>
                  </div>
                  <div className="reports-mobile-card-body">
                    <div className="reports-mobile-card-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                      <div className="reports-mobile-card-grid-item">
                        <span className="reports-mobile-card-grid-label">Estimated Hrs</span>
                        <span className="reports-mobile-card-grid-value" style={{ color: '#475569' }}>
                          {row.estimatedHours.toFixed(1)}
                        </span>
                      </div>
                      <div className="reports-mobile-card-grid-item">
                        <span className="reports-mobile-card-grid-label">Timespent Hrs</span>
                        <span className="reports-mobile-card-grid-value" style={{ color: '#475569' }}>
                          {row.loggedHours.toFixed(1)}
                        </span>
                      </div>
                      <div className="reports-mobile-card-grid-item">
                        <span className="reports-mobile-card-grid-label">Remaining Hrs</span>
                        <span className="reports-mobile-card-grid-value" style={{ color: '#2563eb' }}>
                          {row.remainingHours.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
