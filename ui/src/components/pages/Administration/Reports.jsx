import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../../api/client';
import './Reports.css';
import { usePermissions } from '../../../hooks/usePermissions';

const formatDecimal = (hours) => {
  if (hours === undefined || hours === null) return '0.0';
  return Number(hours).toFixed(1);
};

const getDisplayId = (task) => {
  if (!task) return '-';
  const taskNo = task.taskNo;
  const parentId = task.parentId;
  const taskType = task.taskType;
  if (!taskNo) return '-';
  const digits = taskNo.replace(/\D/g, '');
  if (parentId) return 'S' + digits;
  
  let prefix = 'T';
  const type = (taskType || '').toLowerCase();
  if (type === 'bug') prefix = 'B';
  else if (type === 'calls/meetings') prefix = 'C';
  else if (taskNo && /^[A-Za-z]/.test(taskNo) && !taskNo.startsWith('TSK-')) {
    prefix = taskNo.charAt(0).toUpperCase();
  }
  return prefix + digits;
};

const getWeekRange = (dateStr) => {
  const date = new Date(dateStr);
  const day = date.getDay(); // 0 is Sunday, 1 is Monday, etc.
  
  // Calculate difference to Monday
  // If Sunday (0), we want to subtract 6 days.
  // If Monday (1), subtract 0 days.
  // If Tuesday (2), subtract 1 day, etc.
  const diffToMonday = day === 0 ? -6 : 1 - day;
  
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return {
    monday: monday.toISOString().split('T')[0],
    sunday: sunday.toISOString().split('T')[0],
    mondayDate: monday,
    sundayDate: sunday
  };
};

