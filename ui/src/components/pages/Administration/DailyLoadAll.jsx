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

export default function DailyLoadAll({ onUserClick }) {
  const [users, setUsers] = useState([]);
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
        setUsers(userData || []);
        setAllTasks(taskData || []);
        setAllWorklogs(worklogData || []);
      } catch (err) {
        console.error('Error fetching Daily Load All report data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter all Non-Admin users and sort by employee name in ascending order (A-Z)
  const nonAdminUsers = users
    .filter(u => (u.role || '').toLowerCase().trim() !== 'admin')
    .sort((a, b) => {
      const nameA = a.fullName || a.name || `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.email || '';
      const nameB = b.fullName || b.name || `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.email || '';
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });

  // Compute stats for each non-admin user
  const reportRows = nonAdminUsers.map(u => {
    const userName = u.fullName || u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Unknown';

    // Tasks assigned to user with status 'To Do' or 'In Progress'
    const matchingTasks = allTasks.filter(t => {
      const st = (t.status || '').toLowerCase().trim();
      const isTargetStatus = st === 'to do' || st === 'in progress';
      return isTargetStatus && isTaskAssignedToUser(t, u);
    });

    // Calculate total remaining hours for these tasks
    let userRemainingHrs = 0;
    matchingTasks.forEach(t => {
      const estHrs = Number(t.estimatedHours) || 0;
      const subtasks = allTasks.filter(st => st.parentId === t.id);
      const subtaskIds = subtasks.map(s => s.id);
      const relevantTaskIds = [t.id, ...subtaskIds];

      const loggedHrs = allWorklogs
        .filter(w => relevantTaskIds.includes(w.taskId))
        .reduce((sum, w) => sum + (Number(w.hoursWorked) || 0), 0);

      userRemainingHrs += Math.max(0, estHrs - loggedHrs);
    });

    return {
      userObj: u,
      userId: u.id,
      userName,
      role: u.role || 'Employee',
      tasksCount: matchingTasks.length,
      remainingHours: userRemainingHrs
    };
  });

  const totalUsersCount = nonAdminUsers.length;
  const totalTasksCount = reportRows.reduce((sum, r) => sum + r.tasksCount, 0);
  const totalRemainingHours = reportRows.reduce((sum, r) => sum + r.remainingHours, 0);

  const handleExport = () => {
    downloadCSV(
      `daily-load-all.csv`,
      ['User Name', 'Role', 'Tasks #', 'Remaining Hrs'],
      reportRows.map(r => [r.userName, r.role, r.tasksCount, r.remainingHours.toFixed(1)])
    );
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '0.75rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0f172a', margin: 0, flex: 1, minWidth: 0 }}>
          Daily Load - All
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

      {/* Summary KPI cards */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem 1.5rem', minWidth: '120px' }}>
          <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', whiteSpace: 'nowrap' }}>Users #</span>
          <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{totalUsersCount}</span>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.75rem 1.5rem', minWidth: '140px' }}>
          <span style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', whiteSpace: 'nowrap' }}>Total Tasks #</span>
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
          No non-admin users found in the system.
        </div>
      ) : (
        <div className="reports-table-container" style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Desktop View */}
          <div className="desktop-table-view">
            <table className="reports-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '50%' }}>USER NAME</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '25%', textAlign: 'center' }}>TASKS #</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '25%', textAlign: 'right' }}>REMAINING HRS</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map(row => (
                  <tr
                    key={row.userId}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: onUserClick ? 'pointer' : 'default', transition: 'background 0.15s' }}
                    onClick={() => onUserClick && onUserClick(row.userId)}
                    className="reports-table-row-hover"
                  >
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: '600', color: '#2563eb', fontSize: '0.875rem' }}>
                      {row.userName}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center', fontWeight: '700', color: '#64748b', fontSize: '0.9rem' }}>
                      {row.tasksCount}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: '700', color: '#059669', fontSize: '0.9rem' }}>
                      {row.remainingHours.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="mobile-cards-view" style={{ padding: '1rem', background: '#fafbfc' }}>
            {reportRows.map(row => (
              <div
                key={row.userId}
                className="reports-mobile-card"
                onClick={() => onUserClick && onUserClick(row.userId)}
                style={{ cursor: onUserClick ? 'pointer' : 'default' }}
              >
                <div className="reports-mobile-card-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                  <span className="reports-mobile-card-title" style={{ color: '#2563eb', fontSize: '1rem', fontWeight: '700' }}>
                    {row.userName}
                  </span>
                </div>
                <div className="reports-mobile-card-body">
                  <div className="reports-mobile-card-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="reports-mobile-card-grid-item">
                      <span className="reports-mobile-card-grid-label">Tasks Count</span>
                      <span className="reports-mobile-card-grid-value" style={{ color: '#64748b' }}>
                        {row.tasksCount}
                      </span>
                    </div>
                    <div className="reports-mobile-card-grid-item">
                      <span className="reports-mobile-card-grid-label">Remaining Hrs</span>
                      <span className="reports-mobile-card-grid-value" style={{ color: '#059669' }}>
                        {row.remainingHours.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
