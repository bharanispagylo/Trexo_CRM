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

  if (loading || isSaving) return <div className="loading-screen">{isSaving ? 'Saving...' : 'Loading Users...'}</div>;

  return (
    <div className="users-page page-container">
      <div className="users-header-row">
        <div className="header-left">
          <h2>User Management</h2>
          <p>Manage access and details for all your team members.</p>
        </div>
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
           <button className="add-user-btn" onClick={onAddUser}>
             + Add New User
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
              <tr key={u.id}>
                <td className="user-avatar-cell">
                  {u.profileImage ? (
                    <img src={u.profileImage} alt={u.fullName} className="user-thumbnail" />
                  ) : (
                    <div className="user-initials">{u.firstName?.charAt(0) || u.fullName?.charAt(0) || 'U'}</div>
                  )}
                </td>
                <td className="user-info-cell">
                  <div className="user-name">{u.fullName || `${u.firstName} ${u.lastName}`}</div>
                </td>
                <td>
                  <div className="user-meta">{u.phoneNo || '-'}</div>
                </td>
                <td>
                  <div className="user-meta">{u.empId}</div>
                </td>
                <td>
                  <span className={`role-badge ${(u.role || 'Employee').toLowerCase()}`}>
                    {u.role || 'Employee'}
                  </span>
                </td>
                <td>
                  <span className="status-badge active">{u.status || 'Active'}</span>
                </td>
                <td className="actions-cell">
                  {can('users', 'edit') && (
                    <button className="user-action-btn edit" title="Edit User" onClick={() => onEditUser(u)}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                  )}
                  {can('users', 'delete') && (
                    <button 
                      className="user-action-btn delete" 
                      title="Delete User"
                      onClick={() => {
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
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      </div>
    </div>
  );
}


