import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../../api/client';
import './Reports.css';
import { usePermissions } from '../../../hooks/usePermissions';

const formatDecimal = (hours) => {
  if (hours === undefined || hours === null) return '0.0';
  return Number(hours).toFixed(1);
};

const getDisplayId = (taskNo, parentId) => {
  if (!taskNo) return '-';
  const digits = taskNo.replace(/\D/g, '');
  return (parentId ? 'S' : 'T') + digits;
};

const getWeekRange = (dateStr) => {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday: monday.toISOString().split('T')[0], sunday: sunday.toISOString().split('T')[0], mondayDate: monday, sundayDate: sunday };
};

const STATUS_STYLE = {
  'To Do':        { bg: '#f1f5f9', color: '#475569' },
  'In Progress':  { bg: '#dbeafe', color: '#1d4ed8' },
  'To Approved':  { bg: '#fef3c7', color: '#b45309' },
  'Approved':     { bg: '#d1fae5', color: '#065f46' },
  'Delivered':    { bg: '#dcfce7', color: '#166534' },
  'On Hold':      { bg: '#fee2e2', color: '#b91c1c' },
  'In Testing':   { bg: '#ede9fe', color: '#7c3aed' },
  'Prod Verified':{ bg: '#f0fdf4', color: '#15803d' },
};

const STATUSES = ['To Do', 'In Progress', 'To Approved', 'Approved', 'Delivered', 'On Hold', 'In Testing', 'Prod Verified'];

