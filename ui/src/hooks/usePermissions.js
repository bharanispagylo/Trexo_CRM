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
            attendance: { create: 'All', view: 'All', edit: 'All', delete: 'All', assign: 'All' },
            leave: { create: 'All', view: 'All', edit: 'All', delete: 'All', assign: 'All' },
            tasks: { create: 'All', view: 'All', edit: 'All', delete: 'All', assign: 'All' },
            teams: { create: 'All', view: 'All', edit: 'All', delete: 'All', assign: 'All' },
            employees: { create: 'All', view: 'All', edit: 'All', delete: 'All', assign: 'All' },
            users: { create: 'All', view: 'All', edit: 'All', delete: 'All', assign: 'All' },
            projects: { create: 'All', view: 'All', edit: 'All', delete: 'All', assign: 'All' },
            salaries: { create: 'All', view: 'All', edit: 'All', delete: 'All', assign: 'All' },
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

  const getLevel = (module, action) => {
    if (userRole?.toLowerCase() === 'admin') return 'All';
    return permissions?.[module]?.[action] || 'None';
  };

  return (
    <PermissionContext.Provider value={{ permissions, loading, can, getLevel }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}
