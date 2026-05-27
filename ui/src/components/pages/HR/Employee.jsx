import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import './Employee.css';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAlert } from '../../../context/AlertContext';

export default function Employee() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ 
    id: '', 
    name: '', 
    role: '', 
    phoneNo: '', 
    emergencyNo: '',
    status: 'Active',
    type: 'Employee',
    email: '',
    password: ''
  });
  const { can } = usePermissions();
  const { alert, confirm } = useAlert();

  useEffect(() => {
    const handleOpenForm = () => setShowForm(true);
    window.addEventListener('openEmployeeForm', handleOpenForm);
    return () => window.removeEventListener('openEmployeeForm', handleOpenForm);
  }, []);

  // ── FETCH from API ──
  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const data = await api.get('/employees');
      setEmployees(data || []);
    } catch (error) {
      console.error('Fetch error:', error);
    }
    setLoading(false);
  };

  useEffect(() => { fetchEmployees(); }, []);

  // ── INSERT into API ──
  const handleAdd = async () => {
    if (!form.name?.trim() || !form.role?.trim()) {
      alert("Please fill out all mandatory fields: Full Name and Role.", 'warning', 'Required Fields');
      return;
    }
    setIsSaving(true);
    try {
      const empId = form.id || `EMP-${Date.now().toString().slice(-3)}`;
      
      // 1. Create Employee Profile
      await api.post('/employees', {
        id: empId,
        name: form.name,
        role: form.role,
        phoneNo: form.phoneNo,
        emergencyNo: form.emergencyNo,
        status: form.status,
        type: form.type
      });

      // 2. Create User Account automatically
      if (form.email && form.password) {
        try {
          await api.post('/users', {
            firstName: form.name.split(' ')[0],
            lastName: form.name.split(' ').slice(1).join(' '),
            email: form.email,
            password: form.password,
            role: 'Employee',
            empId: empId
          });
        } catch (err) {
          console.error("User creation failed during employee creation", err);
          alert('Employee created, but User account failed (Email might already exist).', 'warning', 'Partial Success');
          setForm({ id: '', name: '', role: '', phoneNo: '', emergencyNo: '', status: 'Active', type: 'Employee', email: '', password: '' });
          setShowForm(false);
          fetchEmployees();
          setIsSaving(false);
          return;
        }
      }

      alert('Employee profile and User account created successfully!', 'success', 'Success');
      setForm({ id: '', name: '', role: '', phoneNo: '', emergencyNo: '', status: 'Active', type: 'Employee', email: '', password: '' });
      setShowForm(false);
      fetchEmployees();
    } catch (error) {
      console.error('Insert error:', error);
      alert('Failed to add employee: ' + error.message, 'error', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    confirm('Delete this employee record? This cannot be undone.', async () => {
      setIsSaving(true);
      try {
        await api.delete(`/employees/${id}`);
        alert('Employee record deleted successfully.', 'success', 'Deleted');
        fetchEmployees();
      } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete employee.', 'error', 'Error');
      } finally {
        setIsSaving(false);
      }
    }, 'Delete Employee');
  };

  if (loading || isSaving) return <div className="loading-screen">{isSaving ? 'Saving...' : 'Loading Employees...'}</div>;

  return (
    <div className="employee-page page-container">
      {/* Tab Navigation */}
      <div className="saas-tabs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="saas-tab active">Directory</button>
         </div>
         {can('employees', 'create') && (
           <button className="saas-btn-add" onClick={() => setShowForm(true)}>
             + Add Employee
           </button>
         )}
      </div>

      {/* Add Employee Form (Professional Alignment) */}
      {showForm && (
        <div className="saas-form-card">
          <div className="form-header">
            <h3 className="form-title">New Employee Profile</h3>
            <button className="form-close-btn" onClick={() => setShowForm(false)}>✕</button>
          </div>
          
          <div className="form-grid">
            <div className="saas-field">
              <label className="saas-label">Full Name *</label>
              <input className="saas-input" placeholder="e.g. Santi Cazorla" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div className="saas-field">
              <label className="saas-label">Member Type</label>
              <select className="saas-select" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                <option value="Employee">Employee</option>
                <option value="Contractor">Contractor</option>
                <option value="Intern">Intern</option>
              </select>
            </div>
            <div className="saas-field">
              <label className="saas-label">Employee ID</label>
              <input className="saas-input" placeholder="e.g. EMP-004 (Auto if empty)" value={form.id} onChange={e => setForm({...form, id: e.target.value})} />
            </div>
            <div className="saas-field">
              <label className="saas-label">Role *</label>
              <input className="saas-input" placeholder="e.g. UI/UX Designer" value={form.role} onChange={e => setForm({...form, role: e.target.value})} />
            </div>
            <div className="saas-field">
              <label className="saas-label">Phone No</label>
              <input className="saas-input" placeholder="e.g. +91 9876543210" value={form.phoneNo} onChange={e => setForm({...form, phoneNo: e.target.value})} />
            </div>
            <div className="saas-field">
              <label className="saas-label">Emergency No</label>
              <input className="saas-input" placeholder="e.g. +91 9000000000" value={form.emergencyNo} onChange={e => setForm({...form, emergencyNo: e.target.value})} />
            </div>
            <div className="saas-field">
              <label className="saas-label">Current Status</label>
              <select className="saas-select" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            
            <div className="form-section-divider" style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
              <h4 className="section-subtitle">Login Account (Optional)</h4>
            </div>
            <div className="saas-field">
              <label className="saas-label">Login Email</label>
              <input className="saas-input" type="email" placeholder="employee@officecrm.in" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
            <div className="saas-field">
              <label className="saas-label">Login Password</label>
              <input className="saas-input" type="password" placeholder="Set a temporary password" value={form.password || ''} onChange={e => setForm({...form, password: e.target.value})} />
            </div>
          </div>



          <div className="form-actions">
            <button className="saas-btn-submit" onClick={handleAdd}>Save Profile</button>
            <button className="saas-btn-cancel" onClick={() => setShowForm(false)}>Discard</button>
          </div>
        </div>
      )}

      {/* Employee Table */}
      <div className="saas-table-container">
        <table className="saas-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Type</th>
              <th>Role</th>
              <th>Contact Info</th>
              <th>Emergency</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>No records found.</td></tr>
            ) : (
              employees.map(emp => (
                <tr key={emp.id}>
                  <td>
                    <div className="emp-name-box">
                       <div className="emp-avatar">
                         {emp.name.split(' ').map(n=>n[0]).join('')}
                       </div>
                       <div className="emp-text-group">
                          <div className="emp-main-text">{emp.name}</div>
                          <div className="emp-sub-text">#{emp.id}</div>
                       </div>
                    </div>
                  </td>
                  <td>
                    <span className="saas-type-badge">{emp.type || 'Employee'}</span>
                  </td>
                  <td>
                    <span className="emp-main-text">{emp.role}</span>
                  </td>
                  <td>
                    <span className="emp-main-text">{emp.phoneNo || '-'}</span>
                  </td>
                  <td>
                    <span className="emp-main-text" style={{ color: '#EF4444', fontWeight: 600 }}>{emp.emergencyNo || '-'}</span>
                  </td>
                  <td>
                    <span className={`saas-status-pill status-${emp.status.toLowerCase().replace(' ', '-')}`}>
                      {emp.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                     {can('employees', 'delete') && (
                       <button className="saas-action-btn" style={{ color: '#EF4444' }} onClick={() => handleDelete(emp.id)}>Remove</button>
                     )}
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
