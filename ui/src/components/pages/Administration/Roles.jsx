import React, { useState, useEffect } from 'react';
import './Roles.css';
import { api } from '../../../api/client';

const ACTIONS = [
  { id: 'create', label: 'Create' },
  { id: 'view',   label: 'View' },
  { id: 'edit',   label: 'Edit' },
  { id: 'delete', label: 'Delete' },
  { id: 'assign', label: 'Assign' },
];

const MODULES = [
  { id: 'attendance', label: 'Attendance' },
  { id: 'leave', label: 'Leave' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'teams', label: 'Teams' },
  { id: 'employees', label: 'Employees' },
  { id: 'users', label: 'Users' },
  { id: 'projects', label: 'Projects' },
  { id: 'salaries', label: 'Salaries' },
];

export default function Roles() {
  const [roles, setRoles] = useState(['Admin']);
  const [selectedRole, setSelectedRole] = useState('Admin');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [expandedModules, setExpandedModules] = useState(['attendance', 'leave', 'tasks']); // Default some expanded
  
  // Initial default permissions
  const createDefaultPerms = () => MODULES.reduce((acc, m) => ({
    ...acc,
    [m.id]: ACTIONS.reduce((aacc, a) => ({ ...aacc, [a.id]: 'None' }), {})
  }), {});

  const [permissions, setPermissions] = useState({
    Admin: MODULES.reduce((acc, m) => ({
      ...acc,
      [m.id]: ACTIONS.reduce((aacc, a) => ({ ...aacc, [a.id]: 'All' }), {})
    }), {}),
  });

  const fetchPermissions = async () => {
    try {
      const data = await api.get('/roles/permissions');
      if (data) {
        const remotePerms = {};
        const remoteRoles = ['Admin'];
        
        data.forEach(item => {
          remotePerms[item.role] = item.data;
          if (!remoteRoles.includes(item.role)) {
            remoteRoles.push(item.role);
          }
        });

        remoteRoles.sort((a, b) => a.localeCompare(b));
        setPermissions(prev => ({ ...prev, ...remotePerms }));
        setRoles(remoteRoles);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const handleSave = async () => {
    if (!isEditing) return;
    setLoading(true);
    try {
      await api.post('/roles/permissions', {
        role: selectedRole,
        data: permissions[selectedRole]
      });
      alert(`Success: Permissions for "${selectedRole}" saved to database.`);
      setIsEditing(false);
      await fetchPermissions();
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
    setLoading(false);
  };

  const togglePerm = (modId, actId, level) => {
    if (!isEditing) {
      alert("Please click 'Edit Permissions' first to make changes.");
      return;
    }
    
    setPermissions(prev => {
      const rolePerms = prev[selectedRole] || createDefaultPerms();
      const modPerms = rolePerms[modId] || {};
      const current = modPerms[actId] || 'None';
      const newValue = current === level ? 'None' : level;

      return {
        ...prev,
        [selectedRole]: {
          ...rolePerms,
          [modId]: {
            ...modPerms,
            [actId]: newValue
          }
        }
      };
    });
  };

  const handleGrantAll = () => {
    setPermissions(prev => ({
      ...prev,
      [selectedRole]: MODULES.reduce((acc, m) => ({
        ...acc,
        [m.id]: ACTIONS.reduce((aacc, a) => ({ ...aacc, [a.id]: 'All' }), {})
      }), {})
    }));
  };

  const handleRevokeAll = () => {
    setPermissions(prev => ({
      ...prev,
      [selectedRole]: MODULES.reduce((acc, m) => ({
        ...acc,
        [m.id]: ACTIONS.reduce((aacc, a) => ({ ...aacc, [a.id]: 'None' }), {})
      }), {})
    }));
  };

  const toggleModule = (modId) => {
    setExpandedModules(prev => 
      prev.includes(modId) ? prev.filter(id => id !== modId) : [...prev, modId]
    );
  };

  const handleDeleteRole = async (roleToDelete) => {
    if (roleToDelete === 'Admin') return;
    
    if (window.confirm(`Permanently delete the "${roleToDelete}" role? This cannot be undone.`)) {
      try {
        await api.delete(`/roles/permissions/${roleToDelete}`);
        setRoles(prev => prev.filter(r => r !== roleToDelete));
        if (selectedRole === roleToDelete) setSelectedRole('Admin');
      } catch (err) {
        setRoles(prev => prev.filter(r => r !== roleToDelete));
        if (selectedRole === roleToDelete) setSelectedRole('Admin');
      }
    }
  };

  const handleCreateRole = async () => {
    const name = newRoleName.trim();
    if (!name) return;
    
    if (roles.includes(name)) {
      alert("Error: This role already exists!");
      return;
    }

    setLoading(true);
    try {
      const defaultData = createDefaultPerms();
      await api.post('/roles/permissions', {
        role: name,
        data: defaultData
      });
      
      setRoles(prev => {
        const updated = [...prev, name];
        return updated.sort((a, b) => a.localeCompare(b));
      });
      setPermissions(prev => ({
        ...prev,
        [name]: defaultData
      }));
      setSelectedRole(name);
      setNewRoleName('');
      setShowCreateModal(false);
      setIsEditing(true);
    } catch (err) {
      alert('Creation failed: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="roles-page">
      <div className="roles-header">
        <div className="header-info">
          <h2>Role Permission Assignment</h2>
          <p>Click checkboxes to toggle 'All' or 'Self' access for each action.</p>
          {isEditing && (
            <div className="quick-actions" style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem' }}>
              <button className="quick-btn grant" onClick={handleGrantAll}>Grant All Permissions</button>
              <button className="quick-btn revoke" onClick={handleRevokeAll}>Revoke All Access</button>
            </div>
          )}
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '1rem' }}>
          {!isEditing ? (
            <button className="edit-roles-btn" onClick={() => setIsEditing(true)}>
              Edit Permissions
            </button>
          ) : (
            <>
              <button className="cancel-roles-btn" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
              <button className="save-roles-btn" onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : 'Save Assignment'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="roles-container">
        <div className="roles-sidebar">
          <h3>Roles</h3>
          <div className="role-list">
            {roles.map(r => (
              <div key={r} className={`role-item-wrapper ${selectedRole === r ? 'active' : ''}`}>
                <button className="role-item" onClick={() => { setSelectedRole(r); setIsEditing(false); }}>
                  <div className="role-dot"></div>
                  {r}
                </button>
                {r !== 'Admin' && (
                  <button className="role-delete-btn" onClick={(e) => { e.stopPropagation(); handleDeleteRole(r); }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                )}
              </div>
            ))}
            <button className="add-role-btn" onClick={() => setShowCreateModal(true)}>+ Create New Role</button>
          </div>
        </div>

        {showCreateModal && (
          <div className="role-modal-overlay">
            <div className="role-modal-content animate-slide-up">
              <h3>Create New Role</h3>
              <p>Enter a unique name for the new security role.</p>
              <input 
                type="text" 
                placeholder="e.g. Sales Manager" 
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateRole()}
              />
              <div className="modal-actions">
                <button className="modal-cancel" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button className="modal-create" onClick={handleCreateRole} disabled={!newRoleName.trim()}>Create Role</button>
              </div>
            </div>
          </div>
        )}

        <div className={`permissions-grid-container ${!isEditing ? 'readonly' : ''}`}>
          <table className="sketch-table">
            <thead>
              <tr>
                <th>Permission</th>
                <th>All</th>
                <th>Self</th>
              </tr>
            </thead>
            <tbody>
              {MODULES.map(mod => {
                const isExpanded = expandedModules.includes(mod.id);
                return (
                  <React.Fragment key={mod.id}>
                    <tr className="module-header-row" onClick={() => toggleModule(mod.id)} style={{ cursor: 'pointer' }}>
                      <td colSpan="3">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', fontSize: '0.7rem' }}>▶</span>
                          {mod.label}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && ACTIONS.map(act => (
                      <tr key={act.id} className="action-row">
                        <td className="action-label">{act.label}</td>
                        <td className="check-cell">
                          <div 
                            className={`sketch-checkbox ${permissions[selectedRole]?.[mod.id]?.[act.id] === 'All' ? 'checked' : ''}`}
                            onClick={() => togglePerm(mod.id, act.id, 'All')}
                          >
                            {permissions[selectedRole]?.[mod.id]?.[act.id] === 'All' && '✓'}
                          </div>
                        </td>
                        <td className="check-cell">
                          <div 
                            className={`sketch-checkbox ${permissions[selectedRole]?.[mod.id]?.[act.id] === 'Self' ? 'checked' : ''}`}
                            onClick={() => togglePerm(mod.id, act.id, 'Self')}
                          >
                            {permissions[selectedRole]?.[mod.id]?.[act.id] === 'Self' && '✓'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
