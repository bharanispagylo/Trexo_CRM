import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../../api/client';
import './Reports.css';
import { usePermissions } from '../../../hooks/usePermissions';

const formatDecimal = (hours) => {
  const val = parseFloat(hours);
  if (isNaN(val) || val <= 0) return '0 hrs';
  const rounded = Math.round(val * 100) / 100;
  return `${rounded} hrs`;
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
  if (type === 'recurring task' || task.recurringTemplateId) prefix = 'R';
  else if (type === 'bug') prefix = 'B';
  else if (type === 'calls/meetings') prefix = 'C';
  else if (taskNo && /^[A-Za-z]/.test(taskNo) && !taskNo.startsWith('TSK-')) {
    prefix = taskNo.charAt(0).toUpperCase();
  }
  return prefix + digits;
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
  'Dev Verified':  { bg: '#e0f7fa', color: '#0891b2' },
  'Prod Verified':{ bg: '#f0fdf4', color: '#15803d' },
  'Not an issue': { bg: '#e2e8f0', color: '#64748b' },
};

const STATUSES = ['To Do', 'In Progress', 'To Approved', 'Approved', 'Delivered', 'On Hold', 'In Testing', 'Dev Verified', 'Prod Verified', 'Not an issue'];

export default function ReportsStatusBased({ 
  user, 
  onNavigateToTask,
  initialUserId,
  onClearInitialUser,
  initialFilter,
  onClearInitialFilter,
  initialDate,
  onClearInitialDate
}) {
  const [reportType, setReportType] = useState(initialFilter || 'daily');

  const [selectedDailyDate, setSelectedDailyDate] = useState(
    initialFilter === 'daily' && initialDate ? initialDate : new Date().toISOString().split('T')[0]
  );
  const [selectedMonth, setSelectedMonth]         = useState(
    initialFilter === 'monthly' && initialDate ? new Date(initialDate + 'T00:00:00').getMonth() + 1 : new Date().getMonth() + 1
  );
  const [selectedYear, setSelectedYear]           = useState(
    initialFilter === 'monthly' && initialDate ? new Date(initialDate + 'T00:00:00').getFullYear() : new Date().getFullYear()
  );
  const [selectedWeekDate, setSelectedWeekDate]   = useState(
    initialFilter === 'weekly' && initialDate ? initialDate : new Date().toISOString().split('T')[0]
  );
  const [customStartDate, setCustomStartDate]     = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);

  const [selectedProject,  setSelectedProject]  = useState('All Projects');
  const [selectedAssignee, setSelectedAssignee] = useState(initialUserId || 'All Assignees');
  const [selectedClient,   setSelectedClient]   = useState('All Clients');
  const [selectedStatus,   setSelectedStatus]   = useState('All');

  const [tasks,     setTasks]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [projects,  setProjects]  = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [clients,   setClients]   = useState([]);
  const [worklogTab, setWorklogTab] = useState('tasks');

  const { canReport, getLevel } = usePermissions();
  const worklogLevel = getLevel('reports', 'reports-status-based');
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isTeamLeadOrAdmin = isAdmin || user?.role?.toLowerCase() === 'team lead';

  useEffect(() => {
    if (initialUserId && onClearInitialUser) onClearInitialUser();
    if (initialFilter && onClearInitialFilter) onClearInitialFilter();
    if (initialDate && onClearInitialDate) onClearInitialDate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if ((worklogLevel === 'Self' || !isTeamLeadOrAdmin) && user?.id && !initialUserId) {
      setSelectedAssignee(user.id);
    }
  }, [worklogLevel, isTeamLeadOrAdmin, user?.id, initialUserId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let data;
      const isSelfOnly = worklogLevel === 'Self' || !isTeamLeadOrAdmin;
      const assigneeValue = isSelfOnly ? (user?.id || '') : selectedAssignee;
      const common = { project: selectedProject, assignee: assigneeValue, client: selectedClient, status: selectedStatus };

      if (reportType === 'daily') {
        const params = new URLSearchParams({ period: 'daily', date: selectedDailyDate, ...common });
        data = await api.get(`/reports/status-based?${params}`);
      } else if (reportType === 'monthly') {
        const params = new URLSearchParams({
          period: 'monthly',
          date: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`,
          ...common,
        });
        data = await api.get(`/reports/status-based?${params}`);
      } else if (reportType === 'weekly') {
        const params = new URLSearchParams({ period: 'weekly', date: selectedWeekDate, ...common });
        data = await api.get(`/reports/status-based?${params}`);
      } else {
        if (customStartDate && customEndDate) {
          const params = new URLSearchParams({
            period: 'custom',
            startDate: new Date(customStartDate).toISOString(),
            endDate:   new Date(new Date(customEndDate).setHours(23, 59, 59, 999)).toISOString(),
            ...common,
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
  }, [reportType, selectedDailyDate, selectedMonth, selectedYear, customStartDate, customEndDate, selectedWeekDate]);

  const taskItems = useMemo(() => {
    let filtered = tasks.filter(t => (t.taskType || 'Task').toLowerCase() !== 'calls/meetings');
    if (!isTeamLeadOrAdmin) {
      filtered = filtered.filter(t => {
        const taskAssignees = (t.assignees || '').split(',').map(a => a.trim().toLowerCase());
        const myId = (user?.id || '').toLowerCase().trim();
        const myName = (user?.fullName || '').toLowerCase().trim();
        return (myId && taskAssignees.includes(myId)) || (myName && taskAssignees.includes(myName));
      });
    }
    return filtered;
  }, [tasks, isTeamLeadOrAdmin, user]);
  const callItems = useMemo(() => {
    let filtered = tasks.filter(t => (t.taskType || 'Task').toLowerCase() === 'calls/meetings');
    if (!isTeamLeadOrAdmin) {
      filtered = filtered.filter(t => {
        const taskAssignees = (t.assignees || '').split(',').map(a => a.trim().toLowerCase());
        const myId = (user?.id || '').toLowerCase().trim();
        const myName = (user?.fullName || '').toLowerCase().trim();
        return (myId && taskAssignees.includes(myId)) || (myName && taskAssignees.includes(myName));
      });
    }
    return filtered;
  }, [tasks, isTeamLeadOrAdmin, user]);
  const displayedTasks = useMemo(() => worklogTab === 'calls' ? callItems : taskItems, [worklogTab, callItems, taskItems]);

  const kpiCards = useMemo(() => {
    // Tasks tab metrics
    const tasksCount = taskItems.length;
    const uniqueProjectsTasks = new Set(taskItems.map(t => t.projectName).filter(Boolean)).size;
    const totalTimeSpentTasks = taskItems.reduce((s, t) => s + (parseFloat(t.timeSpent) || 0), 0);

    // Calls/Meeting tab metrics
    const totalCallsTasks = callItems.length;
    const uniqueProjectsCalls = new Set(callItems.map(t => t.projectName).filter(Boolean)).size;
    const totalTimeSpentCalls = callItems.reduce((s, t) => s + (parseFloat(t.timeSpent) || 0), 0);

    const totalHoursAll = totalTimeSpentTasks + totalTimeSpentCalls;

    if (worklogTab === 'calls') {
      const baseCards = [
        {
          label: 'Calls/Meetings',
          value: totalCallsTasks,
          colorClass: 'blue',
          icon: (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
          )
        },
        {
          label: 'Projects',
          value: uniqueProjectsCalls,
          colorClass: 'purple',
          icon: (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          )
        },
        {
          label: 'Call Hours',
          value: formatDecimal(totalTimeSpentCalls),
          colorClass: 'orange',
          icon: (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          )
        }
      ];
      return [
        ...baseCards,
        {
          label: 'Task Hours',
          value: formatDecimal(totalTimeSpentTasks),
          colorClass: 'purple',
          icon: (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          )
        },
        {
          label: 'Total Hours',
          value: formatDecimal(totalHoursAll),
          colorClass: 'green',
          icon: (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          )
        }
      ];
    } else {
      const baseCards = [
        {
          label: 'Tasks',
          value: tasksCount,
          colorClass: 'blue',
          icon: (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
          )
        },
        {
          label: 'Projects',
          value: uniqueProjectsTasks,
          colorClass: 'purple',
          icon: (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          )
        },
        {
          label: 'Task Hours',
          value: formatDecimal(totalTimeSpentTasks),
          colorClass: 'orange',
          icon: (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          )
        }
      ];
      return [
        ...baseCards,
        {
          label: 'Call Hours',
          value: formatDecimal(totalTimeSpentCalls),
          colorClass: 'purple',
          icon: (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          )
        },
        {
          label: 'Total Hours',
          value: formatDecimal(totalHoursAll),
          colorClass: 'green',
          icon: (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          )
        }
      ];
    }
  }, [taskItems, callItems, worklogTab]);

  const { totalTimeSpent, totalBillable, totalEstimated } = useMemo(() => {
    const totalTimeSpent = displayedTasks.reduce((s, t) => s + (parseFloat(t.timeSpent)      || 0), 0);
    const totalBillable  = displayedTasks.reduce((s, t) => s + (parseFloat(t.billableHours)  || 0), 0);
    const totalEstimated = displayedTasks.reduce((s, t) => s + (parseFloat(t.estimatedHours) || 0), 0);
    return { totalTimeSpent, totalBillable, totalEstimated };
  }, [displayedTasks]);



  const handleExport = () => {
    const headers = ['TASK # NO', 'TITLE', 'STATUS', 'PROJECT', 'ASSIGNEE', 'TIME SPENT HRS', 'BILLABLE HRS', 'ESTIMATED HRS'];
    const rows = displayedTasks.map(t => {
      let resolvedAssignee = 'Unassigned';
      if (t.assignees) {
        const ids = t.assignees.split(',').map(id => id.trim()).filter(Boolean);
        resolvedAssignee = ids.map(id => {
          const u = assignees.find(u => u.id === id);
          return u ? (u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim()) : id;
        }).join(', ');
      }
      return [
        getDisplayId(t),
        `"${(t.title || '').replace(/"/g, '""')}"`,
        `"${t.status || ''}"`,
        `"${(t.projectName || '').replace(/"/g, '""')}"`,
        `"${resolvedAssignee.replace(/"/g, '""')}"`,
        formatDecimal(t.timeSpent),
        formatDecimal(t.billableHours),
        formatDecimal(t.estimatedHours),
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const tabName = worklogTab === 'calls' ? 'Calls_Meeting' : 'Tasks';
    a.download = `${tabName}_Report_${reportType}_${selectedYear}_${String(selectedMonth).padStart(2,'0')}.csv`;
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

  if (!canReport('reports-status-based') && user?.role?.toLowerCase() !== 'admin') {
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

      {/* ── Filter bar ── */}
      <div className="reports-filters-bar">
        <div className="reports-filter-left">
          <button className="reports-nav-btn" onClick={() => {
            if (reportType === 'daily') {
              const d = new Date(selectedDailyDate); d.setUTCDate(d.getUTCDate() - 1);
              setSelectedDailyDate(d.toISOString().split('T')[0]);
            } else if (reportType === 'monthly') {
              if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
              else setSelectedMonth(m => m - 1);
            } else if (reportType === 'weekly') {
              const d = new Date(selectedWeekDate); d.setUTCDate(d.getUTCDate() - 7);
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

          {/* Forward arrow — hidden for custom (no natural "next" range) */}
          {reportType !== 'custom' && (
            <button className="reports-nav-btn" onClick={() => {
              if (reportType === 'daily') {
                const d = new Date(selectedDailyDate); d.setUTCDate(d.getUTCDate() + 1);
                setSelectedDailyDate(d.toISOString().split('T')[0]);
              } else if (reportType === 'monthly') {
                if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
                else setSelectedMonth(m => m + 1);
              } else if (reportType === 'weekly') {
                const d = new Date(selectedWeekDate); d.setUTCDate(d.getUTCDate() + 7);
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
          {!(worklogLevel === 'Self' || !isTeamLeadOrAdmin) && (
            <select className="reports-select" value={selectedAssignee} onChange={e => setSelectedAssignee(e.target.value)}>
              <option value="All Assignees">All Assignees</option>
              {assignees.map(u => <option key={u.id} value={u.id}>{u.fullName || `${u.firstName || ''} ${u.lastName || ''}`}</option>)}
            </select>
          )}
          <select className="reports-select" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
            <option value="All">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="reports-apply-btn" onClick={fetchData}>Apply Filter</button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="reports-kpi-grid">
        {kpiCards.map((card, idx) => (
          <div className="reports-kpi-card" key={idx}>
            <div className={`kpi-icon-wrapper ${card.colorClass}`}>
              {card.icon}
            </div>
            <div className="kpi-info">
              <span className="kpi-label">{card.label}</span>
              <span className="kpi-value">{card.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Worklog Tab Switcher ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0' }}>
        <button
          onClick={() => setWorklogTab('tasks')}
          style={{
            padding: '0.5rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: worklogTab === 'tasks' ? '#2563eb' : '#64748b',
            borderBottom: worklogTab === 'tasks' ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: '-2px',
            transition: 'color 0.15s, border-color 0.15s'
          }}
        >
          Tasks
        </button>
        <button
          onClick={() => setWorklogTab('calls')}
          style={{
            padding: '0.5rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: worklogTab === 'calls' ? '#2563eb' : '#64748b',
            borderBottom: worklogTab === 'calls' ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: '-2px',
            transition: 'color 0.15s, border-color 0.15s'
          }}
        >
          Calls / Meetings
        </button>
      </div>


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
              {displayedTasks.map((task, idx) => {
                const st = STATUS_STYLE[task.status] || { bg: '#f1f5f9', color: '#475569' };
                return (
                  <tr key={`${task.id}_${idx}`}>
                    <td>{getDisplayId(task)}</td>
                    <td className="task-title-cell">
                      <span
                        style={{ color: '#2563eb', cursor: 'pointer', fontWeight: '600' }}
                        onClick={() => onNavigateToTask && onNavigateToTask(task)}
                      >
                        {task.title}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', fontWeight: '600', color: st.color, whiteSpace: 'nowrap' }}>
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
              {displayedTasks.length === 0 && (
                <tr>
                  <td colSpan="8" className="no-data-cell" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', fontSize: '0.95rem' }}>
                    No tasks found for this period.
                  </td>
                </tr>
              )}
            </tbody>
            {displayedTasks.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan="5" className="footer-total-label">Total</td>
                  <td className="footer-total-hours">{formatDecimal(totalTimeSpent)}</td>
                  <td className="footer-total-hours">{formatDecimal(totalBillable)}</td>
                  <td className="footer-total-hours">{formatDecimal(totalEstimated)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile View */}
        <div className="mobile-cards-view">
          {displayedTasks.map((task, idx) => {
            const displayId = getDisplayId(task);
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
              <div key={`${task.id}_${idx}`} className="reports-mobile-card">
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
                    <span style={{ fontSize: '0.78rem', fontWeight: '600', color: st.color, whiteSpace: 'nowrap' }}>
                      {task.status || '-'}
                    </span>
                  </div>
                  
                  <div className="reports-mobile-card-grid">
                    <div className="reports-mobile-card-grid-item">
                      <span className="reports-mobile-card-grid-label">TimeSpent</span>
                      <span className="reports-mobile-card-grid-value" style={{ color: '#2563eb' }}>
                        {formatDecimal(task.timeSpent)}
                      </span>
                    </div>
                    <div className="reports-mobile-card-grid-item">
                      <span className="reports-mobile-card-grid-label">Billable</span>
                      <span className="reports-mobile-card-grid-value">
                        {formatDecimal(task.billableHours)}
                      </span>
                    </div>
                    <div className="reports-mobile-card-grid-item">
                      <span className="reports-mobile-card-grid-label">Estimated</span>
                      <span className="reports-mobile-card-grid-value">
                        {formatDecimal(task.estimatedHours)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {displayedTasks.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b', fontSize: '0.9rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              No tasks found for this period.
            </div>
          )}

          {displayedTasks.length > 0 && (
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: '700', color: '#475569' }}>Total Time Spent:</span>
                <span style={{ fontWeight: '800', color: '#2563eb' }}>{formatDecimal(totalTimeSpent)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: '700', color: '#475569' }}>Total Billable:</span>
                <span style={{ fontWeight: '800', color: '#0f172a' }}>{formatDecimal(totalBillable)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: '700', color: '#475569' }}>Total Estimated:</span>
                <span style={{ fontWeight: '800', color: '#0f172a' }}>{formatDecimal(totalEstimated)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
