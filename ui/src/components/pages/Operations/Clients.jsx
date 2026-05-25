import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useAlert } from '../../../context/AlertContext';
import './Clients.css';

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
    <div className="clients-page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem', maxWidth: '1000px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Client Management</h2>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select 
            className="clients-select" 
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
            <select className="clients-select" style={{ width: 'auto', padding: '0.5rem 1rem' }} value={filterAgency} onChange={(e) => setFilterAgency(e.target.value)}>
              <option value="All">All Agencies</option>
              {agencies.map(ag => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
            </select>
          )}

          <button className="clients-btn-submit" onClick={() => openForm()}>+ New Client</button>
        </div>
      </div>

      {showForm && (
        <div className="clients-form-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>{form.id ? 'Edit Client' : 'Add New Client'}</h3>
            <button className="client-action-btn" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <div className="clients-form-grid">
            <div className="clients-field">
              <label className="clients-label">Name *</label>
              <input className="clients-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Client Name" />
            </div>
            <div className="clients-field">
              <label className="clients-label">Company</label>
              <input className="clients-input" value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="Company Name" />
            </div>
            <div className="clients-field">
              <label className="clients-label">Email</label>
              <input className="clients-input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email Address" />
            </div>
            <div className="clients-field">
              <label className="clients-label">Phone</label>
              <input className="clients-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone Number" />
            </div>
            <div className="clients-field full-width" style={{ gridColumn: 'span 2' }}>
              <label className="clients-label">Address</label>
              <input className="clients-input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Full Address" />
            </div>
            <div className="clients-field">
              <label className="clients-label">Client Type</label>
              <select className="clients-select" value={form.clientType || 'Direct'} onChange={e => setForm({...form, clientType: e.target.value, parentAgencyId: e.target.value !== 'Agency Client' ? null : form.parentAgencyId})}>
                <option value="Direct">Direct Client</option>
                <option value="Agency">Agency</option>
                <option value="Agency Client">Agency Client (Sub-client)</option>
              </select>
            </div>
            {form.clientType === 'Agency Client' && (
              <div className="clients-field">
                <label className="clients-label">Parent Agency</label>
                <select className="clients-select" value={form.parentAgencyId || ''} onChange={e => setForm({...form, parentAgencyId: e.target.value})}>
                  <option value="">Select Parent Agency...</option>
                  {clients.filter(c => c.clientType === 'Agency').map(agency => (
                    <option key={agency.id} value={agency.id}>{agency.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="clients-field">
              <label className="clients-label">Status</label>
              <select className="clients-select" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
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
              <th>Name</th>
              <th>Company</th>
              <th>Contact</th>
              <th>Type</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map(client => (
              <tr key={client.id}>
                <td><strong>{client.name}</strong></td>
                <td>{client.company || '-'}</td>
                <td>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{client.email || '-'}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>{client.phone || '-'}</div>
                </td>
                <td>
                  <span className={`client-type-pill ${client.clientType === 'Agency' ? 'agency' : client.clientType === 'Agency Client' ? 'subclient' : 'direct'}`}>
                    {client.clientType || 'Direct'}
                  </span>
                  {client.clientType === 'Agency Client' && client.parentAgencyId && (
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                      Agency: {clients.find(c => c.id === client.parentAgencyId)?.name || 'Unknown'}
                    </div>
                  )}
                </td>
                <td>
                  <span className={`client-status-pill ${client.status === 'Active' ? 'active' : 'inactive'}`}>
                    {client.status}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="client-action-btn" onClick={() => openForm(client)}>Edit</button>
                  <button className="client-action-btn delete" onClick={() => handleDelete(client.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No clients found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
