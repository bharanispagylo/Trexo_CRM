import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useAlert } from '../../../context/AlertContext';
import './Projects.css'; // Reuse Projects styling

export default function Clients({ user }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', email: '', phone: '', company: '', address: '', status: 'Active', clientType: 'Direct', parentAgencyId: '' });
  const { alert, confirm } = useAlert();

  const [filterType, setFilterType] = useState('All');
  const [filterAgency, setFilterAgency] = useState('All');

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
    if (!form.name.trim()) {
      alert("Client name is required.", "error");
      return;
    }
    setIsSaving(true);
    try {
      if (form.id) {
        await api.put(`/clients/${form.id}`, form);
        alert("Client updated successfully!", "success");
      } else {
        await api.post('/clients', form);
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
        alert('Failed to delete client', 'error');
      } finally {
        setIsSaving(false);
      }
    });
  };

  const openForm = (client = null) => {
    if (client) {
      setForm({ ...client, parentAgencyId: client.parentAgencyId || '', clientType: client.clientType || 'Direct' });
    } else {
      setForm({ id: '', name: '', email: '', phone: '', company: '', address: '', status: 'Active', clientType: 'Direct', parentAgencyId: '' });
    }
    setShowForm(true);
  };

  if (loading || isSaving) return <div className="loading-screen">{isSaving ? 'Saving...' : 'Loading Clients...'}</div>;

  const filteredClients = clients.filter(c => {
    const cType = c.clientType || 'Direct';
    if (filterType !== 'All' && cType !== filterType) return false;
    if (filterAgency !== 'All' && c.parentAgencyId !== filterAgency) return false;
    return true;
  });

  const agencies = clients.filter(c => c.clientType === 'Agency');

  return (
    <div className="saas-module-container">
      <div className="module-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Client Management</h2>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select 
            className="saas-select" 
            style={{ width: 'auto', padding: '0.5rem 1rem' }} 
            value={filterType} 
            onChange={(e) => { setFilterType(e.target.value); if(e.target.value !== 'Agency Client') setFilterAgency('All'); }}
          >
            <option value="All">All Types</option>
            <option value="Direct">Direct Clients</option>
            <option value="Agency">Agencies</option>
            <option value="Agency Client">Agency Sub-Clients</option>
          </select>
          
          {filterType === 'Agency Client' && (
            <select className="saas-select" style={{ width: 'auto', padding: '0.5rem 1rem' }} value={filterAgency} onChange={(e) => setFilterAgency(e.target.value)}>
              <option value="All">All Agencies</option>
              {agencies.map(ag => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
            </select>
          )}

          <button className="saas-btn-primary" onClick={() => openForm()}>+ New Client</button>
        </div>
      </div>

      {showForm && (
        <div className="saas-form-card" style={{ marginBottom: '2rem' }}>
          <div className="form-header">
            <h3 className="form-title">{form.id ? 'Edit Client' : 'Add New Client'}</h3>
            <button className="action-btn" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="saas-field">
              <label className="saas-label">Name *</label>
              <input className="saas-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Client Name" />
            </div>
            <div className="saas-field">
              <label className="saas-label">Company</label>
              <input className="saas-input" value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="Company Name" />
            </div>
            <div className="saas-field">
              <label className="saas-label">Email</label>
              <input className="saas-input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email Address" />
            </div>
            <div className="saas-field">
              <label className="saas-label">Phone</label>
              <input className="saas-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone Number" />
            </div>
            <div className="saas-field" style={{ gridColumn: 'span 2' }}>
              <label className="saas-label">Address</label>
              <input className="saas-input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Full Address" />
            </div>
            <div className="saas-field">
              <label className="saas-label">Client Type</label>
              <select className="saas-select" value={form.clientType || 'Direct'} onChange={e => setForm({...form, clientType: e.target.value, parentAgencyId: e.target.value !== 'Agency Client' ? null : form.parentAgencyId})}>
                <option value="Direct">Direct Client</option>
                <option value="Agency">Agency</option>
                <option value="Agency Client">Agency Client (Sub-client)</option>
              </select>
            </div>
            {form.clientType === 'Agency Client' && (
              <div className="saas-field">
                <label className="saas-label">Parent Agency</label>
                <select className="saas-select" value={form.parentAgencyId || ''} onChange={e => setForm({...form, parentAgencyId: e.target.value})}>
                  <option value="">Select Parent Agency...</option>
                  {clients.filter(c => c.clientType === 'Agency').map(agency => (
                    <option key={agency.id} value={agency.id}>{agency.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="saas-field">
              <label className="saas-label">Status</label>
              <select className="saas-select" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="form-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button className="saas-btn-submit" onClick={handleSave}>Save</button>
            <button className="saas-btn-cancel" onClick={() => setShowForm(false)} style={{ background: 'white', border: '1px solid #e2e8f0', padding: '0.65rem 1.25rem', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="saas-table-container">
        <table className="saas-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Contact</th>
              <th>Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map(client => (
              <tr key={client.id}>
                <td><strong>{client.name}</strong></td>
                <td>{client.company || '-'}</td>
                <td>
                  <div style={{ fontSize: '0.85rem' }}>{client.email || '-'}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{client.phone || '-'}</div>
                </td>
                <td>
                  <span style={{ 
                    padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                    backgroundColor: client.clientType === 'Agency' ? '#e0e7ff' : client.clientType === 'Agency Client' ? '#f3e8ff' : '#f1f5f9',
                    color: client.clientType === 'Agency' ? '#4338ca' : client.clientType === 'Agency Client' ? '#7e22ce' : '#475569'
                  }}>
                    {client.clientType || 'Direct'}
                  </span>
                  {client.clientType === 'Agency Client' && client.parentAgencyId && (
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                      Agency: {clients.find(c => c.id === client.parentAgencyId)?.name || 'Unknown'}
                    </div>
                  )}
                </td>
                <td>
                  <span style={{ 
                    padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold',
                    backgroundColor: client.status === 'Active' ? '#dcfce7' : '#f1f5f9',
                    color: client.status === 'Active' ? '#16a34a' : '#64748b'
                  }}>
                    {client.status}
                  </span>
                </td>
                <td>
                  <button className="action-btn" onClick={() => openForm(client)}>Edit</button>
                  <button className="action-btn" onClick={() => handleDelete(client.id)} style={{ color: '#ef4444', marginLeft: '0.5rem' }}>Delete</button>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No clients found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
