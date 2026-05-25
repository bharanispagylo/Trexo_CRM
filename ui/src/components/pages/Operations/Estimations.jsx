import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useAlert } from '../../../context/AlertContext';
import './Estimations.css';

export default function Estimations({ user }) {
  const [estimations, setEstimations] = useState([]);

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ taskName: '', description: '', client: '', clientId: '', projectId: '', estimatedHours: 0 });
  const [errors, setErrors] = useState({});
  const { alert, confirm } = useAlert();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [estData, projData] = await Promise.all([
        api.get('/estimations'),
        api.get('/projects')
      ]);
      setEstimations(estData || []);
      setProjects(projData || []);
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
        client: !form.client?.trim() ? 'Client is required' : '',
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

  const handleConvert = (id) => {
    confirm('Convert this estimation into a Task?', async () => {
      setIsSaving(true);
      try {
        await api.post(`/estimations/${id}/convert`);
        alert('Estimation converted to Task successfully!', 'success', 'Success');
        fetchData();
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to convert estimation', 'error', 'Error');
      } finally {
        setIsSaving(false);
      }
    }, 'Convert to Task');
  };

  if (loading || isSaving) return <div className="loading-screen">{isSaving ? 'Saving...' : 'Loading Estimations...'}</div>;

  return (
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
                <label className="estimations-label">Client *</label>
                <input className={`estimations-input ${errors.client ? 'error' : ''}`} placeholder="e.g. Acme Corp" value={form.client || ''} onChange={e => setForm({...form, client: e.target.value})} />
                {errors.client && <span className="estimations-error-text">{errors.client}</span>}
              </div>
              <div className="estimations-field">
                <label className="estimations-label">Project *</label>
                <select className={`estimations-select ${errors.projectId ? 'error' : ''}`} value={form.projectId || ''} onChange={e => setForm({...form, projectId: e.target.value})}>
                  <option value="">Select a Project</option>
                  {projects.filter(p => !form.client || p.client?.toLowerCase().includes(form.client.toLowerCase())).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                    <th>Client</th>
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
                      <td>{est.client || est.clientRef?.name || '-'}</td>
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
                            <button className="estimations-action-btn convert" onClick={() => handleConvert(est.id)} title="Convert to Task">
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
  );
}
