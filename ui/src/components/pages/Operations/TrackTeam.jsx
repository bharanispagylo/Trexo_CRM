import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import './TrackTeam.css';
import Tasks from './Tasks';
import { useAlert } from '../../../context/AlertContext';
import { usePermissions } from '../../../hooks/usePermissions';
import '../Administration/AddUser.css';

const isAssigneeMatch = (assigneeStr, userId) => {
  if (!assigneeStr || !userId) return false;
  return assigneeStr.includes(userId);
};

const normalizeName = (name) => {
  if (!name) return '';
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
};

export default function TrackTeam({ user, onMemberClick }) {
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [taskLists, setTaskLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);
  const [viewingEmployeeTasks, setViewingEmployeeTasks] = useState(null);
  
  // Alert hooks
  const { alert, confirm } = useAlert();
  const { can } = usePermissions();

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
      const [taskData, teamData, userData, projectsData, taskListsData] = await Promise.all([
        api.get('/tasks'),
        api.get('/teams'),
        api.get('/users'),
        api.get('/projects').catch(() => []),
        api.get('/task-lists').catch(() => [])
      ]);
      setTasks((taskData || []).filter(t => t.status !== 'Archived' && t.status !== 'Archive'));
      setTeamMembers(teamData || []);
      setUsers(userData || []);
      setProjects(projectsData || []);
      setTaskLists(taskListsData || []);
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
    if (!memberForm.role || !memberForm.role.trim()) {
      alert('Role is required.', 'warning', 'Validation Error');
      return;
    }
    if (!memberForm.designation || !memberForm.designation.trim()) {
      alert('Designation is required.', 'warning', 'Validation Error');
      return;
    }

    try {
      if (memberForm.id) {
        await api.put(`/teams/${memberForm.id}`, {
          name: memberForm.name.trim(),
          role: memberForm.role,
          designation: memberForm.designation.trim() || null
        });
        alert('Team member updated successfully!', 'success', 'Member Updated');
      } else {
        await api.post('/teams', {
          name: memberForm.name.trim(),
          role: memberForm.role,
          designation: memberForm.designation.trim() || null
        });
        alert('Team member added successfully!', 'success', 'Member Added');
      }
      setAddingMember(false);
      setMemberForm({
        name: '',
        designation: '',
        role: 'Employee'
      });
      fetchData();
    } catch (err) {
      console.error('Error saving member:', err);
      alert('Failed to save member: ' + err.message, 'error', 'Error');
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

  // Filter tasks assigned to currently selected member by matching name
  const selectedUser = selectedMember
    ? users.find(u => {
        const uName = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`;
        return normalizeName(uName) === normalizeName(selectedMember.name);
      })
    : null;

  const selectedMemberTasks = selectedUser
    ? tasks.filter(t => isAssigneeMatch(t.assignees, selectedUser.id))
    : [];

  // Group tasks by project → task group (task list)
  const getGroupedTasks = (memberTasks) => {
    const grouped = {};
    memberTasks.forEach(task => {
      let projName = task.projectName || '';
      let projId = task.projectId || null;
      let listName = '';

      if (task.taskListId) {
        const list = taskLists.find(l => l.id === task.taskListId);
        if (list) {
          listName = list.name || '';
          if (!projId) projId = list.projectId;
        }
      }
      if (!projName && projId) {
        const proj = projects.find(p => p.id === projId);
        projName = proj?.name || '';
      }

      const projKey = projName || 'No Project';
      const listKey = listName || 'General';
      if (!grouped[projKey]) grouped[projKey] = {};
      if (!grouped[projKey][listKey]) grouped[projKey][listKey] = [];
      grouped[projKey][listKey].push(task);
    });
    return grouped;
  };

  if (addingMember) {
    return (
      <div className="track-team-page">
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
            <h2 className="page-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>{memberForm.id ? 'Edit Team Member' : 'Add New Team Member'}</h2>
            <p className="page-subtitle" style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>{memberForm.id ? 'Edit team member details.' : 'Add a new member to the team.'}</p>
          </div>

          <div className="saas-form-container">
            <div className="form-grid">
              <div className="saas-field">
                <label className="saas-label">Name *</label>
                <select 
                  className="saas-select" 
                  value={memberForm.name} 
                  disabled={!!memberForm.id}
                  onChange={e => {
                    const selectedName = e.target.value;
                    const matchedUser = users.find(u => {
                      const displayName = (u.fullName || `${u.firstName || ''} ${u.lastName || ''}`).trim() || u.email || 'Unknown';
                      return displayName === selectedName;
                    });
                    
                    if (matchedUser) {
                      const userRoleLower = (matchedUser.role || 'Employee').toLowerCase();
                      const matchingRole = roles.find(r => r.toLowerCase() === userRoleLower) || 'Employee';
                      
                      setMemberForm({
                        name: selectedName,
                        role: matchingRole,
                        designation: matchedUser.designation || ''
                      });
                    } else {
                      setMemberForm({
                        ...memberForm,
                        name: selectedName
                      });
                    }
                  }} 
                >
                  {memberForm.id ? (
                    <option value={memberForm.name}>{memberForm.name}</option>
                  ) : (
                    <>
                      <option value="">Select Member...</option>
                      {users
                        .filter(u => {
                          if (u.role && u.role.toLowerCase() === 'admin') {
                            return false;
                          }
                          const uName = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`;
                          return !teamMembers.some(m => normalizeName(m.name) === normalizeName(uName));
                        })
                        .slice()
                        .sort((a, b) => {
                          const nameA = (a.fullName || `${a.firstName || ''} ${a.lastName || ''}`).trim();
                          const nameB = (b.fullName || `${b.firstName || ''} ${b.lastName || ''}`).trim();
                          return nameA.localeCompare(nameB);
                        })
                        .map(u => {
                          const displayName = (u.fullName || `${u.firstName || ''} ${u.lastName || ''}`).trim() || u.email || 'Unknown';
                          return <option key={u.id} value={displayName}>{displayName}</option>;
                        })}
                    </>
                  )}
                </select>
              </div>

              <div className="saas-field"></div>

              <div className="saas-field">
                <label className="saas-label">Role *</label>
                <select 
                  className="saas-select" 
                  value={memberForm.role} 
                  onChange={e => setMemberForm({...memberForm, role: e.target.value})}
                >
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="saas-field">
                <label className="saas-label">Designation *</label>
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

  if (selectedMember && !viewingEmployeeTasks) {
    const memberName = selectedMember.name || selectedMember.fullName || `${selectedMember.firstName || ''} ${selectedMember.lastName || ''}`.trim() || 'Unknown';
    const avatarInitials = (selectedMember.name || selectedMember.fullName || selectedMember.firstName || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    return (
      <div className="track-team-page">
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
          onClick={() => setSelectedMember(null)}
        >
          ← Back to Team Members
        </button>

        <div className="add-user-page">
          <div className="page-header" style={{ marginBottom: '1.5rem' }}>
            <h2 className="page-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>Member Profile & Tasks</h2>
            <p className="page-subtitle" style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>View details and tasks assigned to this team member.</p>
          </div>

          <div className="saas-form-container profile-card-container">
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.5rem' }}>
              <div className="member-avatar-lg" style={{ width: '60px', height: '60px', fontSize: '1.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', borderRadius: '50%', fontWeight: '700', color: '#475569' }}>
                {avatarInitials}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>{memberName}</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  {selectedMember.designation || selectedMember.role || 'Employee'} • ID: #{selectedMember.id.substring(0, 8)} • {selectedMember.type || 'Employee'}
                </p>
              </div>
            </div>

            {/* ASSIGNED TASKS — grouped by Project → Task Group */}
            <div>
              <h4 style={{ margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: '800', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#0f172a' }}>
                <span>Assigned Tasks</span>
                <span style={{ fontSize: '0.8rem', background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                  {selectedMemberTasks.length} Tasks
                </span>
              </h4>

              {selectedMemberTasks.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', border: '1px solid #e2e8f0', borderRadius: '12px', background: 'white' }}>
                  No tasks assigned to this team member.
                </div>
              ) : (
                Object.entries(getGroupedTasks(selectedMemberTasks)).map(([projName, listGroups]) => (
                  <div key={projName} className="tt-project-group">
                    {/* Project header */}
                    <div className="tt-project-header">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                      {projName}
                    </div>

                    {Object.entries(listGroups).map(([listName, groupTasks]) => (
                      <div key={listName} className="tt-list-group">
                        {/* Task group (task list) header */}
                        <div className="tt-list-header">
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                          {listName}
                          <span className="tt-list-badge">{groupTasks.length}</span>
                        </div>

                        <div className="tt-tasks-table-wrap">
                          <table className="team-list-table tt-tasks-table">
                            <thead>
                              <tr>
                                <th>Task</th>
                                <th>Status</th>
                                <th>Priority</th>
                                <th>Due Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupTasks.map(task => (
                                <tr key={task.id}>
                                  <td data-label="Task">
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                      <span style={{ fontWeight: '600', color: '#0f172a', wordBreak: 'break-word' }}>{task.title}</span>
                                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '1px' }}>#{task.id.slice(-6).toUpperCase()}</span>
                                    </div>
                                  </td>
                                  <td data-label="Status">
                                    <span className="tt-status-pill" data-status={task.status}>
                                      {task.status || 'To Do'}
                                    </span>
                                  </td>
                                  <td data-label="Priority">
                                    <span className="tt-priority-text" data-priority={task.priority}>
                                      {task.priority || 'Medium'}
                                    </span>
                                  </td>
                                  <td data-label="Due Date">
                                    <span style={{ color: '#64748b', fontSize: '0.82rem' }}>
                                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
              <button 
                className="saas-btn-primary" 
                style={{ background: '#2563eb', padding: '0.6rem 1.5rem', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                onClick={() => setSelectedMember(null)}
              >
                Done
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
          <span></span>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {can('teams', 'create') && (
                <button
                  className="saas-btn-submit team-btn-add"
                  style={{ background: '#2563eb', color: 'white', border: 'none', padding: '0.5rem 1rem', fontSize: '0.85rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => setAddingMember(true)}
                >
                  <svg className="team-btn-plus-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"></path></svg>
                  <span className="team-btn-text">Add Member</span>
                  <span className="team-btn-icon" style={{ display: 'none', fontSize: '1.5rem', lineHeight: 1 }}>+</span>
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
                      const matchedUser = users.find(u => {
                        const uName = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`;
                        return normalizeName(uName) === normalizeName(m.name);
                      });
                      return (
                        <tr key={m.id} onClick={() => {
                          if (onMemberClick && matchedUser) {
                            onMemberClick(matchedUser);
                          } else {
                            setSelectedMember(m);
                          }
                        }} style={{ cursor: 'pointer' }}>
                          <td data-label="Member">
                            <div className="td-member-info">
                              <div className="member-avatar-sm">
                                {displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                              </div>
                              <span className="member-name-text">{displayName}</span>
                            </div>
                          </td>
                          <td data-label="Role">
                            <span className="role-tag-mini">{m.role || 'Employee'}</span>
                          </td>
                          <td data-label="Designation">
                            <span style={{ color: '#475569', fontSize: '0.85rem' }}>{m.designation || '-'}</span>
                          </td>
                          <td data-label="Actions" style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                              {can('teams', 'edit') && (
                                <button
                                  className="member-edit-icon-btn"
                                  title="Edit Member"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMemberForm({
                                      id: m.id,
                                      name: displayName,
                                      role: m.role || 'Employee',
                                      designation: m.designation || ''
                                    });
                                    setAddingMember(true);
                                  }}
                                >
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                              )}
                              {can('teams', 'delete') && (
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


    </div>
  );
}
