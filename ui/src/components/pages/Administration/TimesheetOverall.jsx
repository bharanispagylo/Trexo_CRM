import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../../api/client';
import './Reports.css';

const TODAY = new Date().toISOString().split('T')[0];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const formatWorklogHours = (hoursDecimal) => {
  const val = parseFloat(hoursDecimal);
  if (isNaN(val) || val <= 0) return '0 hrs';
  const rounded = Math.round(val * 100) / 100;
  return `${rounded} hrs`;
};

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
    onChange(filter === 'monthly' ? e.target.value + '-01' : e.target.value);
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

export default function TimesheetOverall({ onUserClick }) {
  const [filter, setFilter] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { startDate, endDate } = getDateRange(filter, selectedDate);
        const data = await api.get(`/worklogs?startDate=${startDate}&endDate=${endDate}&includeCalls=true`);
        setLogs(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filter, selectedDate]);

  const grouped = {};
  logs.filter(log => !log.isBilled).forEach(log => {
    const key = log.userId || 'unknown';
    const name = log.user?.fullName || `${log.user?.firstName || ''} ${log.user?.lastName || ''}`.trim() || 'Unknown';
    if (!grouped[key]) {
      grouped[key] = { 
        userId: key, 
        name, 
        taskIds: new Set(), 
        taskHours: 0,
        callHours: 0,
        totalHours: 0
      };
    }
    const isCall = log.task?.taskType === 'calls/meetings';
    const hours = Number(log.hoursWorked) || 0;
    if (isCall) {
      grouped[key].callHours += hours;
    } else {
      grouped[key].taskIds.add(log.taskId);
      grouped[key].taskHours += hours;
    }
    grouped[key].totalHours += hours;
  });
  const rows = Object.values(grouped);

  const handleExport = () => {
    const label = formatDisplayDate(filter, selectedDate).replace(/\//g, '-').replace(/ /g, '');
    downloadCSV(
      `timesheet-overall-${label}.csv`,
      ['Assignee', 'Tasks #', 'Task Hrs', 'Call Hrs', 'Total Hrs'],
      rows.map(r => [r.name, r.taskIds.size, formatWorklogHours(r.taskHours), formatWorklogHours(r.callHours), formatWorklogHours(r.totalHours)])
    );
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Top bar: filters + total hours left, export pinned top-right */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
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
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '0.75rem 1.5rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Total Hours</span>
            <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', lineHeight: 1.2 }}>
              {formatWorklogHours(rows.reduce((sum, r) => sum + r.totalHours, 0))}
            </span>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={rows.length === 0}
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 1.1rem', background: 'white', color: rows.length === 0 ? '#94a3b8' : '#2563eb', border: `1.5px solid ${rows.length === 0 ? '#e2e8f0' : '#2563eb'}`, borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: rows.length === 0 ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Export
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>Loading...</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '3rem', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>No timesheet data for this period.</div>
      ) : (
        <div className="reports-table-container" style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Desktop View */}
          <div className="desktop-table-view">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Assignee</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Tasks #</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Task Hrs</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Call Hrs</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Total Hrs</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => onUserClick && row.userId !== 'unknown' && onUserClick(row.userId, filter, selectedDate)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: onUserClick && row.userId !== 'unknown' ? 'pointer' : 'default', transition: 'background 0.12s' }}
                    onMouseEnter={e => { if (onUserClick && row.userId !== 'unknown') e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                  >
                    <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.87rem', fontWeight: '600', color: onUserClick && row.userId !== 'unknown' ? '#2563eb' : '#0f172a' }}>{row.name}</td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center', fontSize: '0.87rem', color: '#475569' }}>{row.taskIds.size}</td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center', fontSize: '0.87rem', color: '#475569' }}>{formatWorklogHours(row.taskHours)}</td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center', fontSize: '0.87rem', color: '#475569' }}>{formatWorklogHours(row.callHours)}</td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center', fontSize: '0.87rem', fontWeight: '700', color: '#2563eb' }}>{formatWorklogHours(row.totalHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="mobile-cards-view" style={{ padding: '1rem', background: '#fafbfc' }}>
            {rows.map((row, i) => (
              <div 
                key={i} 
                className="reports-mobile-card"
                onClick={() => onUserClick && row.userId !== 'unknown' && onUserClick(row.userId, filter, selectedDate)}
                style={{ cursor: onUserClick && row.userId !== 'unknown' ? 'pointer' : 'default' }}
              >
                <div className="reports-mobile-card-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                  <span 
                    className="reports-mobile-card-title" 
                    style={{ color: onUserClick && row.userId !== 'unknown' ? '#2563eb' : '#0f172a', fontSize: '1rem', fontWeight: '700' }}
                  >
                    {row.name}
                  </span>
                </div>
                
                <div className="reports-mobile-card-body">
                  <div className="reports-mobile-card-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1rem' }}>
                    <div className="reports-mobile-card-grid-item">
                      <span className="reports-mobile-card-grid-label">Tasks Count</span>
                      <span className="reports-mobile-card-grid-value">
                        {row.taskIds.size}
                      </span>
                    </div>
                    <div className="reports-mobile-card-grid-item">
                      <span className="reports-mobile-card-grid-label">Task Hours</span>
                      <span className="reports-mobile-card-grid-value">
                        {formatWorklogHours(row.taskHours)}
                      </span>
                    </div>
                    <div className="reports-mobile-card-grid-item">
                      <span className="reports-mobile-card-grid-label">Call Hours</span>
                      <span className="reports-mobile-card-grid-value">
                        {formatWorklogHours(row.callHours)}
                      </span>
                    </div>
                    <div className="reports-mobile-card-grid-item">
                      <span className="reports-mobile-card-grid-label">Total Hours</span>
                      <span className="reports-mobile-card-grid-value" style={{ color: '#2563eb', fontWeight: '700' }}>
                        {formatWorklogHours(row.totalHours)}
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
