import { useState, useEffect, createContext, useContext } from 'react';
import { api } from '../api/client';

const PermissionContext = createContext();

export function PermissionProvider({ children, userRole }) {
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!userRole) {
        setPermissions(null);
        setLoading(false);
        return;
      }

      try {
        const allPerms = await api.get('/roles/permissions');
        // Find the permissions for the specific role
        const rolePermData = allPerms.find(p => p.role.toLowerCase() === userRole.toLowerCase());
        
        if (rolePermData) {
          setPermissions(rolePermData.data);
        } else if (userRole.toLowerCase() === 'admin') {
          // Default full access for Admin if not found in DB
          setPermissions({
            dashboard: { create: 'All', view: 'All', edit: 'All', delete: 'All', assign: 'All' },
            tasks: { create: 'All', view: 'All', edit: 'All', delete: 'All', assign: 'All' },
            taskGroups: { create: 'All', view: 'All', edit: 'All', delete: 'All' },
            projects: { create: 'All', view: 'All', edit: 'All', delete: 'All', assign: 'All' },
            teams: { create: 'All', view: 'All', edit: 'All', delete: 'All', assign: 'All' },
            estimations: { create: 'All', view: 'All', edit: 'All', delete: 'All', assign: 'All' },
            reports: { create: 'All', view: 'All', edit: 'All', delete: 'All', assign: 'All' },
            clients: { create: 'All', view: 'All', edit: 'All', delete: 'All', assign: 'All' },
            users: { create: 'All', view: 'All', edit: 'All', delete: 'All', assign: 'All' },
            roles: { create: 'All', view: 'All', edit: 'All', delete: 'All', assign: 'All' },
            archive: { view: 'All', restore: 'All', delete: 'All' },
          });
        } else {
          // Default empty permissions for others
          setPermissions({});
        }
      } catch (err) {
        console.error('Failed to fetch permissions:', err);
        setPermissions({});
      }
      setLoading(false);
    };

    fetchPermissions();
  }, [userRole]);

  const can = (module, action) => {
    if (!permissions) return false;
    if (userRole?.toLowerCase() === 'admin') return true; // Admin has override

    const modPerms = permissions[module];
    if (!modPerms) return false;

    const level = modPerms[action];
    return level === 'All' || level === 'Self';
  };

  // Checks report sub-page permissions — respects actual DB values, no Admin bypass.
  // Falls back to full access for Admin only when no permissions have been saved yet.
  const canReport = (pageId) => {
    if (!permissions) return false;
    if (userRole?.toLowerCase() === 'admin') return true;

    const reportPerms = permissions?.reports;
    if (!reportPerms) return false;

    if (reportPerms[pageId] !== undefined) {
      const level = reportPerms[pageId];
      return level === 'All' || level === 'Self';
    }

    // Fallback to general reports view permission
    const generalView = reportPerms.view;
    return generalView === 'All' || generalView === 'Self';
  };

  const getLevel = (module, action) => {
    if (userRole?.toLowerCase() === 'admin') return 'All';
    return permissions?.[module]?.[action] || 'None';
  };

  return (
    <PermissionContext.Provider value={{ permissions, loading, can, canReport, getLevel }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}
