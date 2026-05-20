import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useAlert } from '../../../context/AlertContext';

export default function Salary() {
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: '', month: '', emps: '', total: '', status: 'Draft' });
  const { alert } = useAlert();

  // ── FETCH from API ──
  const fetchPayrolls = async () => {
    setLoading(true);
    try {
      const data = await api.get('/salaries');
      setPayrolls(data || []);
    } catch (error) {
      console.error('Fetch error:', error);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPayrolls(); }, []);

  // ── INSERT into API ──
  const handleAdd = async () => {
    if (!form.month.trim()) return;
    try {
      await api.post('/salaries', {
        id: form.id || `PR-${Date.now().toString().slice(-3)}`,
        month: form.month,
        emps: parseInt(form.emps) || 0,
        total: form.total,
        status: form.status,
      });
      setForm({ id: '', month: '', emps: '', total: '', status: 'Draft' });
      setShowForm(false);
      fetchPayrolls();
    } catch (error) {
      console.error('Insert error:', error);
      alert('Failed to add payroll: ' + error.message, 'error', 'Error');
    }
  };

  return (
    <div className="page-container app-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Salary Management</h1>
          <p className="page-desc">Process payroll and manage compensation.</p>
        </div>
        <button className="btn btn-primary" style={{ padding: '0.6rem 0.75rem', fontSize: '0.875rem', width: '140px', position: 'absolute', top: '2rem', right: '2rem' }} onClick={() => setShowForm(true)}>Process Payroll</button>
      </div>

      {/* Add Payroll Form */}
      {showForm && (
        <div className="data-card" style={{ marginBottom: '1.5rem', backgroundColor: '#f8fafc' }}>
          <h3 style={{ marginTop: 0 }}>New Payroll</h3>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <input type="text" placeholder="PR-2025-06" value={form.id} onChange={e => setForm({...form, id: e.target.value})} className="btn btn-outline" style={{ flex: 1, backgroundColor: 'white' }} />
            <input type="text" placeholder="June 2025 *" value={form.month} onChange={e => setForm({...form, month: e.target.value})} className="btn btn-outline" style={{ flex: 1, backgroundColor: 'white' }} />
            <input type="number" placeholder="Employees" value={form.emps} onChange={e => setForm({...form, emps: e.target.value})} className="btn btn-outline" style={{ flex: 1, backgroundColor: 'white' }} />
            <input type="text" placeholder="₹ Total" value={form.total} onChange={e => setForm({...form, total: e.target.value})} className="btn btn-outline" style={{ flex: 1, backgroundColor: 'white' }} />
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="btn btn-outline" style={{ backgroundColor: 'white' }}>
              <option>Draft</option><option>Processed</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary btn-save" onClick={handleAdd}>Save</button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="data-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Payroll ID</th>
              <th>Month</th>
              <th>Employees</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading...</td></tr>
            ) : payrolls.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No payrolls found.</td></tr>
            ) : (
              payrolls.map(pr => (
                <tr key={pr.id}>
                  <td><strong>{pr.id}</strong></td>
                  <td>{pr.month}</td>
                  <td>{pr.emps}</td>
                  <td>{pr.total}</td>
                  <td>
                    <span className={`badge ${pr.status === 'Processed' ? 'badge-green' : 'badge-blue'}`}>
                      {pr.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Details</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