export default function Reports({ user, onNavigateToTask }) {
  const [reportType, setReportType] = useState('daily'); // 'daily' | 'weekly' | 'monthly' | 'custom'
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedDailyDate, setSelectedDailyDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth]         = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear]           = useState(new Date().getFullYear());
  const [selectedWeekDate, setSelectedWeekDate]   = useState(new Date().toISOString().split('T')[0]);

  const [customStartDate, setCustomStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate]     = useState(new Date().toISOString().split('T')[0]);

  const [selectedProject, setSelectedProject] = useState('All Projects');
  const [selectedAssignee, setSelectedAssignee] = useState('All Assignees');
  const [selectedClient, setSelectedClient] = useState('All Clients');
  
  const [projects, setProjects] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [clients, setClients] = useState([]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      let data;
      const common = { project: selectedProject, assignee: selectedAssignee, client: selectedClient };

      if (reportType === 'daily') {
        const start = new Date(selectedDailyDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(selectedDailyDate);
        end.setHours(23, 59, 59, 999);
        const params = new URLSearchParams({ startDate: start.toISOString(), endDate: end.toISOString(), ...common });
        data = await api.get(`/reports/range?${params.toString()}`);
      } else if (reportType === 'monthly') {
        const params = new URLSearchParams({ month: selectedMonth, year: selectedYear, ...common });
        data = await api.get(`/reports/monthly?${params.toString()}`);
      } else if (reportType === 'weekly') {
        const range = getWeekRange(selectedWeekDate);
        const params = new URLSearchParams({
          startDate: new Date(range.monday).toISOString(),
          endDate:   new Date(new Date(range.sunday).setHours(23, 59, 59, 999)).toISOString(),
          ...common,
        });
        data = await api.get(`/reports/range?${params.toString()}`);
      } else {
        if (customStartDate && customEndDate) {
          const params = new URLSearchParams({
            startDate: new Date(customStartDate).toISOString(),
            endDate:   new Date(new Date(customEndDate).setHours(23, 59, 59, 999)).toISOString(),
            ...common,
          });
          data = await api.get(`/reports/range?${params.toString()}`);
        } else {
          data = [];
        }
      }
      setTasks(data || []);
      
      if (projects.length === 0) {
        const [projectsData, usersData, clientsData] = await Promise.all([
          api.get('/projects'),
          api.get('/users'),
          api.get('/clients')
        ]);
        setProjects(projectsData || []);
        setAssignees(usersData || []);
        const sortedClients = (clientsData || []).sort((a, b) => {
          const nameA = (a.company || a.name || '').toLowerCase();
          const nameB = (b.company || b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        setClients(sortedClients);
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, selectedDailyDate, selectedMonth, selectedYear, customStartDate, customEndDate, selectedClient, selectedWeekDate]);

  const totalTasks = tasks.length;
  const totalApprovedHours = tasks.reduce((sum, t) => sum + (parseFloat(t.taskApprovedHours) || 0), 0);
  const totalActualHours = tasks.reduce((sum, t) => sum + (parseFloat(t.taskActualHours) || 0), 0);
  
  const uniqueProjects = useMemo(() => {
    const projNames = new Set(tasks.map(t => t.projectName || projects.find(p => p.id === t.projectId)?.name).filter(Boolean));
    return projNames.size;
  }, [tasks, projects]);

  const uniqueAssignees = useMemo(() => {
    const assigns = new Set(tasks.flatMap(t => (t.assignees || '').split(',').map(s => s.trim()).filter(Boolean)));
    return assigns.size;
  }, [tasks]);

  const handleApplyFilter = () => {
    fetchReports();
  };

  const handleExport = () => {
    const headers = ['TASK # NO', 'TITLE', 'PROJECT', 'ASSIGNEE', 'TIME SPENT HRS', 'BILLABLE HRS', 'ALREADY BILLED', 'DELIVERED DATE'];
    const rows = tasks.map(t => {
      const resolvedProj = t.projectName || (projects.find(p => p.id === t.projectId)?.name) || '-';
      
      let resolvedAssignee = 'Unassigned';
      if (t.assignees) {
        const ids = t.assignees.split(',').map(id => id.trim()).filter(Boolean);
        const names = ids.map(id => {
          const u = assignees.find(user => user.id === id);
          return u ? (u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim()) : id;
        });
        resolvedAssignee = names.join(', ');
      }

      return [
        getDisplayId(t),
        `"${(t.title || '').replace(/"/g, '""')}"`,
        `"${resolvedProj.replace(/"/g, '""')}"`,
        `"${resolvedAssignee.replace(/"/g, '""')}"`,
        formatDecimal(parseFloat(t.timeSpent) || 0),
        formatDecimal(parseFloat(t.taskApprovedHours) || 0),
        formatDecimal(parseFloat(t.taskActualHours) || 0),
        t.deliveredDate ? new Date(t.deliveredDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'
      ];
    });
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    let downloadFilename;
    if (reportType === 'daily') {
      downloadFilename = `Daily_Report_${selectedDailyDate}.csv`;
    } else if (reportType === 'monthly') {
      downloadFilename = `Monthly_Report_${selectedYear}_${selectedMonth}.csv`;
    } else if (reportType === 'weekly') {
      const range = getWeekRange(selectedWeekDate);
      downloadFilename = `Weekly_Report_${range.monday}_to_${range.sunday}.csv`;
    } else {
      downloadFilename = `Custom_Report_${customStartDate}_to_${customEndDate}.csv`;
    }
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  const months = [
    { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
    { value: 4, label: 'Apr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
    { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' }, { value: 9, label: 'Sep' },
    { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const { canReport } = usePermissions();

  if (!canReport('tasks-report') && user?.role?.toLowerCase() !== 'admin') {
    return <div className="reports-container"><h3>Access Denied. You do not have permission to view reports.</h3></div>;
  }

  if (loading) return <div className="loading-screen">Loading Reports...</div>;

  return (
    <div className="reports-container">
      <div className="reports-header-section">
        <div className="reports-title-area"></div>

        <div className="reports-actions">
          <div className="report-type-toggle">
            <button className={reportType === 'daily'   ? 'active' : ''} onClick={() => setReportType('daily')}>Daily</button>
            <button className={reportType === 'weekly'  ? 'active' : ''} onClick={() => setReportType('weekly')}>Weekly</button>
            <button className={reportType === 'monthly' ? 'active' : ''} onClick={() => setReportType('monthly')}>Monthly</button>
            <button className={reportType === 'custom'  ? 'active' : ''} onClick={() => setReportType('custom')}>Custom</button>
          </div>

          <button className="reports-export-btn" onClick={handleExport}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Export
          </button>
        </div>
      </div>

      <div className="reports-filters-bar">
        <div className="reports-filter-left">
          <button className="reports-nav-btn" onClick={() => {
            if (reportType === 'daily') {
              const d = new Date(selectedDailyDate); d.setDate(d.getDate() - 1);
              setSelectedDailyDate(d.toISOString().split('T')[0]);
            } else if (reportType === 'monthly') {
              if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(selectedYear - 1); }
              else setSelectedMonth(selectedMonth - 1);
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
            {reportType === 'daily' ? (
              <input type="date" value={selectedDailyDate} onChange={e => setSelectedDailyDate(e.target.value)} style={{ padding: '0.25rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
            ) : reportType === 'monthly' ? (
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
                  {(() => {
                    const range = getWeekRange(selectedWeekDate);
                    const opt = { day: '2-digit', month: 'short', year: 'numeric' };
                    return `${range.mondayDate.toLocaleDateString('en-US', opt)} - ${range.sundayDate.toLocaleDateString('en-US', opt)}`;
                  })()}
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

          {/* Forward arrow — not shown for custom (no natural next range) */}
          {reportType !== 'custom' && (
            <button className="reports-nav-btn" onClick={() => {
              if (reportType === 'daily') {
                const d = new Date(selectedDailyDate); d.setDate(d.getDate() + 1);
                setSelectedDailyDate(d.toISOString().split('T')[0]);
              } else if (reportType === 'monthly') {
                if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(selectedYear + 1); }
                else setSelectedMonth(selectedMonth + 1);
              } else if (reportType === 'weekly') {
                const d = new Date(selectedWeekDate); d.setDate(d.getDate() + 7);
                setSelectedWeekDate(d.toISOString().split('T')[0]);
              }
            }}>→</button>
          )}
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
          <button className="reports-apply-btn" onClick={handleApplyFilter}>Apply Filter</button>
        </div>
      </div>

      <div className="reports-kpi-grid">
        <div className="reports-kpi-card">
          <div className="kpi-icon-wrapper blue">
             <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Delivered Tasks</span>
            <span className="kpi-value">{totalTasks}</span>
          </div>
        </div>

        <div className="reports-kpi-card">
          <div className="kpi-icon-wrapper purple">
             <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">{reportType === 'monthly' ? 'Projects' : 'Projects Delivered'}</span>
            <span className="kpi-value">{uniqueProjects}</span>
          </div>
        </div>
        <div className="reports-kpi-card">
          <div className="kpi-icon-wrapper orange">
             <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-3-3.87"></path><path d="M4 21v-2a4 4 0 0 1 3-3.87"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Assignees</span>
            <span className="kpi-value">{uniqueAssignees}</span>
          </div>
        </div>
      </div>



      <div className="reports-table-container">
        {/* Desktop View */}
        <div className="desktop-table-view">
          <table className="reports-table">
            <thead>
              <tr>
                <th>TASK # NO</th>
                <th>TITLE</th>
                <th>PROJECT</th>
                <th>ASSIGNEE</th>
                <th>TIME SPENT HRS</th>
                <th>BILLABLE HRS</th>
                <th>ALREADY BILLED</th>
                <th>DELIVERED DATE</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id}>
                  <td>{getDisplayId(task)}</td>
                  <td className="task-title-cell">
                    <span
                      style={{ color: '#2563eb', cursor: 'pointer', fontWeight: '600' }}
                      onClick={() => onNavigateToTask && onNavigateToTask(task)}
                    >
                      {task.title}
                    </span>
                  </td>
                  <td>{task.projectName || (projects.find(p => p.id === task.projectId)?.name) || '-'}</td>
                  <td>
                    {(() => {
                      if (!task.assignees) return <span>Unassigned</span>;
                      const ids = task.assignees.split(',').map(id => id.trim()).filter(Boolean);
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {ids.map(id => {
                            const uObj = assignees.find(u => u.id === id);
                            const dispName = uObj ? (uObj.fullName || `${uObj.firstName || ''} ${uObj.lastName || ''}`.trim() || 'Unknown') : id;
                            return <span key={id}>{dispName}</span>;
                          })}
                        </div>
                      );
                    })()}
                  </td>
                  <td>{formatDecimal(parseFloat(task.timeSpent) || 0)}</td>
                  <td>{formatDecimal(parseFloat(task.taskApprovedHours) || 0)}</td>
                  <td>{formatDecimal(parseFloat(task.taskActualHours) || 0)}</td>
                  <td>{task.deliveredDate ? new Date(task.deliveredDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan="8" className="no-data-cell" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', fontSize: '0.95rem' }}>No tasks delivered in this period.</td>
                </tr>
              )}
            </tbody>
            {tasks.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan="5" className="footer-total-label">Total</td>
                  <td className="footer-total-hours">{formatDecimal(totalApprovedHours)} hrs</td>
                  <td className="footer-total-hours">{formatDecimal(totalActualHours)} hrs</td>
                  <td className="footer-total-tasks">{totalTasks} tasks</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile View */}
        <div className="mobile-cards-view">
          {tasks.map(task => {
            const displayId = getDisplayId(task);
            const projName = task.projectName || (projects.find(p => p.id === task.projectId)?.name) || '-';
            const deliveredStr = task.deliveredDate ? new Date(task.deliveredDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
            
            let assigneeNode;
            if (!task.assignees) {
              assigneeNode = 'Unassigned';
            } else {
              const ids = task.assignees.split(',').map(id => id.trim()).filter(Boolean);
              assigneeNode = ids.map(id => {
                const uObj = assignees.find(u => u.id === id);
                return uObj ? (uObj.fullName || `${uObj.firstName || ''} ${uObj.lastName || ''}`.trim()) : id;
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
                    <span className="reports-mobile-card-label">Delivered:</span>
                    <span className="reports-mobile-card-value">{deliveredStr}</span>
                  </div>
                  
                  <div className="reports-mobile-card-grid">
                    <div className="reports-mobile-card-grid-item">
                      <span className="reports-mobile-card-grid-label">TimeSpent</span>
                      <span className="reports-mobile-card-grid-value" style={{ color: '#2563eb' }}>
                        {formatDecimal(parseFloat(task.timeSpent) || 0)}h
                      </span>
                    </div>
                    <div className="reports-mobile-card-grid-item">
                      <span className="reports-mobile-card-grid-label">Billable</span>
                      <span className="reports-mobile-card-grid-value">
                        {formatDecimal(parseFloat(task.taskApprovedHours) || 0)}h
                      </span>
                    </div>
                    <div className="reports-mobile-card-grid-item">
                      <span className="reports-mobile-card-grid-label">Billed</span>
                      <span className="reports-mobile-card-grid-value">
                        {formatDecimal(parseFloat(task.taskActualHours) || 0)}h
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {tasks.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b', fontSize: '0.9rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              No tasks delivered in this period.
            </div>
          )}

          {tasks.length > 0 && (
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: '700', color: '#475569' }}>Total Billable:</span>
                <span style={{ fontWeight: '800', color: '#0f172a' }}>{formatDecimal(totalApprovedHours)} hrs</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: '700', color: '#475569' }}>Total Billed:</span>
                <span style={{ fontWeight: '800', color: '#0f172a' }}>{formatDecimal(totalActualHours)} hrs</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
                <span style={{ fontWeight: '700', color: '#475569' }}>Total Delivered:</span>
                <span style={{ fontWeight: '800', color: '#2563eb' }}>{totalTasks} tasks</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
