import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useAlert } from '../../../context/AlertContext';
import './TrackTeam.css';
import Tasks from './Tasks';

const isAssigneeMatch = (assigneeStr, employeeName) => {
  if (!assigneeStr || !employeeName) return false;
  
  // Normalize both strings to alphanumeric lowercase to handle spacing, punctuation, and email matches
  const cleanString = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
  const empClean = cleanString(employeeName);
  
  // Split the assignees list (comma-separated) and clean each name
  const assigneesList = assigneeStr.split(',').map(a => cleanString(a));
  
  return assigneesList.some(assignee => {
    if (!assignee) return false;
    // Match if one is a substring of another (handles "Muthukumar" matching "Muthu Kumar" or first name only)
    return assignee.includes(empClean) || empClean.includes(assignee);
  });
};

export default function TrackTeam({ user }) {
  const { alert, confirm } = useAlert();
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [viewingEmployeeTasks, setViewingEmployeeTasks] = useState(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  
  const [newMemberForm, setNewMemberForm] = useState({
    name: '',
    role: '',
    type: 'Employee'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empData, taskData, userData] = await Promise.all([
        api.get('/employees'),
        api.get('/tasks'),
        api.get('/users')
      ]);
      setEmployees(empData || []);
      setTasks(taskData || []);
      setUsers(userData || []);
    } catch (err) {
      console.error('Error fetching tracker details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUserSelectChange = (e) => {
    const userId = e.target.value;
    setSelectedUserId(userId);
    const foundUser = users.find(u => u.id === userId);
    if (foundUser) {
      const displayName = foundUser.fullName || `${foundUser.firstName || ''} ${foundUser.lastName || ''}`.trim();
      setNewMemberForm({
        name: displayName,
        role: foundUser.designation || '',
        type: foundUser.role === 'Admin' ? 'Team Lead' : 'Employee'
      });
    } else {
      setNewMemberForm({
        name: '',
        role: '',
        type: 'Employee'
      });
    }
  };

  const handleDeleteMember = (id, name) => {
    confirm(`Are you sure you want to remove ${name} from the tracking dashboard?`, async () => {
      setLoading(true);
      try {
        await api.delete(`/employees/${id}`);
        alert('Team member removed successfully!', 'success', 'Success');
        await fetchData();
      } catch (err) {
        console.error('Delete error:', err);
        alert('Failed to remove team member: ' + err.message, 'error', 'Error');
      } finally {
        setLoading(false);
      }
    }, 'Remove Team Member');
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberForm.name.trim() || !newMemberForm.role.trim()) {
      alert('Please select an employee and specify their role/designation.', 'warning', 'Missing Fields');
      return;
    }
    
    setIsSaving(true);
    try {
      await api.post('/employees', {
        id: `EMP-${Date.now().toString().slice(-3)}`,
        name: newMemberForm.name,
        role: newMemberForm.role,
        phoneNo: '',
        emergencyNo: '',
        status: 'Active',
        type: newMemberForm.type,
        projectName: '-',
        projectStatus: 'Inactive'
      });
      
      alert('Team member added successfully to tracking dashboard!', 'success', 'Success');
      setNewMemberForm({
        name: '',
        role: '',
        type: 'Employee'
      });
      setSelectedUserId('');
      setShowAddMemberModal(false);
      await fetchData();
    } catch (err) {
      console.error('Insert error:', err);
      alert('Failed to add team member: ' + err.message, 'error', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isSaving) return <div className="loading-screen">{isSaving ? 'Adding Member...' : 'Loading Tracker Dashboard...'}</div>;

  if (viewingEmployeeTasks) {
    return (
      <div className="track-team-page" style={{ padding: '0' }}>
        <div style={{ padding: '1rem 3rem 0 3rem' }}>
          <button 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#2563eb', 
              fontSize: '0.85rem', 
              fontWeight: '600', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.25rem',
              padding: 0,
              marginBottom: '1rem'
            }}
            onClick={() => setViewingEmployeeTasks(null)}
          >
            ← Back to Team Members
          </button>
        </div>
        <Tasks 
          user={user}
          initialAssigneeFilter={viewingEmployeeTasks}
          onClearAssigneeFilter={() => setViewingEmployeeTasks(null)}
        />
      </div>
    );
  }

  // Filter tasks assigned to currently selected member
  const selectedMemberTasks = selectedMember 
    ? tasks.filter(t => isAssigneeMatch(t.assignees, selectedMember.name))
    : [];

  return (
    <div className="track-team-page">
      <div className="track-main-layout">
        {/* TEAM MEMBER LIST */}
        <div className="team-list-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>Team Members</h3>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                className="saas-btn-submit" 
                style={{ background: '#2563eb', padding: '0.5rem 1.25rem', fontSize: '0.85rem', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                onClick={() => {
                  setSelectedUserId('');
                  setNewMemberForm({ name: '', role: '', type: 'Employee' });
                  setShowAddMemberModal(true);
                }}
              >
                + Add Member
              </button>
              <button 
                className="saas-btn-submit" 
                style={{ background: 'white', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#475569', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center' }}
                onClick={fetchData}
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                Refresh
              </button>
            </div>
          </div>

          {employees.length === 0 ? (
            <div style={{ padding: '3rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', textAlign: 'center', color: '#94a3b8' }}>
              No employees currently registered.
            </div>
          ) : (
            <div className="team-list-container">
              <table className="team-list-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => (
                    <tr key={emp.id}>
                      <td>
                        <div className="td-member-info">
                          <div className="member-avatar-sm">
                            {emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <span className="member-name-text">{emp.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="role-tag-mini">{emp.role}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button 
                            className="member-action-btn-sm" 
                            title="View Assigned Tasks"
                            onClick={() => setViewingEmployeeTasks(emp.name)}
                          >
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            View Tasks
                          </button>
                          <button 
                            className="member-delete-icon-btn" 
                            title="Remove Member"
                            onClick={() => handleDeleteMember(emp.id, emp.name)}
                          >
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'block' }}>
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ADD MEMBER MODAL */}
      {showAddMemberModal && (
        <div className="activity-detail-modal" onClick={() => setShowAddMemberModal(false)}>
          <div className="modal-content-card animate-slide-up" onClick={e => e.stopPropagation()} style={{ width: '450px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>Add Team Member</h3>
              <button className="modal-close" onClick={() => setShowAddMemberModal(false)}>✕</button>
            </div>

            <form onSubmit={handleAddMember}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div className="saas-field">
                  <label className="saas-label">Employee Name *</label>
                  <select 
                    className="saas-select"
                    value={selectedUserId}
                    onChange={handleUserSelectChange}
                    required
                  >
                    <option value="">-- Select Registered User --</option>
                    {users.map(u => {
                      const displayName = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim();
                      return (
                        <option key={u.id} value={u.id}>
                          {displayName} {u.email ? `(${u.email})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="saas-field">
                  <label className="saas-label">Role in project *</label>
                  <input 
                    type="text" 
                    className="saas-input"
                    placeholder="e.g. Frontend Engineer"
                    value={newMemberForm.role}
                    onChange={e => setNewMemberForm({ ...newMemberForm, role: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                <button 
                  type="button" 
                  className="saas-btn-cancel" 
                  style={{ background: 'white', border: '1px solid #cbd5e1', padding: '0.6rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
                  onClick={() => setShowAddMemberModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="saas-btn-submit"
                  style={{ background: '#2563eb', padding: '0.6rem 1.5rem', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                >
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL & ASSIGNED TASKS MODAL */}
      {selectedMember && (
        <div className="activity-detail-modal" onClick={() => setSelectedMember(null)}>
          <div className="modal-content-card animate-slide-up" onClick={e => e.stopPropagation()} style={{ width: '700px', maxWidth: '95%' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>Member Profile & Tasks</h3>
              <button className="modal-close" onClick={() => setSelectedMember(null)}>✕</button>
            </div>
            
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem' }}>
              <div className="member-avatar-lg" style={{ width: '60px', height: '60px', fontSize: '1.3rem' }}>
                {selectedMember.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.15rem', fontWeight: '800' }}>{selectedMember.name}</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{selectedMember.role} • ID: #{selectedMember.id} • {selectedMember.type || 'Employee'}</p>
              </div>
            </div>

            {/* ASSIGNED TASKS WORKLOAD LIST */}
            <div>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: '800', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Assigned Tasks</span>
                <span style={{ fontSize: '0.8rem', background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '12px' }}>
                  {selectedMemberTasks.length} Tasks
                </span>
              </h4>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', maxHeight: '250px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: '700' }}>Task</th>
                      <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: '700' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: '700' }}>Priority</th>
                      <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: '700' }}>Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMemberTasks.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                          No tasks assigned to this team member.
                        </td>
                      </tr>
                    ) : (
                      selectedMemberTasks.map(task => (
                        <tr key={task.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: '600', color: '#0f172a' }}>
                            {task.title}
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '1px' }}>#{task.id.slice(-6).toUpperCase()}</div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{
                              background: task.status === 'Completed' || task.status === 'Delivered' ? '#dcfce7' : task.status === 'In Progress' ? '#dbeafe' : '#f1f5f9',
                              color: task.status === 'Completed' || task.status === 'Delivered' ? '#16a34a' : task.status === 'In Progress' ? '#2563eb' : '#475569',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '700'
                            }}>
                              {task.status || 'To Do'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{
                              color: task.priority === 'High' || task.priority === 'Critical' ? '#ef4444' : task.priority === 'Medium' ? '#ea580c' : '#64748b',
                              fontSize: '0.75rem',
                              fontWeight: '700'
                            }}>
                              {task.priority || 'Medium'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                            {task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
              <button 
                className="saas-btn-submit" 
                style={{ background: '#2563eb', padding: '0.6rem 1.5rem', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                onClick={() => setSelectedMember(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
