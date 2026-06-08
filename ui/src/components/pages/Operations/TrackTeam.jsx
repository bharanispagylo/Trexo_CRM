import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import './TrackTeam.css';
import Tasks from './Tasks';
import { useAlert } from '../../../context/AlertContext';
import '../Administration/AddUser.css';

const isAssigneeMatch = (assigneeStr, userId) => {
  if (!assigneeStr || !userId) return false;
  return assigneeStr.includes(userId);
};

export default function TrackTeam({ user }) {
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);
  const [viewingEmployeeTasks, setViewingEmployeeTasks] = useState(null);
  
  // Alert hooks
  const { alert, confirm } = useAlert();

  // Member management states
  const [addingMember, setAddingMember] = useState(false);
  const [roles, setRoles] = useState(['Admin', 'Employee']);
  const [memberForm, setMemberForm] = useState({
    name: '',
    designation: '',
    role: 'Employee'
  });
  
  const fetchData = async () => {
    setLoading(true);
    try {
      const [taskData, teamData] = await Promise.all([
        api.get('/tasks'),
        api.get('/teams')
      ]);
      setTasks(taskData || []);
      setTeamMembers(teamData || []);
    } catch (err) {
      console.error('Error fetching tracker details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Fetch roles dynamically
    const fetchRoles = async () => {
      try {
        const roleData = await api.get('/roles/permissions');
        if (roleData) {
          const dynamicRoles = ['Admin', 'Employee'];
          roleData.forEach(r => {
            const rName = r.role.charAt(0).toUpperCase() + r.role.slice(1).toLowerCase();
            if (!dynamicRoles.includes(rName)) dynamicRoles.push(rName);
          });
          setRoles(dynamicRoles.sort((a, b) => a.localeCompare(b)));
        }
      } catch (error) {
        console.error('Fetch roles error:', error);
      }
    };
    fetchRoles();
  }, []);

  const handleSaveMember = async () => {
    if (!memberForm.name.trim()) {
      alert('Name is required.', 'warning', 'Validation Error');
      return;
    }
    const nameRegex = /^[a-zA-Z\s.]{2,50}$/;
    if (!nameRegex.test(memberForm.name.trim())) {
      alert('Name must contain only letters and be between 2-50 characters.', 'warning', 'Validation Error');
      return;
    }

    try {
      await api.post('/teams', {
        name: memberForm.name.trim(),
        role: memberForm.role,
        designation: memberForm.designation.trim() || null
      });
      alert('Team member added successfully!', 'success', 'Member Added');
      setAddingMember(false);
      setMemberForm({
        name: '',
        designation: '',
        role: 'Employee'
      });
      fetchData();
    } catch (err) {
      console.error('Error adding member:', err);
      alert('Failed to add member: ' + err.message, 'error', 'Error');
    }
  };

  const handleRemoveMember = (memberId, memberName) => {
    confirm(`Are you sure you want to remove ${memberName} from the team?`, async () => {
      try {
        await api.delete(`/teams/${memberId}`);
        alert('Team member removed successfully!', 'success', 'Member Removed');
        fetchData();
      } catch (err) {
        console.error('Error removing member:', err);
        alert('Failed to remove member: ' + err.message, 'error', 'Error');
      }
    }, 'Remove Team Member');
  };

  if (loading) return <div className="loading-screen">Loading Tracker Dashboard...</div>;

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
          initialAssigneeFilter={viewingEmployeeTasks.id}
          onClearAssigneeFilter={() => setViewingEmployeeTasks(null)}
        />
      </div>
    );
  }

  // Filter tasks assigned to currently selected member
  const selectedMemberTasks = selectedMember 
    ? tasks.filter(t => isAssigneeMatch(t.assignees, selectedMember.id))
    : [];

  if (addingMember) {
    return (
      <div className="track-team-page" style={{ padding: '2rem 3rem' }}>
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
            marginBottom: '1.5rem'
          }}
          onClick={() => setAddingMember(false)}
        >
          ← Back to Team Members
        </button>

        <div className="add-user-page">
          <div className="page-header">
            <h2 className="page-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>Add New Team Member</h2>
            <p className="page-subtitle" style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>Add a new member to the team.</p>
          </div>

          <div className="saas-form-container">
            <div className="form-grid">
              <div className="saas-field full-width">
                <label className="saas-label">Name *</label>
                <input 
                  className="saas-input" 
                  placeholder="Enter member name" 
                  value={memberForm.name} 
                  onChange={e => setMemberForm({...memberForm, name: e.target.value})} 
                />
              </div>

              <div className="saas-field">
                <label className="saas-label">Role</label>
                <select 
                  className="saas-select" 
                  value={memberForm.role} 
                  onChange={e => setMemberForm({...memberForm, role: e.target.value})}
                >
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="saas-field">
                <label className="saas-label">Designation</label>
                <input 
                  className="saas-input" 
                  placeholder="e.g. Software Developer" 
                  value={memberForm.designation} 
                  onChange={e => setMemberForm({...memberForm, designation: e.target.value})} 
                />
              </div>
            </div>

            <div className="form-actions">
              <button className="saas-btn-secondary" onClick={() => setAddingMember(false)}>Cancel</button>
              <button className="saas-btn-primary" onClick={handleSaveMember}>
                Save Member
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="track-team-page">
      <div className="track-main-layout">
        {/* TEAM MEMBER LIST */}
        <div className="team-list-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>Team Members</h3>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {user?.role?.toLowerCase() === 'admin' && (
                <button 
                  className="saas-btn-submit" 
                  style={{ background: '#2563eb', color: 'white', border: 'none', padding: '0.5rem 1rem', fontSize: '0.85rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center' }}
                  onClick={() => setAddingMember(true)}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}><path d="M12 5v14M5 12h14"></path></svg>
                  Add Member
                </button>
              )}
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

          {teamMembers.length === 0 ? (
            <div style={{ padding: '3rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', textAlign: 'center', color: '#94a3b8' }}>
              No members currently registered on the team.
            </div>
          ) : (
            <div className="team-list-container">
              <div className="table-responsive">
                <table className="team-list-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Role</th>
                      <th>Designation</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map(m => {
                      const displayName = m.name || 'Unknown';
                      return (
                        <tr key={m.id}>
                          <td>
                            <div className="td-member-info">
                              <div className="member-avatar-sm">
                                {displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                              </div>
                              <span className="member-name-text">{displayName}</span>
                            </div>
                          </td>
                          <td>
                            <span className="role-tag-mini">{m.role || 'Employee'}</span>
                          </td>
                          <td>
                            <span style={{ color: '#475569', fontSize: '0.85rem' }}>{m.designation || '-'}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                              {user?.role?.toLowerCase() === 'admin' && (
                                <button 
                                  className="member-delete-icon-btn" 
                                  title="Remove Member"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveMember(m.id, displayName);
                                  }}
                                >
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DETAIL & ASSIGNED TASKS MODAL */}
      {selectedMember && !viewingEmployeeTasks && (
        <div className="activity-detail-modal" onClick={() => setSelectedMember(null)}>
          <div className="modal-content-card animate-slide-up" onClick={e => e.stopPropagation()} style={{ width: '700px', maxWidth: '95%' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>Member Profile & Tasks</h3>
              <button className="modal-close" onClick={() => setSelectedMember(null)}>✕</button>
            </div>
            
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem' }}>
              <div className="member-avatar-lg" style={{ width: '60px', height: '60px', fontSize: '1.3rem' }}>
                {(selectedMember.fullName || selectedMember.firstName || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.15rem', fontWeight: '800' }}>{selectedMember.fullName || `${selectedMember.firstName || ''} ${selectedMember.lastName || ''}`.trim()}</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{selectedMember.designation || selectedMember.role} • ID: #{selectedMember.id.substring(0, 8)} • {selectedMember.type || 'Employee'}</p>
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
                <div className="table-responsive">
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