export default function ReportsStatusBased({ user, onNavigateToTask }) {
  const [reportType, setReportType] = useState('monthly');

  const [selectedMonth, setSelectedMonth]       = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear]         = useState(new Date().getFullYear());
  const [selectedWeekDate, setSelectedWeekDate] = useState(new Date().toISOString().split('T')[0]);
  const [customStartDate, setCustomStartDate]   = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);

  const [selectedProject,  setSelectedProject]  = useState('All Projects');
  const [selectedAssignee, setSelectedAssignee] = useState('All Assignees');
  const [selectedClient,   setSelectedClient]   = useState('All Clients');
  const [selectedStatus,   setSelectedStatus]   = useState('All');

  const [tasks,     setTasks]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [projects,  setProjects]  = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [clients,   setClients]   = useState([]);

  const { can } = usePermissions();

  const fetchData = async () => {
    setLoading(true);
    try {
      let data;
      if (reportType === 'monthly') {
        const params = new URLSearchParams({
          period: 'monthly',
          date: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`,
          project: selectedProject, assignee: selectedAssignee,
          client: selectedClient,   status: selectedStatus,
        });
        data = await api.get(`/reports/status-based?${params}`);
      } else if (reportType === 'weekly') {
        const params = new URLSearchParams({
          period: 'weekly', date: selectedWeekDate,
          project: selectedProject, assignee: selectedAssignee,
          client: selectedClient,   status: selectedStatus,
        });
        data = await api.get(`/reports/status-based?${params}`);
      } else {
        if (customStartDate && customEndDate) {
          const params = new URLSearchParams({
            period: 'custom',
            startDate: new Date(customStartDate).toISOString(),
            endDate:   new Date(new Date(customEndDate).setHours(23, 59, 59, 999)).toISOString(),
            project: selectedProject, assignee: selectedAssignee,
            client: selectedClient,   status: selectedStatus,
          });
          data = await api.get(`/reports/status-based?${params}`);
        } else {
          data = [];
        }
      }
      setTasks(data || []);

      if (projects.length === 0) {
        const [pData, uData, cData] = await Promise.all([
          api.get('/projects'), api.get('/users'), api.get('/clients')
        ]);
        setProjects(pData || []);
        setAssignees(uData || []);
        setClients((cData || []).sort((a, b) => (a.company || a.name || '').localeCompare(b.company || b.name || '')));
      }
    } catch (err) {
      console.error('Status-based report fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, selectedMonth, selectedYear, customStartDate, customEndDate, selectedWeekDate]);

  const totalTasks     = tasks.length;
  const totalTimeSpent = tasks.reduce((s, t) => s + (parseFloat(t.timeSpent)      || 0), 0);
  const totalBillable  = tasks.reduce((s, t) => s + (parseFloat(t.billableHours)  || 0), 0);
  const totalEstimated = tasks.reduce((s, t) => s + (parseFloat(t.estimatedHours) || 0), 0);

  const uniqueProjects = useMemo(() => new Set(tasks.map(t => t.projectName).filter(Boolean)).size, [tasks]);

  const uniqueAssignees = useMemo(() => {
    const set = new Set(tasks.flatMap(t => (t.assignees || '').split(',').map(s => s.trim()).filter(Boolean)));
    return set.size;
  }, [tasks]);

  const statusGroups = useMemo(() =>
    tasks.reduce((acc, t) => { const s = t.status || 'Unknown'; acc[s] = (acc[s] || 0) + 1; return acc; }, {}),
  [tasks]);

  const handleExport = () => {
    const headers = ['Task # No', 'Title', 'Project', 'Assignee', 'Time Spent', 'Billable hrs', 'Status', 'Estimated hrs'];
    const rows = tasks.map(t => {
      let resolvedAssignee = 'Unassigned';
      if (t.assignees) {
        const ids = t.assignees.split(',').map(id => id.trim()).filter(Boolean);
        resolvedAssignee = ids.map(id => {
          const u = assignees.find(u => u.id === id);
          return u ? (u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim()) : id;
        }).join(', ');
      }
      return [
        getDisplayId(t.taskNo, t.parentId),
        `"${(t.title || '').replace(/"/g, '""')}"`,
        `"${(t.projectName || '').replace(/"/g, '""')}"`,
        `"${resolvedAssignee.replace(/"/g, '""')}"`,
        formatDecimal(t.timeSpent),
        formatDecimal(t.billableHours),
        `"${t.status || ''}"`,
        formatDecimal(t.estimatedHours),
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Status_Report_${reportType}_${selectedYear}_${String(selectedMonth).padStart(2,'0')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => window.URL.revokeObjectURL(url), 100);
  };

  const months = [
    { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
    { value: 4, label: 'Apr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
    { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' }, { value: 9, label: 'Sep' },
    { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' }
  ];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  if (!can('reports', 'view') && user?.role?.toLowerCase() !== 'admin') {
    return <div className="reports-container"><h3>Access Denied. You do not have permission to view reports.</h3></div>;
  }

  if (loading) return <div className="loading-screen">Loading Status Report...</div>;

  return (
    <div className="reports-container">

      {/* ── Header ── */}
      <div className="reports-header-section">
        <div className="reports-title-area"></div>
        <div className="reports-actions">
          <div className="report-type-toggle">
            <button className={reportType === 'monthly' ? 'active' : ''} onClick={() => setReportType('monthly')}>Monthly</button>
            <button className={reportType === 'weekly'  ? 'active' : ''} onClick={() => setReportType('weekly')}>Weekly</button>
            <button className={reportType === 'custom'  ? 'active' : ''} onClick={() => setReportType('custom')}>Custom</button>
          </div>
          <button className="reports-export-btn" onClick={handleExport}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Export
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="reports-filters-bar">
        <div className="reports-filter-left">
          <button className="reports-nav-btn" onClick={() => {
            if (reportType === 'monthly') {
              if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
              else setSelectedMonth(m => m - 1);
            } else if (reportType === 'weekly') {
              const d = new Date(selectedWeekDate); d.setDate(d.getDate() - 7);
              setSelectedWeekDate(d.toISOString().split('T')[0]);
            } else {
              const start = new Date(customStartDate), end = new Date(customEndDate);
              const diff = end - start;
              const newEnd = new Date(start.getTime() - 1);
              setCustomStartDate(new Date(newEnd.getTime() - diff).toISOString().split('T')[0]);
              setCustomEndDate(newEnd.toISOString().split('T')[0]);
            }
          }}>←</button>

          <div className={`reports-date-selector reports-date-selector-${reportType}`}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#2563eb" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            {reportType === 'monthly' ? (
              <>
                <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                  {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <span>,</span>
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            ) : reportType === 'weekly' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input type="date" value={selectedWeekDate} onChange={e => setSelectedWeekDate(e.target.value)} style={{ padding: '0.25rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#1e293b', backgroundColor: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                  {(() => { const r = getWeekRange(selectedWeekDate); const o = { day:'2-digit', month:'short', year:'numeric' }; return `${r.mondayDate.toLocaleDateString('en-US',o)} - ${r.sundayDate.toLocaleDateString('en-US',o)}`; })()}
                </span>
              </div>
            ) : (
              <div className="reports-custom-date-range" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="reports-custom-date-input" style={{ padding: '0.25rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                <span style={{ color: '#64748b', flexShrink: 0 }}>to</span>
                <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="reports-custom-date-input" style={{ padding: '0.25rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
              </div>
            )}
          </div>
        </div>

        <div className="reports-filter-right">
          <select className="reports-select" value={selectedClient} onChange={e => setSelectedClient(e.target.value)}>
            <option value="All Clients">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
          </select>
          <select className="reports-select" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
            <option value="All Projects">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <select className="reports-select" value={selectedAssignee} onChange={e => setSelectedAssignee(e.target.value)}>
            <option value="All Assignees">All Assignees</option>
            {assignees.map(u => <option key={u.id} value={u.id}>{u.fullName || `${u.firstName || ''} ${u.lastName || ''}`}</option>)}
          </select>
          <select className="reports-select" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
            <option value="All">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="reports-apply-btn" onClick={fetchData}>Apply Filter</button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="reports-kpi-grid">
        <div className="reports-kpi-card">
          <div className="kpi-icon-wrapper blue">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Tasks</span>
            <span className="kpi-value">{totalTasks}</span>
          </div>
        </div>
        <div className="reports-kpi-card">
          <div className="kpi-icon-wrapper purple">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Projects</span>
            <span className="kpi-value">{uniqueProjects}</span>
          </div>
        </div>
        <div className="reports-kpi-card">
          <div className="kpi-icon-wrapper orange">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-3-3.87"></path><path d="M4 21v-2a4 4 0 0 1 3-3.87"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Assignees</span>
            <span className="kpi-value">{uniqueAssignees}</span>
          </div>
        </div>
      </div>

      {/* ── Status breakdown chips ── */}
      {Object.keys(statusGroups).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {Object.entries(statusGroups).map(([s, count]) => {
            const st = STATUS_STYLE[s] || { bg: '#f1f5f9', color: '#475569' };
            return (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.8rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: '500', background: st.bg, color: st.color }}>
                {s} <strong>{count}</strong>
              </span>
            );
          })}
        </div>
      )}

      {/* ── Table ── */}
      <div className="reports-table-container">
        {/* Desktop View */}
        <div className="desktop-table-view">
          <table className="reports-table">
            <thead>
              <tr>
                <th>TASK # NO</th>
                <th>TITLE</th>
                <th>STATUS</th>
                <th>PROJECT</th>
                <th>ASSIGNEE</th>
                <th>TIME SPENT HRS</th>
                <th>BILLABLE HRS</th>
                <th>ESTIMATED HRS</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => {
                const st = STATUS_STYLE[task.status] || { bg: '#f1f5f9', color: '#475569' };
                return (
                  <tr key={task.id}>
                    <td>{getDisplayId(task.taskNo, task.parentId)}</td>
                    <td className="task-title-cell">
                      <span
                        style={{ color: '#2563eb', cursor: 'pointer', fontWeight: '600' }}
                        onClick={() => onNavigateToTask && onNavigateToTask(task)}
                      >
                        {task.title}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-block', padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600', background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                        {task.status || '-'}
                      </span>
                    </td>
                    <td>{task.projectName || '-'}</td>
                    <td>
                      {(() => {
                        if (!task.assignees) return <span>Unassigned</span>;
                        const ids = task.assignees.split(',').map(id => id.trim()).filter(Boolean);
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {ids.map(id => {
                              const u = assignees.find(u => u.id === id);
                              return <span key={id}>{u ? (u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim()) : id}</span>;
                            })}
                          </div>
                        );
                      })()}
                    </td>
                    <td>{formatDecimal(task.timeSpent)}</td>
                    <td>{formatDecimal(task.billableHours)}</td>
                    <td>{formatDecimal(task.estimatedHours)}</td>
                  </tr>
                );
              })}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan="8" className="no-data-cell" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', fontSize: '0.95rem' }}>
                    No tasks found for this period.
                  </td>
                </tr>
              )}
            </tbody>
            {tasks.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan="5" className="footer-total-label">Total</td>
                  <td className="footer-total-hours">{formatDecimal(totalTimeSpent)} hrs</td>
                  <td className="footer-total-hours">{formatDecimal(totalBillable)} hrs</td>
                  <td className="footer-total-hours">{formatDecimal(totalEstimated)} hrs</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile View */}
        <div className="mobile-cards-view">
          {tasks.map(task => {
            const displayId = getDisplayId(task.taskNo, task.parentId);
            const st = STATUS_STYLE[task.status] || { bg: '#f1f5f9', color: '#475569' };
            const projName = task.projectName || '-';
            
            let assigneeNode;
            if (!task.assignees) {
              assigneeNode = 'Unassigned';
            } else {
              const ids = task.assignees.split(',').map(id => id.trim()).filter(Boolean);
              assigneeNode = ids.map(id => {
                const u = assignees.find(u => u.id === id);
                return u ? (u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim()) : id;
              }).join(', ');
            }

            return (
              <div key={task.id} className="reports-mobile-card">
                <div className="reports-mobile-card-header">
                  <span 
                    className="reports-mobile-card-id"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onNavigateToTask && onNavigateToTask(task)}
                  >
                    #{displayId}
                  </span>
                  <span className="reports-mobile-card-project">{projName}</span>
                </div>
                
                <h4 className="reports-mobile-card-title">{task.title}</h4>
                
                <div className="reports-mobile-card-body">
                  <div className="reports-mobile-card-row">
                    <span className="reports-mobile-card-label">Assignee:</span>
                    <span className="reports-mobile-card-value">{assigneeNode}</span>
                  </div>
                  <div className="reports-mobile-card-row">
                    <span className="reports-mobile-card-label">Status:</span>
                    <span style={{ display: 'inline-block', padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '600', background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                      {task.status || '-'}
                    </span>
                  </div>
                  
                  <div className="reports-mobile-card-grid">
                    <div className="reports-mobile-card-grid-item">
                      <span className="reports-mobile-card-grid-label">TimeSpent</span>
                      <span className="reports-mobile-card-grid-value" style={{ color: '#2563eb' }}>
                        {formatDecimal(task.timeSpent)}h
                      </span>
                    </div>
                    <div className="reports-mobile-card-grid-item">
                      <span className="reports-mobile-card-grid-label">Billable</span>
                      <span className="reports-mobile-card-grid-value">
                        {formatDecimal(task.billableHours)}h
                      </span>
                    </div>
                    <div className="reports-mobile-card-grid-item">
                      <span className="reports-mobile-card-grid-label">Estimated</span>
                      <span className="reports-mobile-card-grid-value">
                        {formatDecimal(task.estimatedHours)}h
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {tasks.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b', fontSize: '0.9rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              No tasks found for this period.
            </div>
          )}

          {tasks.length > 0 && (
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: '700', color: '#475569' }}>Total Time Spent:</span>
                <span style={{ fontWeight: '800', color: '#2563eb' }}>{formatDecimal(totalTimeSpent)} hrs</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: '700', color: '#475569' }}>Total Billable:</span>
                <span style={{ fontWeight: '800', color: '#0f172a' }}>{formatDecimal(totalBillable)} hrs</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: '700', color: '#475569' }}>Total Estimated:</span>
                <span style={{ fontWeight: '800', color: '#0f172a' }}>{formatDecimal(totalEstimated)} hrs</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
