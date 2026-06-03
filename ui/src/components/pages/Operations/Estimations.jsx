import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useAlert } from '../../../context/AlertContext';
import './Estimations.css';

export default function Estimations({ user }) {
  const [estimations, setEstimations] = useState([]);

  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [taskLists, setTaskLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ taskName: '', description: '', client: '', clientId: '', projectId: '', estimatedHours: 0 });
  const [errors, setErrors] = useState({});
  const [convertModal, setConvertModal] = useState({ isOpen: false, estimation: null });
  const [convertForm, setConvertForm] = useState({ projectId: '', assignees: '', assignedDate: '', dueDate: '', priority: 'Medium', taskListId: '', taskType: 'Feature' });
  const { alert, confirm } = useAlert();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [estData, projData, clientData, usersData, listsData] = await Promise.all([
        api.get('/estimations'),
        api.get('/projects'),
        api.get('/clients'),
        api.get('/users'),
        api.get('/task-lists')
      ]);
      setEstimations(estData || []);
      setProjects(projData || []);
      setClients(clientData || []);
      setUsers(usersData ? usersData.map(u => u.fullName || `${u.firstName} ${u.lastName}`.trim()) : []);
      setTaskLists(listsData || []);
    } catch (err) {
      console.error('Failed to fetch estimations data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = async () => {
    if (!form.taskName?.trim() || !form.client?.trim() || !form.projectId || form.estimatedHours <= 0) {
      setErrors({
        taskName: !form.taskName?.trim() ? 'Task Name is required' : '',
        client: !form.client?.trim() ? 'Company Name is required' : '',
        projectId: !form.projectId ? 'Project is required' : '',
        estimatedHours: form.estimatedHours <= 0 ? 'Estimated hours must be greater than 0' : ''
      });
      return;
    }

    setIsSaving(true);
    try {
      if (form.id) {
        await api.put(`/estimations/${form.id}`, form);
        alert('Estimation updated successfully', 'success', 'Success');
      } else {
        await api.post('/estimations', form);
        alert('Estimation created successfully', 'success', 'Success');
      }
      setForm({ taskName: '', description: '', client: '', clientId: '', projectId: '', estimatedHours: 0 });
      setShowForm(false);
      setErrors({});
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to save estimation', 'error', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id) => {
    confirm('Are you sure you want to delete this estimation?', async () => {
      setIsSaving(true);
      try {
        await api.delete(`/estimations/${id}`);
        alert('Estimation deleted successfully', 'success', 'Deleted');
        fetchData();
      } catch (err) {
        alert('Failed to delete estimation', 'error', 'Error');
      } finally {
        setIsSaving(false);
      }
    }, 'Delete Estimation');
  };

  const handleEdit = (est) => {
    setForm(est);
    setShowForm(true);
    setErrors({});
  };

  const handleConvertClick = (est) => {
    setConvertModal({ isOpen: true, estimation: est });
    setConvertForm({ projectId: est.projectId || '', assignees: '', assignedDate: '', dueDate: '', priority: 'Medium', taskListId: '', taskType: 'Feature' });
  };

  const submitConvert = async () => {
    setIsSaving(true);
    try {
      await api.post(`/estimations/${convertModal.estimation.id}/convert`, convertForm);
      alert('Estimation converted to Task successfully!', 'success', 'Success');
      setConvertModal({ isOpen: false, estimation: null });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to convert estimation', 'error', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isSaving) return <div className="loading-screen">{isSaving ? 'Saving...' : 'Loading Estimations...'}</div>;

  return (
    <>
    <div className="estimations-page">
      <div className="estimations-header">
        <div className="estimations-header-left">
          <div className="estimations-icon-wrapper">
             <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div>
            <h1 className="estimations-title">Estimations</h1>
            <p className="estimations-subtitle">Manage task estimations before converting them to actual tasks.</p>
          </div>
        </div>
        <div>
          <button className="estimations-btn-primary" onClick={() => { setForm({ taskName: '', description: '', client: '', clientId: '', projectId: '', estimatedHours: 0 }); setShowForm(true); }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Estimation
          </button>
        </div>
      </div>

      <div>
        {showForm ? (
          <div className="estimations-form-card">
            <h2 className="estimations-form-title">{form.id ? 'Edit Estimation' : 'Create New Estimation'}</h2>
            <div className="estimations-form-grid">
              <div className="estimations-field">
                <label className="estimations-label">Task Name *</label>
                <input className={`estimations-input ${errors.taskName ? 'error' : ''}`} placeholder="e.g. Develop Login Page" value={form.taskName} onChange={e => setForm({...form, taskName: e.target.value})} />
                {errors.taskName && <span className="estimations-error-text">{errors.taskName}</span>}
              </div>
              <div className="estimations-field">
                <label className="estimations-label">Company Name *</label>
                <select 
                  className={`estimations-select ${errors.client ? 'error' : ''}`} 
                  value={form.clientId || ''} 
                  onChange={e => {
                    const clientObj = clients.find(c => c.id === e.target.value);
                    setForm({...form, clientId: clientObj?.id || null, client: clientObj?.company || clientObj?.name || ''});
                  }}
                >
                  <option value="">Select a Company Name</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                </select>
                {errors.client && <span className="estimations-error-text">{errors.client}</span>}
              </div>
              <div className="estimations-field">
                <label className="estimations-label">Project *</label>
                <select className={`estimations-select ${errors.projectId ? 'error' : ''}`} value={form.projectId || ''} onChange={e => setForm({...form, projectId: e.target.value})}>
                  <option value="">Select a Project</option>
                  {projects.filter(p => !form.clientId || p.clientId === form.clientId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {errors.projectId && <span className="estimations-error-text">{errors.projectId}</span>}
              </div>
              <div className="estimations-field">
                <label className="estimations-label">Estimation Hrs *</label>
                <input type="number" className={`estimations-input ${errors.estimatedHours ? 'error' : ''}`} min="0" step="0.5" value={form.estimatedHours} onChange={e => setForm({...form, estimatedHours: parseFloat(e.target.value) || 0})} />
                {errors.estimatedHours && <span className="estimations-error-text">{errors.estimatedHours}</span>}
              </div>
              <div className="estimations-field" style={{ gridColumn: 'span 2' }}>
                <label className="estimations-label">Description</label>
                <textarea className="estimations-textarea" rows="3" placeholder="Estimation details..." value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
            </div>
            <div className="estimations-form-actions">
              <button className="estimations-btn-secondary" onClick={() => { setShowForm(false); setErrors({}); }}>Cancel</button>
              <button className="estimations-btn-primary" onClick={handleAdd}>Save Estimation</button>
            </div>
          </div>
        ) : (
          <div className="estimations-table-container">
            {estimations.length === 0 ? (
              <div className="estimations-empty-state">
                <div className="estimations-empty-icon">
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </div>
                <h3 className="estimations-empty-text">No Estimations Found</h3>
                <p className="estimations-empty-desc">Create task estimations to calculate labor and effort before deploying them to your active board.</p>
                <button className="estimations-btn-outline" onClick={() => setShowForm(true)}>Create First Estimation</button>
              </div>
            ) : (
              <table className="estimations-table">
                <thead>
                  <tr>
                    <th>Est. ID</th>
                    <th>Task Name</th>
                    <th>Company</th>
                    <th>Project</th>
                    <th>Estimation Hrs</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {estimations.map(est => (
                    <tr key={est.id}>
                      <td style={{ fontWeight: '600', color: '#334155' }}>{est.estimationNo}</td>
                      <td style={{ fontWeight: '600' }}>{est.taskName}</td>
                      <td>{est.clientRef?.company || est.client || '-'}</td>
                      <td>{est.projectRef?.name || '-'}</td>
                      <td style={{ fontWeight: '600', color: '#2563eb' }}>{est.estimatedHours} hrs</td>
                      <td>
                        <span className={`estimations-status-pill ${est.status?.toLowerCase() === 'converted' ? 'converted' : 'pending'}`}>
                          {est.status || 'Pending'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="estimations-action-group">
                          {est.status !== 'Converted' && (
                            <button className="estimations-action-btn convert" onClick={() => handleConvertClick(est)} title="Convert to Task">
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
                          )}
                          <button className="estimations-action-btn" onClick={() => handleEdit(est)} title="Edit">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          </button>
                          <button className="estimations-action-btn delete" onClick={() => handleDelete(est.id)} title="Delete">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>

      {/* Convert Modal */}
      {convertModal.isOpen && (
        <div className="task-drawer-overlay" style={{ zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', width: '600px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.25rem' }}>Convert to Task</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Converting <strong>{convertModal.estimation.taskName}</strong>. Please provide the remaining task details.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Assignee</label>
                <select className="estimations-select" value={convertForm.assignees} onChange={e => setConvertForm({...convertForm, assignees: e.target.value})}>
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Project</label>
                <select className="estimations-select" value={convertForm.projectId} onChange={e => setConvertForm({...convertForm, projectId: e.target.value, taskListId: ''})}>
                  <option value="">-- Select Project --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Task List</label>
                <select className="estimations-select" value={convertForm.taskListId} onChange={e => setConvertForm({...convertForm, taskListId: e.target.value})}>
                  <option value="">-- Select List --</option>
                  {taskLists.filter(tl => tl.projectId === convertForm.projectId).map(tl => <option key={tl.id} value={tl.id}>{tl.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Assigned Date</label>
                <input type="date" className="estimations-input" value={convertForm.assignedDate} onChange={e => setConvertForm({...convertForm, assignedDate: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Delivery Date</label>
                <input type="date" className="estimations-input" value={convertForm.dueDate} onChange={e => setConvertForm({...convertForm, dueDate: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Priority</label>
                <select className="estimations-select" value={convertForm.priority} onChange={e => setConvertForm({...convertForm, priority: e.target.value})}>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Type</label>
                <select className="estimations-select" value={convertForm.taskType} onChange={e => setConvertForm({...convertForm, taskType: e.target.value})}>
                  <option value="Feature">Feature</option>
                  <option value="Bug">Bug</option>
                  <option value="Support">Support</option>
                  <option value="Internal">Internal</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="estimations-btn-secondary" onClick={() => setConvertModal({ isOpen: false, estimation: null })}>Cancel</button>
              <button className="estimations-btn-primary" onClick={submitConvert}>Convert</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
