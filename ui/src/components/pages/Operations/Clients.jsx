import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useAlert } from '../../../context/AlertContext';
import './Clients.css';

export default function Clients({ user }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', company: '' });
  const { alert, confirm } = useAlert();

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const data = await api.get('/clients');
      setClients(data || []);
    } catch (error) {
      console.error('Fetch error:', error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.company.trim()) {
      alert("Company Name is required.", "error");
      return;
    }
    if (!form.name.trim()) {
      alert("Primary Contact is required.", "error");
      return;
    }
    setIsSaving(true);
    
    // We send defaults for fields that are removed from form, but preserve other fields if editing
    const sanitizedForm = {
      ...form,
      name: form.name.trim(),
      company: form.company.trim(),
      email: form.email || '',
      phone: form.phone || '',
      address: form.address || '',
      status: form.status || 'Active',
      clientType: form.clientType || 'Direct',
      parentAgencyId: form.parentAgencyId || null
    };

    try {
      if (form.id) {
        await api.put(`/clients/${form.id}`, sanitizedForm);
        alert("Client updated successfully!", "success");
      } else {
        await api.post('/clients', sanitizedForm);
        alert("Client created successfully!", "success");
      }
      setShowForm(false);
      fetchClients();
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save client', "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    confirm('Are you sure you want to delete this client?', async () => {
      setIsSaving(true);
      try {
        await api.delete(`/clients/${id}`);
        alert('Client deleted successfully', 'success');
        fetchClients();
      } catch (error) {
        console.error('Delete error:', error);
        alert(error.message || 'Failed to delete client', 'error');
      } finally {
        setIsSaving(false);
      }
    });
  };

  const openForm = (client = null) => {
    if (client) {
      setForm({ ...client });
    } else {
      setForm({ id: '', name: '', company: '', email: '', phone: '', address: '', status: 'Active', clientType: 'Direct', parentAgencyId: '' });
    }
    setShowForm(true);
  };

  if (loading || isSaving) return <div className="loading-screen">{isSaving ? 'Saving...' : 'Loading Clients...'}</div>;

  return (
    <div className="clients-page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Client Management</h2>
        <button className="clients-btn-submit clients-btn-add" onClick={() => openForm()}>
          <span className="clients-btn-text">+ New Client</span>
          <span className="clients-btn-icon">+</span>
        </button>
      </div>

      {showForm && (
        <div className="clients-form-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>{form.id ? 'Edit Client' : 'Add New Client'}</h3>
            <button className="client-action-btn" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <div className="clients-form-grid">
            <div className="clients-field">
              <label className="clients-label">Company Name *</label>
              <input className="clients-input" value={form.company || ''} onChange={e => setForm({...form, company: e.target.value})} placeholder="Company Name" />
            </div>
            <div className="clients-field">
              <label className="clients-label">Primary Contact *</label>
              <input className="clients-input" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} placeholder="Primary Contact" />
            </div>
          </div>
          <div className="clients-form-actions" style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
            <button className="clients-btn-submit" onClick={handleSave}>Save</button>
            <button className="clients-btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="clients-table-container">
        <table className="clients-table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Primary Contact</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(client => (
              <tr key={client.id}>
                <td data-label="Company"><strong>{client.company || '-'}</strong></td>
                <td data-label="Contact">{client.name || '-'}</td>
                <td data-label="Actions" style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: '0.25rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <button 
                      className="client-action-btn" 
                      title="Edit Client"
                      onClick={() => openForm(client)}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'block' }}>
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button 
                      className="client-action-btn delete" 
                      title="Delete Client"
                      onClick={() => handleDelete(client.id)}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'block' }}>
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No clients found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
