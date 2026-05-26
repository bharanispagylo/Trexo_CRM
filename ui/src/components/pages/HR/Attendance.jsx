import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import './Attendance.css';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAlert } from '../../../context/AlertContext';

export default function Attendance({ user }) {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [view, setView] = useState('main'); // 'main' or 'manual'
  const { can, getLevel } = usePermissions();
  const { alert } = useAlert();

  // ── TICKING CLOCK ──
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const data = await api.get('/attendance');
      const level = getLevel('attendance', 'view');
      const userName = (user?.fullName || user?.firstName || user?.name || '').trim().toLowerCase();
      
      let filteredData = data || [];
      if (level === 'Self') {
        filteredData = (data || []).filter(a => a.name?.trim().toLowerCase() === userName);
      }
      
      // Sort by date (desc)
      filteredData.sort((a, b) => new Date(b.date) - new Date(a.date));
      setAttendance(filteredData);


    } catch (error) {
      console.error('Fetch error:', error);
    }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAttendance(); }, [user]);



  const getStatusColor = (status) => {
    switch (status) {
      case 'Present': return '#10b981';
      case 'Out': return '#f59e0b';
      case 'Absent': return '#ef4444';
      case 'Late': return '#f59e0b';
      default: return '#64748b';
    }
  };


  const [usersList, setUsersList] = useState([]);
  const [manualFormName, setManualFormName] = useState(user.fullName || user.firstName || user.name || '');

  const [manualForm, setManualForm] = useState({
    date: new Date().toISOString().split('T')[0],
    checkIn: '09:00',
    checkOut: '18:00',
    empId: user.empId || user.id || '',
    role: user.role || '',
    destination: '',
    breakTime: '',
    totalWorkingHrs: '',
    outTimeHrs: ''
  });

  useEffect(() => {
    if (view === 'manual') {
      setManualForm({
        date: new Date().toISOString().split('T')[0],
        checkIn: '09:00',
        checkOut: '18:00',
        empId: user.empId || user.id || '',
        role: user.role || '',
        destination: '',
        breakTime: '',
        totalWorkingHrs: '',
        outTimeHrs: ''
      });
      setManualFormName(user.fullName || user.firstName || user.name || '');
      
      if (user.role === 'Admin') {
        api.get('/users')
          .then(res => setUsersList(res || []))
          .catch(err => console.error('Failed to fetch users:', err));
      }
    }
  }, [view, user]);

  const handleManualAdd = async () => {
    if (!manualForm.date || !manualForm.empId?.trim() || !manualForm.checkIn || !manualForm.checkOut) {
      alert("Please fill out all mandatory fields: Date, Employee ID, Check In, and Check Out.");
      return;
    }
    setIsSaving(true);
    try {
      const formatTime = (time) => {
        const [h, m] = time.split(':');
        const hh = parseInt(h);
        const suffix = hh >= 12 ? 'PM' : 'AM';
        const hour = hh % 12 || 12;
        return `${String(hour).padStart(2, '0')}:${m} ${suffix}`;
      };

      await api.post('/attendance', {
        name: manualFormName,
        empId: manualForm.empId,
        role: manualForm.role,
        destination: manualForm.destination,
        date: manualForm.date,
        checkIn: formatTime(manualForm.checkIn),
        checkOut: formatTime(manualForm.checkOut),
        breakTime: manualForm.breakTime,
        totalWorkingHrs: manualForm.totalWorkingHrs,
        outTimeHrs: manualForm.outTimeHrs,
        status: manualForm.checkOut ? 'Out' : 'Present'
      });
      alert('Attendance entry saved successfully!', 'success', 'Success');
      setView('main');
      fetchAttendance();
    } catch (error) {
      alert('Failed to add entry: ' + error.message, 'error', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  if (view === 'manual') {
    return (
      <div className="attendance-page">
        <div className="manual-entry-container animate-slide-up" style={{ maxWidth: '800px', margin: '2rem auto', background: 'white', padding: '2rem', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div className="manual-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>New Manual Attendance Entry</h2>
            <button className="btn-cancel" onClick={() => setView('main')} style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>← Back to History</button>
          </div>
          
          <div className="manual-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Select Date *</label>
              <input type="date" value={manualForm.date} onChange={e => setManualForm({...manualForm, date: e.target.value})} style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Employee ID *</label>
                {user.role === 'Admin' ? (
                  <select
                    value={usersList.find(u => u.empId === manualForm.empId || u.id === manualForm.empId)?.id || ''}
                    onChange={e => {
                      const selected = usersList.find(u => u.id === e.target.value);
                      if (selected) {
                        setManualForm({
                          ...manualForm,
                          empId: selected.empId || selected.id,
                          role: selected.role || selected.designation || 'Employee'
                        });
                        setManualFormName(selected.fullName || `${selected.firstName} ${selected.lastName}`.trim());
                      } else {
                        setManualForm({
                          ...manualForm,
                          empId: '',
                          role: ''
                        });
                        setManualFormName('');
                      }
                    }}
                    style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', background: 'white' }}
                  >
                    <option value="">-- Select Employee --</option>
                    {usersList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullName || `${u.firstName} ${u.lastName}`.trim()} ({u.empId || 'No ID'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    value={manualForm.empId} 
                    readOnly 
                    style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', backgroundColor: '#f8fafc', color: '#64748b' }} 
                  />
                )}
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Role</label>
                <input type="text" value={manualForm.role} onChange={e => setManualForm({...manualForm, role: e.target.value})} style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
              </div>
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Check In Time *</label>
                <input type="time" value={manualForm.checkIn} onChange={e => setManualForm({...manualForm, checkIn: e.target.value})} style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Check Out Time *</label>
                <input type="time" value={manualForm.checkOut} onChange={e => setManualForm({...manualForm, checkOut: e.target.value})} style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
              </div>
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Destination</label>
                <input type="text" placeholder="Office / Client Site" value={manualForm.destination} onChange={e => setManualForm({...manualForm, destination: e.target.value})} style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Break Time</label>
                <input type="text" placeholder="1 Hr" value={manualForm.breakTime} onChange={e => setManualForm({...manualForm, breakTime: e.target.value})} style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
              </div>
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Total Working Hrs</label>
                <input type="text" placeholder="8.5 Hrs" value={manualForm.totalWorkingHrs} onChange={e => setManualForm({...manualForm, totalWorkingHrs: e.target.value})} style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Out Time Hrs</label>
                <input type="text" placeholder="18:30" value={manualForm.outTimeHrs} onChange={e => setManualForm({...manualForm, outTimeHrs: e.target.value})} style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
              </div>
            </div>
          </div>

          <div className="manual-footer" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
            <button className="btn-cancel" onClick={() => setView('main')} style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
            <button className="btn-submit" onClick={handleManualAdd} style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Save Entry</button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || isSaving) return <div className="loading-screen">{isSaving ? 'Saving...' : 'Loading Attendance...'}</div>;

  return (
    <div className="attendance-page">

      <div className="attendance-container">
        
        {/* LEFT: CLOCK CARD */}
        <div className="punch-card-section">
          <div className="clock-card">
            <div className="current-date">{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <div className="current-time">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
            <div className="clock-footer">
              <span className="live-badge">LIVE CLOCK</span>
            </div>
          </div>

          <div className="attendance-stats">
            <div className="stat-box">
              <div className="stat-label">Days Present</div>
              <div className="stat-value">{attendance.filter(a => a.status === 'Present').length}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Total Hours</div>
              <div className="stat-value">--</div>
            </div>
          </div>
        </div>

        {/* RIGHT: HISTORY LIST */}
        <div className="history-section">
          <div className="history-header">
            <h3>Attendance History</h3>
            <div className="history-actions">
              {can('attendance', 'create') && (
                <button className="history-btn active" onClick={() => setView('manual')}>+ Add Manual Entry</button>
              )}
            </div>
          </div>

          <div className="history-list">
            {loading ? (
              <div className="loading-history">Loading history...</div>
            ) : attendance.length === 0 ? (
              <div className="empty-history">No records found for this period.</div>
            ) : (
              attendance.map(att => (
                <div key={att.id} className="history-item">
                  <div className="item-date">
                    <span className="date-day">{new Date(att.date).getDate()}</span>
                    <span className="date-month">{new Date(att.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                  </div>
                  <div className="item-details">
                    <div className="item-row" style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                      <span>{att.name || 'Employee'}</span>
                      <span style={{ marginLeft: '6px', fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>({att.empId || 'No ID'})</span>
                    </div>
                    <div className="item-row">
                      <span className="time-label">Check In:</span>
                      <span className="time-value">{att.checkIn}</span>
                      {att.checkOut && (
                        <>
                          <span className="time-label" style={{ marginLeft: '12px' }}>Check Out:</span>
                          <span className="time-value">{att.checkOut}</span>
                        </>
                      )}
                    </div>
                    <div className="item-row" style={{ marginTop: '4px' }}>
                      <span className="time-label" style={{ color: '#2563eb' }}>Details:</span>
                      <span className="time-value" style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                        {att.destination && `${att.destination} • `} 
                        {att.breakTime && `Break: ${att.breakTime} • `}
                        {att.totalWorkingHrs && `Total: ${att.totalWorkingHrs}`}
                      </span>
                    </div>
                  </div>
                  <div className="item-status">
                    <span className="status-dot" style={{ backgroundColor: getStatusColor(att.status) }}></span>
                    {att.status}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
