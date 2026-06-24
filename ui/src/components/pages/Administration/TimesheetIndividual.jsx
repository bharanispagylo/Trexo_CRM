import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../../api/client';

const TODAY = new Date().toISOString().split('T')[0];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const toLocalISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getDateRange = (filter, selectedDate) => {
  const date = new Date(selectedDate + 'T00:00:00');
  if (filter === 'daily') {
    return { startDate: selectedDate, endDate: selectedDate };
  } else if (filter === 'weekly') {
    const day = date.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { startDate: toLocalISO(monday), endDate: toLocalISO(sunday) };
  } else {
    const year = date.getFullYear();
    const month = date.getMonth();
    return {
      startDate: toLocalISO(new Date(year, month, 1)),
      endDate: toLocalISO(new Date(year, month + 1, 0))
    };
  }
};

const formatDisplayDate = (filter, selectedDate) => {
  const date = new Date(selectedDate + 'T00:00:00');
  if (filter === 'daily') {
    return `${String(date.getDate()).padStart(2,'0')}/${MONTHS[date.getMonth()]}/${date.getFullYear()}`;
  } else if (filter === 'weekly') {
    const day = date.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `${String(monday.getDate()).padStart(2,'0')}/${MONTHS[monday.getMonth()]} to ${String(sunday.getDate()).padStart(2,'0')}/${MONTHS[sunday.getMonth()]}`;
  } else {
    return `${MONTHS[date.getMonth()]}/${date.getFullYear()}`;
  }
};

function DatePicker({ filter, selectedDate, onChange }) {
  const inputRef = useRef(null);
  const inputType = filter === 'monthly' ? 'month' : 'date';
  const inputValue = filter === 'monthly' ? selectedDate.substring(0, 7) : selectedDate;

  const handleChange = (e) => {
    if (filter === 'monthly') {
      onChange(e.target.value + '-01');
    } else {
      onChange(e.target.value);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        onClick={() => inputRef.current?.showPicker?.() || inputRef.current?.click()}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.85rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', cursor: 'pointer', background: 'white', userSelect: 'none', whiteSpace: 'nowrap' }}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#64748b" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        {formatDisplayDate(filter, selectedDate)}
      </div>
      <input
        ref={inputRef}
        type={inputType}
        value={inputValue}
        onChange={handleChange}
        style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', top: 0, left: 0, pointerEvents: 'none' }}
        tabIndex={-1}
      />
    </div>
  );
}

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

const STATUS_COLORS = {
  'completed':    { bg: '#dcfce7', color: '#16a34a' },
  'in progress':  { bg: '#dbeafe', color: '#2563eb' },
  'to do':        { bg: '#f1f5f9', color: '#475569' },
  'delivered':    { bg: '#f0fdf4', color: '#15803d' },
  'prod verified':{ bg: '#ecfdf5', color: '#059669' },
};

export default function TimesheetIndividual({ initialUserId, onClearInitialUser }) {
  const [filter, setFilter] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/users').then(data => {
      const list = data || [];
      setUsers(list);
      if (initialUserId) {
        setSelectedUserId(initialUserId);
        if (onClearInitialUser) onClearInitialUser();
      } else if (list.length > 0) {
        setSelectedUserId(list[0].id);
      }
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const { startDate, endDate } = getDateRange(filter, selectedDate);
        const data = await api.get(`/worklogs?startDate=${startDate}&endDate=${endDate}&userId=${selectedUserId}`);
        setLogs(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [filter, selectedDate, selectedUserId]);

  const rows = logs.filter(log => !log.isBilled).map(log => {
    const t = log.task || {};
    return {
      title: t.title || log.taskId,
      timeSpent: Number(log.hoursWorked) || 0,
      billableHours: t.actualHours ?? '-',
      totalHours: t.approvedHours ?? '-',
      estimatedHours: t.estimatedHours ?? '-',
      status: t.status || '-'
    };
  });
  const totalHrs = rows.reduce((sum, r) => sum + r.timeSpent, 0);
  const distinctTasksCount = new Set(logs.filter(log => !log.isBilled).map(log => log.taskId)).size;

  const selectedUser = users.find(u => u.id === selectedUserId);
  const selectedUserName = selectedUser
    ? (selectedUser.fullName || `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim())
    : '';

  const handleExport = () => {
    const label = formatDisplayDate(filter, selectedDate).replace(/\//g, '-').replace(/ /g, '');
    const name = selectedUserName || 'user';
    downloadCSV(
      `timesheet-${name}-${label}.csv`,
      ['Task Name', 'Time Spent (Hours)', 'Billable Hrs', 'Total Hrs', 'Estimated Hrs', 'Status'],
      rows.map(r => [r.title, r.timeSpent.toFixed(1), r.billableHours, r.totalHours, r.estimatedHours, r.status])
    );
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header row: title left, export pinned top-right */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '0.75rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0f172a', margin: 0, flex: 1, minWidth: 0 }}>
          Timesheet - Individual{selectedUserName ? ` — ${selectedUserName}` : ''}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexShrink: 0 }}>
          <button
            onClick={handleExport}
            disabled={rows.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 1.1rem', background: 'white', color: rows.length === 0 ? '#94a3b8' : '#2563eb', border: `1.5px solid ${rows.length === 0 ? '#e2e8f0' : '#2563eb'}`, borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: rows.length === 0 ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <select
          value={selectedUserId}
          onChange={e => setSelectedUserId(e.target.value)}
          style={{ padding: '0.45rem 1.6rem 0.45rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '400', color: '#1a1a1a', background: 'white', appearance: 'none', WebkitAppearance: 'none', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.45rem center' }}
        >
          {users.map(u => {
            const name = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
            return <option key={u.id} value={u.id}>{name}</option>;
          })}
        </select>

        <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: '8px', padding: '4px', gap: '4px' }}>
          {['daily', 'weekly', 'monthly'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '0.45rem 1.25rem',
                background: filter === f ? 'white' : 'transparent',
                color: filter === f ? '#0f172a' : '#475569',
                border: 'none',
                fontWeight: '600',
                fontSize: '0.8rem',
                cursor: 'pointer',
                borderRadius: '6px',
                boxShadow: filter === f ? '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' : 'none',
                textTransform: 'capitalize',
                transition: 'all 0.2s'
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <DatePicker filter={filter} selectedDate={selectedDate} onChange={setSelectedDate} />
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '0.75rem 1.5rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Total Hours</span>
          <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{totalHrs.toFixed(1)}h</span>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.75rem 1.5rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Tasks</span>
          <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{distinctTasksCount}</span>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>Loading...</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '3rem', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>No timesheet data for this period.</div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Task Name</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Time Spent (Hours)</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Billable Hrs</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Total Hrs</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Estimated Hrs</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const statusKey = (row.status || '').toLowerCase();
                const statusStyle = STATUS_COLORS[statusKey] || { bg: '#f1f5f9', color: '#475569' };
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.87rem', fontWeight: '600', color: '#0f172a' }}>{row.title}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.87rem', fontWeight: '700', color: '#2563eb' }}>{row.timeSpent.toFixed(1)}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.87rem', color: '#475569' }}>{row.billableHours}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.87rem', color: '#475569' }}>{row.totalHours}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.87rem', color: '#475569' }}>{row.estimatedHours}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', padding: '0.2rem 0.6rem', borderRadius: '5px', background: statusStyle.bg, color: statusStyle.color, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
