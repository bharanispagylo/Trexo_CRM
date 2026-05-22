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
    type: 'Full Day', 
    days: 1, 
    startDate: '', 
    endDate: '',
    reason: '',
    attachments: ''
  });

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

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
        const medicalUsed = approved.filter(l => l.type === 'Medical').reduce((sum, l) => sum + (l.days || 0), 0);
        const casualUsed = approved.filter(l => l.type === 'Casual Leave').reduce((sum, l) => sum + (l.days || 0), 0);
        
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
    setIsSaving(true);
    try {
      await api.post('/leaves', {
        name: user.fullName || user.firstName || user.name,
        type: form.type,
        days: parseInt(form.days),
        dates: `${form.startDate} to ${form.endDate}`,
        reason: form.reason,
        attachments: form.attachments,
        status: 'Pending',
      });
      alert('Leave request submitted successfully!', 'success', 'Success');
      setForm({ type: 'Full Day', days: 1, startDate: '', endDate: '', reason: '', attachments: '' });
      setCurrentView('list');
      fetchLeaves();
    } catch (error) {
      alert('Failed to submit: ' + error.message, 'error', 'Submission Failed');
    } finally {
      setIsSaving(false);
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
            <button className="apply-btn" onClick={() => setCurrentView('form')}>
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
                  <span className="leave-type-label">{key.charAt(0).toUpperCase() + key.slice(1)} Leave</span>
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
            <div className="saas-tabs" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
              <button className="saas-tab" onClick={() => setCurrentView('list')} style={{ padding: '0.4rem 1rem' }}>← Back to History</button>
              <span className="saas-breadcrumb-text" style={{ color: '#1E293B', fontWeight: '800', marginLeft: '1.25rem', fontSize: '1.1rem' }}>Submit Leave Request</span>
            </div>

            <div className="saas-form-card" style={{ marginTop: '0' }}>
              <div className="form-body" style={{ padding: '2rem' }}>
                <div className="saas-meta-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                  <div className="saas-field">
                    <label className="saas-label">Leave Type</label>
                    <select className="saas-select" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                      <option>Full Day</option>
                      <option>Half Day - First Session</option>
                      <option>Half Day - Second Session</option>
                      <option>Medical</option>
                      <option>Casual Leave</option>
                    </select>
                  </div>
                  <div className="saas-field">
                    <label className="saas-label">No. of Days</label>
                    <input className="saas-input" type="number" min="1" value={form.days} onChange={e => setForm({...form, days: e.target.value})} />
                  </div>
                  <div className="saas-field">
                    <label className="saas-label">Start Date *</label>
                    <input className="saas-input" type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
                  </div>
                  <div className="saas-field">
                    <label className="saas-label">End Date *</label>
                    <input className="saas-input" type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} />
                  </div>
                  <div className="saas-field" style={{ gridColumn: '1 / -1' }}>
                    <label className="saas-label">Reason for Leave *</label>
                    <textarea className="saas-textarea" rows="4" placeholder="Brief explanation..." value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}></textarea>
                  </div>
                  
                  <div className="saas-field" style={{ gridColumn: '1 / -1' }}>
                    <label className="saas-label">Attachments</label>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                    <button className="saas-tab" onClick={() => fileInputRef.current.click()} disabled={uploading} style={{ width: 'fit-content', borderStyle: 'dashed' }}>
                      {uploading ? 'Uploading...' : '+ Attach File (Optional)'}
                    </button>
                    {form.attachments && (
                      <div className="attachment-preview-list" style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {form.attachments.split(',').map((url, idx) => (
                          <div key={idx} className="attachment-tag" style={{ background: '#f1f5f9', padding: '0.25rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>File {idx+1}</a>
                            <button onClick={() => {
                              const filtered = form.attachments.split(',').filter((_, i) => i !== idx).join(',');
                              setForm({...form, attachments: filtered});
                            }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="form-actions" style={{ padding: '1.5rem 2rem', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderRadius: '0 0 12px 12px' }}>
                <button className="saas-btn-cancel" onClick={() => setCurrentView('list')} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer' }}>Discard</button>
                <button className="saas-btn-submit" onClick={handleAdd} style={{ padding: '0.75rem 2rem', borderRadius: '8px', background: '#2563EB', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Send Request</button>
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
                  {can('leave', 'edit') && <th style={{ textAlign: 'right' }}>Actions</th>}
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
                      <td><span className="td-type">{req.type}</span></td>
                      <td>{req.days} Days</td>
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
                      {can('leave', 'edit') && (
                        <td style={{ textAlign: 'right' }}>
                          {req.status === 'Pending' && (
                            <div className="action-btns">
                              <button className="approve-btn" onClick={() => handleAction(req.id, 'Approved')}>Approve</button>
                              <button className="reject-btn" onClick={() => handleAction(req.id, 'Rejected')}>Reject</button>
                            </div>
                          )}
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
