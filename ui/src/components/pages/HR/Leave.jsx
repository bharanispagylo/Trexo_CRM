import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../../api/client';
import './Leave.css';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAlert } from '../../../context/AlertContext';

export default function Leave({ user }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentView, setCurrentView] = useState('list'); // 'list' or 'form'
  const [stats, setStats] = useState({
    medical: { used: 0, total: 10 },
    casual: { used: 0, total: 12 }
  });
  const { can, getLevel } = usePermissions();
  const { alert } = useAlert();
  
  const [form, setForm] = useState({ 
    type: 'Sick Leave', 
    period: 'Full Day',
    days: 1, 
    startDate: '', 
    endDate: '',
    reason: '',
    attachments: ''
  });
  const [editId, setEditId] = useState(null);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Auto-calculate number of days based on start date, end date, and period
  useEffect(() => {
    if (form.startDate && form.endDate) {
      const start = new Date(form.startDate);
      const end = new Date(form.endDate);
      
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        if (diffDays > 0) {
          let calculatedDays = diffDays;
          if (diffDays === 1 && (form.period === 'First Half' || form.period === 'Second Half')) {
            calculatedDays = 0.5;
          }
          setForm(prev => ({ ...prev, days: calculatedDays }));
        } else {
          setForm(prev => ({ ...prev, days: 0 }));
        }
      }
    } else {
      setForm(prev => ({ ...prev, days: 0 }));
    }
  }, [form.startDate, form.endDate, form.period]);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const data = await api.get('/leaves');
      const level = getLevel('leave', 'view');
      const unifiedName = (user?.fullName || user?.firstName || user?.name || '').trim().toLowerCase();
      
      let filtered = data || [];
      if (level === 'Self') {
        filtered = filtered.filter(req => req.name?.trim().toLowerCase() === unifiedName);
      }

      // Calculate Stats for non-admins (those with Self view level)
      if (getLevel('leave', 'view') === 'Self') {
        const approved = filtered.filter(l => l.status === 'Approved');
        const medicalUsed = approved.filter(l => 
          l.type === 'Medical' || 
          l.type?.toLowerCase().includes('sick')
        ).reduce((sum, l) => sum + (l.days || 0), 0);

        const casualUsed = approved.filter(l => 
          l.type === 'Casual Leave' || 
          l.type?.toLowerCase().includes('casual') || 
          l.type?.toLowerCase().includes('caual') || 
          l.type?.toLowerCase().includes('causal')
        ).reduce((sum, l) => sum + (l.days || 0), 0);
        
        setStats({
          medical: { used: medicalUsed, total: 10 },
          casual: { used: casualUsed, total: 12 }
        });
      }

      setRequests(filtered.sort((a, b) => b.id - a.id));
    } catch (error) {
      console.error('Fetch error:', error);
    }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchLeaves(); }, [user]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || 'img_default');
      
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      );
      const data = await response.json();
      if (data.secure_url) {
        const current = form.attachments ? form.attachments.split(',') : [];
        setForm({ ...form, attachments: [...current, data.secure_url].join(',') });
      }
    } catch (err) {
      alert('Upload failed: ' + err.message, 'error', 'Upload Failed');
    }
    setUploading(false);
  };

  const handleAdd = async () => {
    if (!form.startDate || !form.endDate || !form.reason) {
      alert("Please fill in start date, end date and reason.", 'warning', 'Required Fields');
      return;
    }
    
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (start > end) {
      alert("End date cannot be before start date.", 'warning', 'Invalid Dates');
      return;
    }

    setIsSaving(true);
    try {
      if (editId) {
        await api.put(`/leaves/${editId}`, {
          type: form.type,
          period: form.period,
          days: parseFloat(form.days),
          dates: `${form.startDate} to ${form.endDate}`,
          reason: form.reason,
          attachments: form.attachments,
        });
        alert('Leave request updated successfully!', 'success', 'Success');
      } else {
        await api.post('/leaves', {
          name: user.fullName || user.firstName || user.name,
          type: form.type,
          period: form.period,
          days: parseFloat(form.days),
          dates: `${form.startDate} to ${form.endDate}`,
          reason: form.reason,
          attachments: form.attachments,
          status: 'Pending',
        });
        alert('Leave request submitted successfully!', 'success', 'Success');
      }
      setForm({ type: 'Sick Leave', period: 'Full Day', days: 1, startDate: '', endDate: '', reason: '', attachments: '' });
      setEditId(null);
      setCurrentView('list');
      fetchLeaves();
    } catch (error) {
      alert('Failed to submit: ' + error.message, 'error', 'Submission Failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (req) => {
    setEditId(req.id);
    const datesArr = req.dates ? req.dates.split(' to ') : [];
    setForm({
      type: req.type || 'Sick Leave',
      period: req.period || 'Full Day',
      days: req.days || 1,
      startDate: datesArr[0] || '',
      endDate: datesArr[1] || '',
      reason: req.reason || '',
      attachments: req.attachments || ''
    });
    setCurrentView('form');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this leave request?')) return;
    try {
      await api.delete(`/leaves/${id}`);
      alert('Leave request deleted successfully!', 'success', 'Success');
      fetchLeaves();
    } catch (error) {
      alert('Failed to delete: ' + error.message, 'error', 'Delete Failed');
    }
  };

  const handleAction = async (id, action) => {
    setIsSaving(true);
    try {
      await api.put(`/leaves/${id}`, { status: action });
      alert(`Leave request ${action.toLowerCase()} successfully!`, 'success', 'Success');
      fetchLeaves();
    } catch (error) {
      console.error('Update error:', error);
      alert('Failed to update leave request.', 'error', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isSaving) return <div className="loading-screen">{isSaving ? 'Saving...' : 'Loading Leaves...'}</div>;

  return (
    <div className="leave-page">
      <div className="leave-content-wrapper">
        
        {/* HEADER */}
        <div className="leave-header">
          <div className="header-text">
            <h2>Time Off & Leave</h2>
            <p>Manage your leave requests and check your balance.</p>
          </div>
          {can('leave', 'create') && currentView === 'list' && (
            <button className="apply-btn" onClick={() => { setEditId(null); setForm({ type: 'Sick Leave', period: 'Full Day', days: 1, startDate: '', endDate: '', reason: '', attachments: '' }); setCurrentView('form'); }}>
              <span>+</span> New Request
            </button>
          )}
        </div>

        {/* STATS CARDS (Only for those with Self view level) */}
        {currentView === 'list' && getLevel('leave', 'view') === 'Self' && (
          <div className="leave-stats-grid">
            {Object.entries(stats).map(([key, value]) => (
              <div key={key} className="leave-stat-card">
                <div className="card-top">
                  <span className="leave-type-label">{key === 'medical' ? 'Sick Leave' : 'Casual Leave'}</span>
                  <span className="leave-count-text"><b>{value.total - value.used}</b> / {value.total} Days Left</span>
                </div>
                <div className="leave-progress-bg">
                  <div 
                    className={`leave-progress-bar bar-${key}`} 
                    style={{ width: `${((value.total - value.used) / value.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* REQUEST FORM PAGE */}
        {currentView === 'form' && (
          <div className="leave-page-form">
            <div className="leave-form-container">
              <div className="leave-form-header">
                <h3 className="leave-form-title">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '0.25rem', color: '#2563eb' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  {editId ? 'Modify Leave Request' : 'New Leave Request'}
                </h3>
                <button className="back-history-btn" onClick={() => setCurrentView('list')}>
                  ← Back to History
                </button>
              </div>
              
              <div className="leave-form-grid">
                <div className="leave-form-field">
                  <label className="leave-form-label">
                    Leave Type <span className="required-dot">*</span>
                  </label>
                  <select 
                    className="leave-form-select" 
                    value={form.type} 
                    onChange={e => setForm({...form, type: e.target.value})}
                  >
                    <option value="Sick Leave">Sick Leave</option>
                    <option value="Casual Leave">Casual Leave</option>
                  </select>
                </div>

                <div className="leave-form-field">
                  <label className="leave-form-label">
                    Period <span className="required-dot">*</span>
                  </label>
                  <select 
                    className="leave-form-select" 
                    value={form.period} 
                    onChange={e => setForm({...form, period: e.target.value})}
                    disabled={form.startDate && form.endDate && new Date(form.startDate).toDateString() !== new Date(form.endDate).toDateString()}
                    title={form.startDate && form.endDate && new Date(form.startDate).toDateString() !== new Date(form.endDate).toDateString() ? "For multi-day leaves, Period defaults to Full Day" : ""}
                  >
                    <option value="Full Day">Full Day</option>
                    <option value="First Half">First Half (0.5 Day)</option>
                    <option value="Second Half">Second Half (0.5 Day)</option>
                  </select>
                </div>

                <div className="leave-form-field">
                  <label className="leave-form-label">
                    Start Date <span className="required-dot">*</span>
                  </label>
                  <input 
                    className="leave-form-input" 
                    type="date" 
                    value={form.startDate} 
                    onChange={e => {
                      const updatedDate = e.target.value;
                      setForm(prev => {
                        const nextState = { ...prev, startDate: updatedDate };
                        // If multi-day range, reset period to 'Full Day'
                        if (nextState.endDate && updatedDate) {
                          const s = new Date(updatedDate);
                          const ed = new Date(nextState.endDate);
                          if (!isNaN(s.getTime()) && !isNaN(ed.getTime())) {
                            const diff = Math.round((ed - s) / (24*3600*1000)) + 1;
                            if (diff > 1) {
                              nextState.period = 'Full Day';
                            }
                          }
                        }
                        return nextState;
                      });
                    }} 
                  />
                </div>

                <div className="leave-form-field">
                  <label className="leave-form-label">
                    End Date <span className="required-dot">*</span>
                  </label>
                  <input 
                    className="leave-form-input" 
                    type="date" 
                    value={form.endDate} 
                    onChange={e => {
                      const updatedDate = e.target.value;
                      setForm(prev => {
                        const nextState = { ...prev, endDate: updatedDate };
                        // If multi-day range, reset period to 'Full Day'
                        if (nextState.startDate && updatedDate) {
                          const s = new Date(nextState.startDate);
                          const ed = new Date(updatedDate);
                          if (!isNaN(s.getTime()) && !isNaN(ed.getTime())) {
                            const diff = Math.round((ed - s) / (24*3600*1000)) + 1;
                            if (diff > 1) {
                              nextState.period = 'Full Day';
                            }
                          }
                        }
                        return nextState;
                      });
                    }} 
                  />
                  {form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate) && (
                    <div className="date-warning-msg">
                      ✕ End date must be on or after start date
                    </div>
                  )}
                </div>

                <div className="leave-form-field full-width">
                  <label className="leave-form-label">
                    Duration
                  </label>
                  <input 
                    className="leave-form-input calculated-value" 
                    type="text" 
                    value={`${form.days} Day${form.days !== 1 ? 's' : ''}`} 
                    readOnly 
                  />
                </div>

                <div className="leave-form-field full-width">
                  <label className="leave-form-label">
                    Reason for Leave <span className="required-dot">*</span>
                  </label>
                  <textarea 
                    className="leave-form-textarea" 
                    rows="3" 
                    placeholder="Please provide a brief reason for your leave request..." 
                    value={form.reason} 
                    onChange={e => setForm({...form, reason: e.target.value})} 
                  />
                </div>

                <div className="leave-form-field full-width">
                  <label className="leave-form-label">
                    Supporting Attachments
                  </label>
                  <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                  <div 
                    className={`attachment-upload-area ${uploading ? 'uploading' : ''}`}
                    onClick={() => !uploading && fileInputRef.current.click()}
                  >
                    <svg className="upload-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span className="upload-text">
                      {uploading ? 'Uploading your file...' : 'Click to Upload Document'}
                    </span>
                    <span className="upload-subtext">PDF, PNG, JPG (Max 5MB)</span>
                  </div>

                  {form.attachments && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                      {form.attachments.split(',').map((url, idx) => (
                        <div key={idx} className="attachment-chip">
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            Doc {idx + 1}
                          </a>
                          <button 
                            onClick={() => {
                              const filtered = form.attachments.split(',').filter((_, i) => i !== idx).join(',');
                              setForm({...form, attachments: filtered});
                            }} 
                            className="attachment-delete-btn"
                            title="Remove attachment"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="leave-form-actions">
                <button className="btn-discard" onClick={() => setCurrentView('list')}>
                  Discard
                </button>
                <button className="btn-submit-premium" onClick={handleAdd}>
                  {editId ? 'Save Changes' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HISTORY LIST */}
        {currentView === 'list' && (
          <div className="leave-history-card">
            <div className="history-header">
              <h3>Recent Requests</h3>
            </div>
            <div className="history-table-wrapper">
              <table className="leave-table">
                <thead>
                  <tr>
                    {getLevel('leave', 'view') === 'All' && <th>Employee</th>}
                    <th>Type</th>
                    <th>Duration</th>
                    <th>Dates</th>
                    <th>Files</th>
                    <th>Status</th>
                    {(can('leave', 'edit') || can('leave', 'delete') || getLevel('leave', 'edit') === 'All' || user?.role?.toLowerCase() === 'admin') && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr><td colSpan="7" className="table-empty">No leave requests found.</td></tr>
                  ) : (
                    requests.map(req => (
                      <tr key={req.id}>
                        {getLevel('leave', 'view') === 'All' && (
                          <td className="td-user">
                            <div className="user-initials">{req.name?.substring(0,2).toUpperCase()}</div>
                            <span>{req.name}</span>
                          </td>
                        )}
                        <td>
                          <span className="td-type">{req.type}</span>
                          {req.period && req.period !== 'Full Day' && (
                            <span className="td-period-badge">{req.period}</span>
                          )}
                        </td>
                        <td>{req.days} Day{req.days !== 1 ? 's' : ''}</td>
                        <td>{req.dates}</td>
                        <td>
                          {req.attachments ? (
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              {req.attachments.split(',').map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" title={`Attachment ${i+1}`} style={{ color: '#2563eb' }}>
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                                </a>
                              ))}
                            </div>
                          ) : '-'}
                        </td>
                        <td>
                          <span className={`status-pill ${req.status?.toLowerCase()}`}>
                            {req.status}
                          </span>
                        </td>
                        {(can('leave', 'edit') || can('leave', 'delete') || getLevel('leave', 'edit') === 'All' || user?.role?.toLowerCase() === 'admin') && (
                          <td style={{ textAlign: 'right' }}>
                            <div className="action-btns" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                              {(getLevel('leave', 'edit') === 'All' || user?.role?.toLowerCase() === 'admin') ? (
                                req.status === 'Pending' && (
                                  <>
                                    <button className="approve-btn" onClick={() => handleAction(req.id, 'Approved')}>Approve</button>
                                    <button className="reject-btn" onClick={() => handleAction(req.id, 'Rejected')}>Reject</button>
                                  </>
                                )
                              ) : (
                                <>
                                  {can('leave', 'edit') && req.status === 'Pending' && (
                                    <button className="action-icon-btn" onClick={() => handleEdit(req)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                  )}
                                  {can('leave', 'delete') && req.status === 'Pending' && (
                                    <button className="action-icon-btn" onClick={() => handleDelete(req.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
