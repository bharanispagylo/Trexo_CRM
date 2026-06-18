import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import './Users.css';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAlert } from '../../../context/AlertContext';

export default function Users({ onAddUser, onEditUser }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(['Admin', 'Employee']);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('All');
  const { can } = usePermissions();
  const { alert, confirm } = useAlert();

  // Reassign modal state
  const [reassignModal, setReassignModal] = useState({ open: false, user: null, tasks: [], loading: false });
  const [reassignTarget, setReassignTarget] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [deleteAfterReassign, setDeleteAfterReassign] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const userData = await api.get('/users');
      const sortedUsers = (userData || []).sort((a, b) => {
        const nameA = a.fullName || `${a.firstName || ''} ${a.lastName || ''}`.trim();
        const nameB = b.fullName || `${b.firstName || ''} ${b.lastName || ''}`.trim();
        return nameA.localeCompare(nameB);
      });
      setUsers(sortedUsers);
      
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
      console.error('Fetch error:', error);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const filteredUsers = selectedRoleFilter === 'All' 
    ? users 
    : users.filter(u => (u.role || 'Employee').toLowerCase() === selectedRoleFilter.toLowerCase());

  const getUserName = (u) => u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Unknown';

  const activeUsers = users.filter(u => u.status === 'Active');

  // Open reassign modal for a user
  const openReassignModal = async (targetUser, isDelete = false) => {
    setReassignModal({ open: true, user: targetUser, tasks: [], loading: true });
    setReassignTarget('');
    setDeleteAfterReassign(isDelete);
    try {
      const tasks = await api.get(`/users/${targetUser.id}/tasks`);
      setReassignModal(prev => ({ ...prev, tasks: tasks || [], loading: false }));
    } catch (err) {
      console.error('Fetch user tasks error:', err);
      setReassignModal(prev => ({ ...prev, tasks: [], loading: false }));
    }
  };

  const closeReassignModal = () => {
    setReassignModal({ open: false, user: null, tasks: [], loading: false });
    setReassignTarget('');
    setDeleteAfterReassign(false);
  };

  // Handle reassign + optional delete
  const handleReassign = async () => {
    if (!reassignTarget) {
      alert('Please select a user to reassign tasks to.', 'warning', 'Required');
      return;
    }
    setReassigning(true);
    try {
      await api.post(`/users/${reassignModal.user.id}/reassign-tasks`, { newUserId: reassignTarget });
      const targetUserName = getUserName(activeUsers.find(u => u.id === reassignTarget) || {});
      alert(`${reassignModal.tasks.length} task(s) reassigned to ${targetUserName}.`, 'success', 'Reassigned');

      if (deleteAfterReassign) {
        try {
          await api.delete(`/users/${reassignModal.user.id}`);
          alert('User deleted successfully.', 'success', 'Deleted');
        } catch (err) {
          alert('Tasks reassigned but failed to delete user: ' + err.message, 'error', 'Error');
        }
      }
      closeReassignModal();
      fetchUsers();
    } catch (err) {
      alert('Failed to reassign tasks: ' + err.message, 'error', 'Error');
    } finally {
      setReassigning(false);
    }
  };

  // Handle delete: check if user has tasks first
  const handleDeleteUser = async (u) => {
    try {
      const tasks = await api.get(`/users/${u.id}/tasks`);
      if (tasks && tasks.length > 0) {
        // Has tasks → open reassign modal with delete mode
        openReassignModal(u, true);
      } else {
        // No tasks → direct delete
        confirm('Are you sure you want to delete this user? This action cannot be undone.', async () => {
          setIsSaving(true);
          try {
            await api.delete(`/users/${u.id}`);
            alert('User deleted successfully.', 'success', 'Deleted');
            fetchUsers();
          } catch (error) {
            alert('Delete failed: ' + error.message, 'error', 'Delete Failed');
          } finally {
            setIsSaving(false);
          }
        }, 'Delete User');
      }
    } catch (err) {
      alert('Failed to check user tasks: ' + err.message, 'error', 'Error');
    }
  };

  if (loading || isSaving) return <div className="loading-screen">{isSaving ? 'Saving...' : 'Loading Users...'}</div>;

  return (
    <div className="users-page page-container">
      <div className="users-header-row">
        <div className="header-left"></div>
        <div className="header-right">
          <select 
            className="role-filter-select" 
            value={selectedRoleFilter} 
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
          >
            <option value="All">All Roles</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
         {can('users', 'create') && (
           <button className="add-user-btn add-user-btn-add" onClick={onAddUser}>
             <span className="add-user-btn-text">+ Add New User</span>
             <span className="add-user-btn-icon" style={{ display: 'none' }}>+</span>
           </button>
         )}
       </div>
      </div>

      <div className="users-list-container">
        <div className="table-responsive">
<table className="users-list-table">
          <thead>
            <tr>
              <th>Profile</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Emp ID</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr><td colSpan="7" className="status-cell">No users found.</td></tr>
            ) : filteredUsers.map(u => (
              <tr key={u.id} style={u.status === 'Inactive' ? { opacity: 0.6 } : {}}>
                <td data-label="Profile" className="user-avatar-cell">
                  {u.profileImage ? (
                    <img src={u.profileImage} alt={u.fullName} className="user-thumbnail" />
                  ) : (
                    <div className="user-initials">{u.firstName?.charAt(0) || u.fullName?.charAt(0) || 'U'}</div>
                  )}
                </td>
                <td data-label="Name" className="user-info-cell">
                  <div className="user-name">{u.fullName || `${u.firstName} ${u.lastName}`}</div>
                </td>
                <td data-label="Phone">
                  <div className="user-meta">{u.phoneNo || '-'}</div>
                </td>
                <td data-label="Emp ID">
                  <div className="user-meta">{u.empId}</div>
                </td>
                <td data-label="Role">
                  <span className={`role-badge ${(u.role || 'Employee').toLowerCase()}`}>
                    {u.role || 'Employee'}
                  </span>
                </td>
                <td data-label="Status">
                  <span className={`status-badge ${(u.status || 'Active').toLowerCase()}`}>{u.status || 'Active'}</span>
                </td>
                <td data-label="Actions" className="actions-cell">
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {/* Reassign icon for inactive users */}
                    {u.status === 'Inactive' && can('users', 'edit') && (
                      <button
                        className="user-action-btn reassign"
                        title="Reassign Tasks"
                        onClick={() => openReassignModal(u, false)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          border: '1px solid #dbeafe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#f59e0b',
                          background: '#fffbeb',
                          cursor: 'pointer'
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 3h5v5"></path>
                          <line x1="4" y1="20" x2="21" y2="3"></line>
                          <path d="M21 16v5h-5"></path>
                          <line x1="15" y1="15" x2="21" y2="21"></line>
                          <line x1="4" y1="4" x2="9" y2="9"></line>
                        </svg>
                      </button>
                    )}
                    {can('users', 'edit') && (
                      <button className="user-action-btn edit" title="Edit User" onClick={() => onEditUser(u)}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                    )}
                    {can('users', 'delete') && (
                      <button
                        className="user-action-btn delete"
                        title="Delete User"
                        onClick={() => handleDeleteUser(u)}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      </div>

      {/* ── Reassign Tasks Modal ── */}
      {reassignModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, backdropFilter: 'blur(2px)'
        }}
        onClick={(e) => { if (e.target === e.currentTarget) closeReassignModal(); }}
        >
          <div style={{
            background: 'white', borderRadius: '16px', width: '95%', maxWidth: '600px', maxHeight: '85vh',
            display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            overflow: 'hidden', animation: 'fadeInUp 0.2s ease'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.5rem 1.5rem 1rem', borderBottom: '1px solid #f1f5f9',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>
                  {deleteAfterReassign ? '⚠️ Reassign Tasks Before Deleting' : '🔄 Reassign Tasks'}
                </h3>
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                  {deleteAfterReassign
                    ? `"${getUserName(reassignModal.user)}" has tasks assigned. Please reassign them before deletion.`
                    : `Reassign all tasks from "${getUserName(reassignModal.user)}" to another user.`
                  }
                </p>
              </div>
              <button onClick={closeReassignModal} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8', padding: '0.25rem' }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
              {reassignModal.loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  <div style={{ width: '24px', height: '24px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.6s linear infinite', margin: '0 auto 0.75rem' }}></div>
                  Loading tasks...
                </div>
              ) : reassignModal.tasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.9rem' }}>
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#94a3b8" strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 0.75rem' }}><circle cx="12" cy="12" r="10"></circle><path d="M8 15h8M9 9h.01M15 9h.01"></path></svg>
                  No tasks assigned to this user.
                  {deleteAfterReassign && (
                    <div style={{ marginTop: '1rem' }}>
                      <button onClick={async () => {
                        setReassigning(true);
                        try {
                          await api.delete(`/users/${reassignModal.user.id}`);
                          alert('User deleted successfully.', 'success', 'Deleted');
                          closeReassignModal();
                          fetchUsers();
                        } catch (err) {
                          alert('Delete failed: ' + err.message, 'error', 'Error');
                        } finally {
                          setReassigning(false);
                        }
                      }} disabled={reassigning} style={{
                        padding: '0.5rem 1.25rem', background: '#ef4444', color: 'white', border: 'none',
                        borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem'
                      }}>
                        {reassigning ? 'Deleting...' : 'Delete User'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Task Count */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem',
                    padding: '0.6rem 1rem', background: deleteAfterReassign ? '#fef2f2' : '#eff6ff',
                    borderRadius: '8px', border: `1px solid ${deleteAfterReassign ? '#fee2e2' : '#dbeafe'}`
                  }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={deleteAfterReassign ? '#ef4444' : '#2563eb'} strokeWidth="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                    <span style={{ fontSize: '0.82rem', fontWeight: '600', color: deleteAfterReassign ? '#dc2626' : '#1d4ed8' }}>
                      {reassignModal.tasks.length} task{reassignModal.tasks.length !== 1 ? 's' : ''} assigned
                    </span>
                  </div>

                  {/* Tasks List */}
                  <div style={{
                    border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', marginBottom: '1.25rem',
                    maxHeight: '240px', overflowY: 'auto'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', fontSize: '0.68rem' }}>Task</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', fontSize: '0.68rem' }}>Status</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', fontSize: '0.68rem' }}>Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reassignModal.tasks.map(t => (
                          <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.6rem 1rem', fontWeight: '500', color: '#0f172a', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || 'Untitled'}</td>
                            <td style={{ padding: '0.6rem 1rem' }}>
                              <span style={{
                                display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '600',
                                background: t.status === 'Completed' ? '#dcfce7' : t.status === 'In Progress' ? '#dbeafe' : '#f1f5f9',
                                color: t.status === 'Completed' ? '#16a34a' : t.status === 'In Progress' ? '#2563eb' : '#475569'
                              }}>{t.status || 'Open'}</span>
                            </td>
                            <td style={{ padding: '0.6rem 1rem' }}>
                              <span style={{
                                display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '600',
                                background: t.priority === 'High' ? '#fef2f2' : t.priority === 'Medium' ? '#fffbeb' : '#f0fdf4',
                                color: t.priority === 'High' ? '#ef4444' : t.priority === 'Medium' ? '#f59e0b' : '#22c55e'
                              }}>{t.priority || 'Medium'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Reassign To Dropdown */}
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                      Reassign To *
                    </label>
                    <select
                      value={reassignTarget}
                      onChange={e => setReassignTarget(e.target.value)}
                      style={{
                        width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px',
                        fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box', background: 'white'
                      }}
                    >
                      <option value="">-- Select User --</option>
                      {activeUsers
                        .filter(u => u.id !== reassignModal.user?.id)
                        .map(u => (
                          <option key={u.id} value={u.id}>{getUserName(u)} ({u.role || 'Employee'})</option>
                        ))
                      }
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {reassignModal.tasks.length > 0 && !reassignModal.loading && (
              <div style={{
                padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9',
                display: 'flex', justifyContent: 'flex-end', gap: '0.75rem'
              }}>
                <button onClick={closeReassignModal} style={{
                  padding: '0.55rem 1.25rem', background: 'white', border: '1px solid #e2e8f0',
                  borderRadius: '8px', fontWeight: '600', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem'
                }}>Cancel</button>
                <button
                  onClick={handleReassign}
                  disabled={reassigning || !reassignTarget}
                  style={{
                    padding: '0.55rem 1.25rem',
                    background: deleteAfterReassign ? '#ef4444' : '#2563eb',
                    border: 'none', borderRadius: '8px', fontWeight: '600', color: 'white',
                    cursor: reassigning || !reassignTarget ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    opacity: reassigning || !reassignTarget ? 0.6 : 1,
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem'
                  }}
                >
                  {reassigning && (
                    <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
                  )}
                  {reassigning
                    ? (deleteAfterReassign ? 'Reassigning & Deleting...' : 'Reassigning...')
                    : (deleteAfterReassign ? `Reassign & Delete User` : `Reassign ${reassignModal.tasks.length} Task(s)`)
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
