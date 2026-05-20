import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../../api/client';
import './Reports.css';

const formatTime = (hours) => {
  if (!hours) return '00:00';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const generateRecentWeeks = () => {
  const weeks = [];
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 is Sunday, 5 is Friday
  
  let diff = 5 - dayOfWeek;
  if (diff > 0) diff -= 7;
  
  let endFriday = new Date(today);
  endFriday.setDate(today.getDate() + diff);
  endFriday.setHours(23, 59, 59, 999);

  for (let i = 0; i < 10; i++) {
    const end = new Date(endFriday);
    end.setDate(endFriday.getDate() - (i * 7));
    
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const formatDate = (d) => {
      const day = d.getDate().toString().padStart(2, '0');
      const month = d.toLocaleString('default', { month: 'short' });
      const year = d.getFullYear();
      return `${day} ${month} ${year}`;
    };
    const label = `${formatDate(start)} (Sat) - ${formatDate(end)} (Fri)`;
    
    weeks.push({
      label,
      startDate: start.toISOString(),
      endDate: end.toISOString()
    });
  }
  return weeks;
};

export default function Reports({ user }) {
  const [reportType, setReportType] = useState('monthly'); // 'monthly' | 'weekly'
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const weeks = useMemo(() => generateRecentWeeks(), []);
  const [selectedWeek, setSelectedWeek] = useState(weeks[0]?.startDate);

  const [selectedProject, setSelectedProject] = useState('All Projects');
  const [selectedAssignee, setSelectedAssignee] = useState('All Assignees');
  
  const [projects, setProjects] = useState([]);
  const [assignees, setAssignees] = useState([]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      let data;
      if (reportType === 'monthly') {
        const params = new URLSearchParams({
          month: selectedMonth,
          year: selectedYear,
          project: selectedProject,
          assignee: selectedAssignee
        });
        data = await api.get(`/reports/monthly?${params.toString()}`);
      } else {
        const week = weeks.find(w => w.startDate === selectedWeek);
        if (week) {
          const params = new URLSearchParams({
            startDate: week.startDate,
            endDate: week.endDate,
            project: selectedProject,
            assignee: selectedAssignee
          });
          data = await api.get(`/reports/range?${params.toString()}`);
        } else {
          data = [];
        }
      }
      setTasks(data || []);
      
      if (projects.length === 0) {
        const [projectsData, usersData] = await Promise.all([
          api.get('/projects'),
          api.get('/users')
        ]);
        setProjects(projectsData || []);
        setAssignees(usersData || []);
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
  }, [reportType, selectedMonth, selectedYear, selectedWeek]);

  const totalTasks = tasks.length;
  const totalBillableHours = tasks.reduce((sum, t) => sum + (parseFloat(t.actualHours) || parseFloat(t.approvedHours) || 0), 0);
  
  const uniqueProjects = useMemo(() => {
    const projNames = new Set(tasks.map(t => t.projectName).filter(Boolean));
    return projNames.size;
  }, [tasks]);

  const uniqueAssignees = useMemo(() => {
    const assigns = new Set(tasks.flatMap(t => (t.assignees || '').split(',').map(s => s.trim()).filter(Boolean)));
    return assigns.size;
  }, [tasks]);

  const handleApplyFilter = () => {
    fetchReports();
  };

  const handleExport = () => {
    const headers = ['Task # No', 'Title', 'Project', 'Assignee', 'Billable Hours', 'Delivered Date'];
    const rows = tasks.map(t => [
      t.taskNo || '-',
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.projectName || '-').replace(/"/g, '""')}"`,
      `"${(t.assignees || '-').replace(/"/g, '""')}"`,
      formatTime(parseFloat(t.actualHours) || parseFloat(t.approvedHours) || 0),
      t.deliveredDate ? new Date(t.deliveredDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = reportType === 'monthly' ? `Monthly_Report_${selectedYear}_${selectedMonth}.csv` : `Weekly_Report.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const months = [
    { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
    { value: 4, label: 'Apr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
    { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' }, { value: 9, label: 'Sep' },
    { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  if (user?.role?.toLowerCase() !== 'admin') {
    return <div className="reports-container"><h3>Access Denied. Only Admins can view reports.</h3></div>;
  }

  return (
    <div className="reports-container">
      <div className="reports-header-section">
        <div className="reports-title-area">
          <div className="reports-icon-wrapper">
             <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>
          <div className="reports-title-text">
            <h2>{reportType === 'monthly' ? 'Monthly Report' : 'Weekly Report'}</h2>
            <p>
              {reportType === 'monthly' 
                ? 'View delivered tasks summary for the selected month.'
                : 'View delivered tasks summary for each week (Saturday to Friday).'}
            </p>
          </div>
        </div>
        
        <div className="reports-actions">
          <div className="report-type-toggle">
            <button 
              className={reportType === 'monthly' ? 'active' : ''} 
              onClick={() => setReportType('monthly')}
            >
              Monthly
            </button>
            <button 
              className={reportType === 'weekly' ? 'active' : ''} 
              onClick={() => setReportType('weekly')}
            >
              Weekly
            </button>
          </div>

          <button className="reports-export-btn" onClick={handleExport}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Export
          </button>
        </div>
      </div>

      <div className="reports-filters-bar">
        <div className="reports-filter-left">
          <button className="reports-nav-btn">←</button>
          <div className="reports-date-selector">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#2563eb" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            {reportType === 'monthly' ? (
              <>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                  {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <span>,</span>
                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            ) : (
              <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} style={{ minWidth: '220px' }}>
                {weeks.map(w => <option key={w.startDate} value={w.startDate}>{w.label}</option>)}
              </select>
            )}
          </div>
        </div>
        <div className="reports-filter-right">
          <select className="reports-select" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
            <option value="All Projects">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <select className="reports-select" value={selectedAssignee} onChange={e => setSelectedAssignee(e.target.value)}>
            <option value="All Assignees">All Assignees</option>
            {assignees.map(u => <option key={u.id} value={u.fullName || `${u.firstName || ''} ${u.lastName || ''}`}>{u.fullName || `${u.firstName || ''} ${u.lastName || ''}`}</option>)}
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
            <span className="kpi-label">Total Delivered Tasks</span>
            <span className="kpi-value">{totalTasks}</span>
          </div>
        </div>
        <div className="reports-kpi-card">
          <div className="kpi-icon-wrapper green">
             <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Billable Hours</span>
            <span className="kpi-value">{formatTime(totalBillableHours)} hrs</span>
          </div>
        </div>
        <div className="reports-kpi-card">
          <div className="kpi-icon-wrapper purple">
             <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">{reportType === 'monthly' ? 'Total Projects' : 'Total Projects Delivered'}</span>
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

      <div className="reports-info-banner">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        This report shows only delivered tasks for the selected {reportType === 'monthly' ? 'month' : 'week'}.
      </div>

      <div className="reports-table-container">
        {loading ? (
          <div className="reports-loading">Loading...</div>
        ) : (
          <table className="reports-table">
            <thead>
              <tr>
                <th>Task # No</th>
                <th>Title</th>
                <th>Project</th>
                <th>Assignee</th>
                <th>Billable Hours</th>
                <th>Delivered Date</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id}>
                  <td>{task.taskNo || '-'}</td>
                  <td className="task-title-cell">{task.title}</td>
                  <td>{task.projectName || '-'}</td>
                  <td>
                    <div className="assignee-cell">
                      <div className="assignee-avatar">
                        {task.assignees ? task.assignees.charAt(0).toUpperCase() : '?'}
                      </div>
                      {task.assignees || 'Unassigned'}
                    </div>
                  </td>
                  <td>{formatTime(parseFloat(task.actualHours) || parseFloat(task.approvedHours) || 0)}</td>
                  <td>{task.deliveredDate ? new Date(task.deliveredDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan="6" className="no-data-cell">No tasks delivered in this period.</td>
                </tr>
              )}
            </tbody>
            {tasks.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan="4" className="footer-total-label">Total</td>
                  <td className="footer-total-hours">{formatTime(totalBillableHours)} hrs</td>
                  <td className="footer-total-tasks">{totalTasks}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      <div className="reports-bottom-note">
        <div className="note-icon">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#eab308" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <div className="note-content">
          <span className="note-title">Note</span>
          {reportType === 'monthly' ? (
            <span className="note-text">Monthly report includes only tasks delivered within the selected month only.</span>
          ) : (
            <div className="note-text" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span>• Only tasks with "Delivered" status are included in this weekly report.</span>
              <span>• Weekly period is calculated from Saturday to Friday.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
