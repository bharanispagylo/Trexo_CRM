import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import './DashboardLayout.css';
import { usePermissions } from '../hooks/usePermissions';
import Projects from './pages/Operations/Projects';
import TrackTeam from './pages/Operations/TrackTeam';
import Tasks from './pages/Operations/Tasks';
import Estimations from './pages/Operations/Estimations';
import Clients from './pages/Operations/Clients';
import Users from './pages/Administration/Users';
import Roles from './pages/Administration/Roles';
import AddUser from './pages/Administration/AddUser';
import EditUser from './pages/Administration/EditUser';
import Reports from './pages/Administration/Reports';
import ReportsStatusBased from './pages/Administration/ReportsStatusBased';
import TimesheetOverall from './pages/Administration/TimesheetOverall';
import TimesheetIndividual from './pages/Administration/TimesheetIndividual';


// Helper to parse deep-link paths like /projects/Name or /tasks/abc123
const parseRoutePath = (pathname) => {
  const path = pathname.startsWith('/') ? pathname.substring(1) : pathname;
  const segments = path.split('/');
  if (path === 'tasks-delivery') {
    return { tab: 'reports', projectName: null, taskId: null };
  }
  if (path === 'tasks-worklog') {
    return { tab: 'reports-status-based', projectName: null, taskId: null };
  }
  if (segments[0] === 'projects' && segments.length > 1) {
    const projectName = decodeURIComponent(segments.slice(1).join('/'));
    return { tab: 'projects', projectName, taskId: null };
  }
  if (segments[0] === 'tasks' && segments.length > 1) {
    const taskId = decodeURIComponent(segments[1]);
    return { tab: 'tasks', projectName: null, taskId };
  }
  return { tab: path || 'overview', projectName: null, taskId: null };
};

export default function DashboardLayout({ user, onLogout, renderOverview }) {
  const [activeTab, setActiveTab] = useState(() => {
    const parsed = parseRoutePath(window.location.pathname);
    return parsed.tab;
  });
  // Deep-link state for projects and tasks
  const [initialProjectName, setInitialProjectName] = useState(() => {
    const parsed = parseRoutePath(window.location.pathname);
    return parsed.projectName;
  });
  const [initialTaskId, setInitialTaskId] = useState(() => {
    const parsed = parseRoutePath(window.location.pathname);
    return parsed.taskId;
  });
  const [selectedProjectName, setSelectedProjectName] = useState(() => {
    const parsed = parseRoutePath(window.location.pathname);
    return parsed.projectName;
  });
  const [selectedTaskId, setSelectedTaskId] = useState(() => {
    const parsed = parseRoutePath(window.location.pathname);
    return parsed.taskId;
  });
  const [userToEdit, setUserToEdit] = useState(null);
  const { can, canReport, loading } = usePermissions();
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [mobileReportsOpen, setMobileReportsOpen] = useState(false);

  const modulesConfig = [
    {
      id: 'tasks',
      label: 'My Tasks',
      module: 'tasks',
      bottomNavIcon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="9 11 12 14 22 4"></polyline>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
      ),
      drawerIcon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
        </svg>
      ),
      drawerBg: '#7c3aed'
    },
    {
      id: 'projects',
      label: 'Projects',
      module: 'projects',
      bottomNavIcon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>
      ),
      drawerIcon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      ),
      drawerBg: '#7c3aed'
    },
    {
      id: 'track-team',
      label: 'My Team',
      module: 'teams',
      bottomNavIcon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="6"></circle>
          <circle cx="12" cy="12" r="2"></circle>
        </svg>
      ),
      drawerIcon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
          <line x1="9" y1="9" x2="9.01" y2="9"></line>
          <line x1="15" y1="9" x2="15.01" y2="9"></line>
        </svg>
      ),
      drawerBg: '#10b981'
    },
    {
      id: 'estimations',
      label: 'Estimations',
      module: 'estimations',
      bottomNavIcon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      ),
      drawerIcon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
      ),
      drawerBg: '#f59e0b'
    },
    {
      id: 'reports',
      label: 'Reports',
      module: 'reports',
      bottomNavIcon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      ),
      drawerIcon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
      ),
      drawerBg: '#3b82f6'
    },
    {
      id: 'clients',
      label: 'Clients',
      module: 'clients',
      bottomNavIcon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
        </svg>
      ),
      drawerIcon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
      ),
      drawerBg: '#10b981'
    },
    {
      id: 'users',
      label: 'Users',
      module: 'users',
      bottomNavIcon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M2 21v-2a4 4 0 0 1 3-3.87"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      ),
      drawerIcon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      ),
      drawerBg: '#ec4899'
    },
    {
      id: 'roles',
      label: 'Roles',
      module: 'roles',
      bottomNavIcon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      ),
      drawerIcon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="4"></circle>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
        </svg>
      ),
      drawerBg: '#3b82f6'
    }
  ];

  const permittedModules = modulesConfig.filter(m => {
    if (m.id === 'reports') return canReport('tasks-report') || canReport('reports-status-based') || canReport('timesheet-overall') || canReport('timesheet-individual');
    return can(m.module, 'view');
  });
  const showMoreButton = permittedModules.length > 3;
  const bottomNavItems = showMoreButton ? permittedModules.slice(0, 2) : permittedModules;
  const drawerItems = showMoreButton ? permittedModules : [];


  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseRoutePath(window.location.pathname);
      setActiveTab(parsed.tab);
      setSelectedProjectName(parsed.projectName);
      setSelectedTaskId(parsed.taskId);
      if (parsed.projectName) setInitialProjectName(parsed.projectName);
      if (parsed.taskId) setInitialTaskId(parsed.taskId);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    // Build the correct URL based on activeTab + deep-link state
    let newUrl;
    if (activeTab === 'overview') {
      newUrl = '/';
    } else if (activeTab === 'projects' && selectedProjectName) {
      newUrl = `/projects/${selectedProjectName.replace(/ /g, '-')}`;
    } else if (activeTab === 'tasks' && selectedTaskId) {
      newUrl = `/tasks/${selectedTaskId}`;
    } else if (activeTab === 'reports') {
      newUrl = '/tasks-delivery';
    } else if (activeTab === 'reports-status-based') {
      newUrl = '/tasks-worklog';
    } else {
      newUrl = `/${activeTab}`;
    }
    
    const currentUrl = window.location.pathname;
    if (newUrl !== currentUrl) {
      window.history.pushState(null, '', newUrl);
    }
    
    // Auto-redirect if they try to access a page they don't have permission for
    if (!loading) {
      if (activeTab === 'projects' && !can('projects', 'view') && user?.role?.toLowerCase() !== 'admin') {
        setActiveTab('overview');
      } else if (activeTab === 'users' && !can('users', 'view') && user?.role?.toLowerCase() !== 'admin') {
        setActiveTab('overview');
      } else if (activeTab === 'clients' && !can('clients', 'view') && user?.role?.toLowerCase() !== 'admin') {
        setActiveTab('overview');
      } else if (activeTab === 'track-team' && !can('teams', 'view') && user?.role?.toLowerCase() !== 'admin') {
        setActiveTab('overview');
      } else if (activeTab === 'estimations' && !can('estimations', 'view') && user?.role?.toLowerCase() !== 'admin') {
        setActiveTab('overview');
      } else if (activeTab === 'tasks' && !can('tasks', 'view') && user?.role?.toLowerCase() !== 'admin') {
        setActiveTab('overview');
      } else if (activeTab === 'reports'             && !canReport('tasks-report'))         { setActiveTab('overview');
      } else if (activeTab === 'reports-status-based' && !canReport('reports-status-based')) { setActiveTab('overview');
      } else if (activeTab === 'timesheet-overall'    && !canReport('timesheet-overall'))    { setActiveTab('overview');
      } else if (activeTab === 'timesheet-individual' && !canReport('timesheet-individual')) { setActiveTab('overview');
      } else if (activeTab === 'roles' && !can('roles', 'view') && user?.role?.toLowerCase() !== 'admin') {
        setActiveTab('overview');
      } else if (activeTab === 'add-user' && !can('users', 'create') && user?.role?.toLowerCase() !== 'admin') {
        setActiveTab('overview');
      } else if (activeTab === 'edit-user' && !can('users', 'edit') && user?.role?.toLowerCase() !== 'admin') {
        setActiveTab('overview');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedProjectName, selectedTaskId, loading, can, canReport, user]);

  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);
  const notificationDropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const id = user?.id;
      if (!id) return;
      const data = await api.get(`/notifications/${encodeURIComponent(id)}`);
      setNotifications(data || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);





  const handleMarkAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const id = user?.id;
      if (!id) return;
      await api.put(`/notifications/user/${encodeURIComponent(id)}/read-all`);
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  // Global Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [allTasks, setAllTasks] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchSelectedTask, setSearchSelectedTask] = useState(null);
  const [searchSelectedProject, setSearchSelectedProject] = useState(null);
  const [teamMemberAssigneeFilter, setTeamMemberAssigneeFilter] = useState(null);
  const [timesheetUserId, setTimesheetUserId] = useState(null);
  const searchContainerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSearchResults(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setIsProfileDropdownOpen(false);
      }
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(e.target)) {
        setIsNotificationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSearchFocus = async () => {
    try {
      setShowSearchResults(true);
      const [tasksData, projectsData, usersData] = await Promise.all([
        api.get('/tasks'),
        api.get('/projects'),
        api.get('/users')
      ]);
      setAllTasks(tasksData || []);
      setAllProjects(projectsData || []);
      setAllUsers(usersData || []);
    } catch (err) {
      console.error('Failed to pre-fetch search items:', err);
    }
  };

  const q = searchQuery.trim().toLowerCase();

  const filteredTasks = q
    ? allTasks.filter(t => {
        if ((t.title || '').toLowerCase().includes(q)) return true;
        if ((t.description || '').toLowerCase().includes(q)) return true;
        if ((t.taskNo || '').toLowerCase().includes(q)) return true;
        // Search by display ID (T/S + digits from taskNo, e.g. "T359369")
        const rawNo = t.taskNo || '';
        const digits = rawNo.replace(/\D/g, '');
        const displayId = (t.parentId ? 's' : 't') + digits;
        if (displayId.includes(q)) return true;
        // Also match if user types "TSK-830" → normalize to just digits "830" and check
        const qDigits = q.replace(/\D/g, '');
        if (qDigits && digits.includes(qDigits)) return true;
        if ((t.status || '').toLowerCase().includes(q)) return true;
        if ((t.priority || '').toLowerCase().includes(q)) return true;
        if ((t.projectName || '').toLowerCase().includes(q)) return true;
        // Search by assignee names
        if (t.assignees) {
          const ids = t.assignees.split(',').map(id => id.trim()).filter(Boolean);
          const matchesAssignee = ids.some(id => {
            const u = allUsers.find(user => user.id === id);
            if (!u) return false;
            const name = (u.fullName || `${u.firstName || ''} ${u.lastName || ''}`).toLowerCase();
            return name.includes(q);
          });
          if (matchesAssignee) return true;
        }
        return false;
      })
    : [];

  const filteredProjects = q
    ? allProjects.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.client || '').toLowerCase().includes(q) ||
      (p.status || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    )
    : [];

  const filteredUsers = q
    ? allUsers.filter(u =>
      (u.fullName || `${u.firstName || ''} ${u.lastName || ''}`).toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.empId || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    )
    : [];

  const handleItemClick = (type, item) => {
    setSearchQuery('');
    setShowSearchResults(false);
    if (type === 'task') {
      setSearchSelectedTask(item);
      setActiveTab('tasks');
    } else if (type === 'project') {
      setSearchSelectedProject(item);
      setActiveTab('projects');
    } else if (type === 'user') {
      setActiveTab('users');
    }
  };

  if (loading) return <div className="loading-screen">Loading Permissions...</div>;

  const renderContent = () => {
    switch (activeTab) {
      case 'projects': 
        if (!can('projects', 'view') && user?.role?.toLowerCase() !== 'admin') {
          return renderOverview(setActiveTab, (taskData) => {
            setSearchSelectedTask(taskData);
            setIsTaskDetailOpen(true);
            setActiveTab('tasks');
          });
        }
        return (
        <Projects
          user={user}
          initialSelectedProject={searchSelectedProject}
          onClearInitialProject={() => setSearchSelectedProject(null)}
          onNavigateToTasks={(taskData) => {
            setSearchSelectedTask(taskData);
            setIsTaskDetailOpen(true);
            setActiveTab('tasks');
          }}
          initialProjectName={initialProjectName}
          onProjectSelect={(projectName) => {
            setSelectedProjectName(projectName);
            if (!projectName) setInitialProjectName(null);
          }}
        />
      );
      case 'estimations': 
        if (!can('estimations', 'view') && user?.role?.toLowerCase() !== 'admin') {
          return renderOverview(setActiveTab, (taskData) => {
            setSearchSelectedTask(taskData);
            setIsTaskDetailOpen(true);
            setActiveTab('tasks');
          });
        }
        return <Estimations user={user} />;
      case 'clients': 
        if (!can('clients', 'view') && user?.role?.toLowerCase() !== 'admin') {
          return renderOverview(setActiveTab, (taskData) => {
            setSearchSelectedTask(taskData);
            setIsTaskDetailOpen(true);
            setActiveTab('tasks');
          });
        }
        return <Clients user={user} />;
      case 'track-team':
        if (!can('teams', 'view') && user?.role?.toLowerCase() !== 'admin') {
          return renderOverview(setActiveTab, (taskData) => {
            setSearchSelectedTask(taskData);
            setIsTaskDetailOpen(true);
            setActiveTab('tasks');
          });
        }
        return <TrackTeam user={user} onMemberClick={(member) => {
            setTeamMemberAssigneeFilter(member.id);
            setActiveTab('tasks');
          }} />;
      case 'tasks': 
        if (!can('tasks', 'view') && user?.role?.toLowerCase() !== 'admin') {
          return renderOverview(setActiveTab, (taskData) => {
            setSearchSelectedTask(taskData);
            setIsTaskDetailOpen(true);
            setActiveTab('tasks');
          });
        }
        return (
        <Tasks
          user={user}
          initialSelectedTask={searchSelectedTask}
          onClearInitialTask={() => setSearchSelectedTask(null)}
          onDetailViewChange={(open) => setIsTaskDetailOpen(open)}
          initialTaskId={initialTaskId}
          onTaskSelect={(taskId) => {
            setSelectedTaskId(taskId);
            if (!taskId) setInitialTaskId(null);
          }}
          initialAssigneeFilter={teamMemberAssigneeFilter}
          onClearAssigneeFilter={() => setTeamMemberAssigneeFilter(null)}
        />
      );
      case 'users': 
        if (!can('users', 'view') && user?.role?.toLowerCase() !== 'admin') {
          return renderOverview(setActiveTab, (taskData) => {
            setSearchSelectedTask(taskData);
            setIsTaskDetailOpen(true);
            setActiveTab('tasks');
          });
        }
        return <Users user={user} onAddUser={() => setActiveTab('add-user')} onEditUser={(u) => { setUserToEdit(u); setActiveTab('edit-user'); }} />;
      case 'roles': 
        if (!can('roles', 'view') && user?.role?.toLowerCase() !== 'admin') {
          return renderOverview(setActiveTab, (taskData) => {
            setSearchSelectedTask(taskData);
            setIsTaskDetailOpen(true);
            setActiveTab('tasks');
          });
        }
        return <Roles user={user} />;
      case 'add-user': 
        if (!can('users', 'create') && user?.role?.toLowerCase() !== 'admin') {
          return renderOverview(setActiveTab, (taskData) => {
            setSearchSelectedTask(taskData);
            setIsTaskDetailOpen(true);
            setActiveTab('tasks');
          });
        }
        return <AddUser user={user} onBack={() => setActiveTab('users')} />;
      case 'edit-user': 
        if (!can('users', 'edit') && user?.role?.toLowerCase() !== 'admin') {
          return renderOverview(setActiveTab, (taskData) => {
            setSearchSelectedTask(taskData);
            setIsTaskDetailOpen(true);
            setActiveTab('tasks');
          });
        }
        return <EditUser userToEdit={userToEdit} onBack={() => setActiveTab('users')} />;
      case 'timesheet-overall':
        if (!canReport('timesheet-overall')) return renderOverview(setActiveTab, (taskData) => { setSearchSelectedTask(taskData); setIsTaskDetailOpen(true); setActiveTab('tasks'); });
        return <TimesheetOverall onUserClick={(userId) => { setTimesheetUserId(userId); setActiveTab('timesheet-individual'); }} />;
      case 'timesheet-individual':
        if (!canReport('timesheet-individual')) return renderOverview(setActiveTab, (taskData) => { setSearchSelectedTask(taskData); setIsTaskDetailOpen(true); setActiveTab('tasks'); });
        return <TimesheetIndividual initialUserId={timesheetUserId} onClearInitialUser={() => setTimesheetUserId(null)} />;
      case 'reports-status-based':
        if (!canReport('reports-status-based')) return renderOverview(setActiveTab, (taskData) => { setSearchSelectedTask(taskData); setIsTaskDetailOpen(true); setActiveTab('tasks'); });
        return <ReportsStatusBased user={user} onNavigateToTask={(taskData) => { setSearchSelectedTask(taskData); setIsTaskDetailOpen(true); setActiveTab('tasks'); }} />;
      case 'reports':
        if (!canReport('tasks-report')) return renderOverview(setActiveTab, (taskData) => { setSearchSelectedTask(taskData); setIsTaskDetailOpen(true); setActiveTab('tasks'); });
        return <Reports user={user} onNavigateToTask={(taskData) => {
            setSearchSelectedTask(taskData);
            setIsTaskDetailOpen(true);
            setActiveTab('tasks');
          }} />;
      default: return renderOverview(
        setActiveTab,
        (taskData) => {
          setSearchSelectedTask(taskData);
          setIsTaskDetailOpen(true);
          setActiveTab('tasks');
        }
      );

    }
  };

  const NavItem = ({ id, label, icon }) => (
    <button 
      className={`nav-item ${activeTab === id ? 'active' : ''}`} 
      onClick={() => {
        setActiveTab(id);
        setSidebarOpen(false);
      }}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
    </button>
  );

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'salary': return { title: 'Payroll Management', back: 'HR', id: 'Salary' };
      case 'projects': return selectedProjectName
        ? { title: selectedProjectName, back: 'Projects', id: 'ProjectDetail' }
        : { title: 'Projects', back: 'Operations', id: 'Projects' };
      case 'track-team': return { title: 'Track your Team', back: 'Operations', id: 'TrackTeam' };
      case 'estimations': return { title: 'Estimations', back: 'Operations', id: 'Estimations' };
      case 'clients': return { title: 'Clients', back: 'Operations', id: 'Clients' };
      case 'tasks': return (isTaskDetailOpen || selectedTaskId)
        ? { title: 'Task Details', back: 'Tasks', id: 'TaskDetails' }
        : { title: 'Tasks', back: 'Operations', id: 'Tasks' };
      case 'users': return { title: 'User Management', back: 'Admin', id: 'Users' };
      case 'roles': return { title: 'Role Permissions', back: 'Admin', id: 'Roles' };
      case 'add-user': return { title: 'Create New User', back: 'Users', id: 'NewUser' };
      case 'edit-user': return { title: 'Edit User Profile', back: 'Users', id: 'EditUser' };
      case 'reports': return { title: 'Tasks - Delivery', back: 'Reports', id: 'Reports' };
      case 'reports-status-based': return { title: 'Tasks - Work Log', back: 'Reports', id: 'ReportsStatusBased' };
      case 'timesheet-overall': return { title: 'Timesheet - Summary', back: 'Reports', id: 'TimesheetOverall' };
      case 'timesheet-individual': return { title: 'Timesheet - Individual', back: 'Reports', id: 'TimesheetIndividual' };
      default: return { title: 'Dashboard', back: 'Main', id: 'Overview' };
    }
  };

  const header = getHeaderInfo();
  console.log(user?.role);
  const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase() : '?';


  return (
    <div className="saas-dashboard-layout">
      {sidebarOpen && (
        <div 
          className="saas-sidebar-backdrop" 
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            zIndex: 999
          }}
        />
      )}
      {/* SIDEBAR */}
      <aside className={`saas-sidebar-nav ${sidebarOpen ? 'open' : ''}`}>
        <div className="saas-sidebar-header">
          <div className="saas-brand">
            <img src="/spagylo-logo.png" alt="Spagylo CRM Logo" style={{ width: '2.5rem', height: 'auto', objectFit: 'contain' }} />
            <div className="saas-brand-text">
              <div className="saas-company">Spagylo CRM</div>
              <div className="saas-user-role">{user?.role || 'Admin'}</div>
            </div>
          </div>
        </div>

        <div className="saas-nav-groups">
          <div className="saas-nav-group">
            <NavItem id="overview" label="Dashboard" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>} />
          </div>

          <div className="saas-nav-group">
            {can('tasks', 'view') && <NavItem id="tasks" label="Tasks" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>} />}
            {can('projects', 'view') && <NavItem id="projects" label="Projects" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>} />}
            {can('teams', 'view') && <NavItem id="track-team" label="My Team" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>} />}
            {can('estimations', 'view') && <NavItem id="estimations" label="Estimations" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>} />}
            {(canReport('tasks-report') || canReport('reports-status-based') || canReport('timesheet-overall') || canReport('timesheet-individual')) && <NavItem id="reports" label="Reports" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>} />}
            {['reports','reports-status-based','timesheet-overall','timesheet-individual'].includes(activeTab) && (
              <div style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {canReport('tasks-report') && (
                  <button className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => { setActiveTab('reports'); setSidebarOpen(false); }} style={{ fontSize: '0.8rem', paddingLeft: '1rem' }}>
                    <span className="nav-label">Tasks - Delivery</span>
                  </button>
                )}
                {canReport('reports-status-based') && (
                  <button className={`nav-item ${activeTab === 'reports-status-based' ? 'active' : ''}`} onClick={() => { setActiveTab('reports-status-based'); setSidebarOpen(false); }} style={{ fontSize: '0.8rem', paddingLeft: '1rem' }}>
                    <span className="nav-label">Tasks - Work Log</span>
                  </button>
                )}
                {canReport('timesheet-overall') && (
                  <button className={`nav-item ${activeTab === 'timesheet-overall' ? 'active' : ''}`} onClick={() => { setActiveTab('timesheet-overall'); setSidebarOpen(false); }} style={{ fontSize: '0.8rem', paddingLeft: '1rem' }}>
                    <span className="nav-label">Timesheet - Summary</span>
                  </button>
                )}
                {canReport('timesheet-individual') && (
                  <button className={`nav-item ${activeTab === 'timesheet-individual' ? 'active' : ''}`} onClick={() => { setActiveTab('timesheet-individual'); setSidebarOpen(false); }} style={{ fontSize: '0.8rem', paddingLeft: '1rem' }}>
                    <span className="nav-label">Timesheet - Individual</span>
                  </button>
                )}
              </div>
            )}
            {can('clients', 'view') && <NavItem id="clients" label="Clients" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>} />}
          </div>

          {(can('users', 'view') || can('roles', 'view')) && (
            <div className="saas-nav-group">
              {can('users', 'view') && <NavItem id="users" label="Users" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-3-3.87"></path><path d="M2 21v-2a4 4 0 0 1 3-3.87"></path><circle cx="12" cy="7" r="4"></circle></svg>} />}
              {can('roles', 'view') && <NavItem id="roles" label="Roles" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>} />}
            </div>
          )}

        </div>



      </aside>

      {/* MOBILE BOTTOM TAB BAR MORE DRAWER BACKDROP */}
      {mobileMoreOpen && (
        <div 
          className="saas-mobile-more-backdrop" 
          onClick={() => { setMobileMoreOpen(false); setMobileReportsOpen(false); }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999
          }}
        />
      )}

      {/* MOBILE BOTTOM TAB BAR MORE POPUP MODULE */}
      {mobileMoreOpen && drawerItems.length > 0 && (
        <div className="saas-mobile-more-drawer">
          {mobileReportsOpen ? (
            /* Reports sub-menu */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                <button
                  onClick={() => setMobileReportsOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: '600', fontSize: '0.9rem', padding: 0 }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  Back
                </button>
                <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '1rem' }}>Reports</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {canReport('tasks-report') && (
                  <button onClick={() => { setActiveTab('reports'); setMobileMoreOpen(false); setMobileReportsOpen(false); }}
                    style={{ padding: '0.9rem 1.5rem', textAlign: 'left', background: activeTab === 'reports' ? '#eff6ff' : 'none', border: 'none', borderBottom: '1px solid #f1f5f9', fontWeight: activeTab === 'reports' ? '700' : '500', color: activeTab === 'reports' ? '#2563eb' : '#0f172a', cursor: 'pointer', fontSize: '0.95rem' }}>
                    Tasks - Delivery
                  </button>
                )}
                {canReport('reports-status-based') && (
                  <button onClick={() => { setActiveTab('reports-status-based'); setMobileMoreOpen(false); setMobileReportsOpen(false); }}
                    style={{ padding: '0.9rem 1.5rem', textAlign: 'left', background: activeTab === 'reports-status-based' ? '#eff6ff' : 'none', border: 'none', borderBottom: '1px solid #f1f5f9', fontWeight: activeTab === 'reports-status-based' ? '700' : '500', color: activeTab === 'reports-status-based' ? '#2563eb' : '#0f172a', cursor: 'pointer', fontSize: '0.95rem' }}>
                    Tasks - Work Log
                  </button>
                )}
                {canReport('timesheet-overall') && (
                  <button onClick={() => { setActiveTab('timesheet-overall'); setMobileMoreOpen(false); setMobileReportsOpen(false); }}
                    style={{ padding: '0.9rem 1.5rem', textAlign: 'left', background: activeTab === 'timesheet-overall' ? '#eff6ff' : 'none', border: 'none', borderBottom: '1px solid #f1f5f9', fontWeight: activeTab === 'timesheet-overall' ? '700' : '500', color: activeTab === 'timesheet-overall' ? '#2563eb' : '#0f172a', cursor: 'pointer', fontSize: '0.95rem' }}>
                    Timesheet - Summary
                  </button>
                )}
                {canReport('timesheet-individual') && (
                  <button onClick={() => { setActiveTab('timesheet-individual'); setMobileMoreOpen(false); setMobileReportsOpen(false); }}
                    style={{ padding: '0.9rem 1.5rem', textAlign: 'left', background: activeTab === 'timesheet-individual' ? '#eff6ff' : 'none', border: 'none', borderBottom: '1px solid #f1f5f9', fontWeight: activeTab === 'timesheet-individual' ? '700' : '500', color: activeTab === 'timesheet-individual' ? '#2563eb' : '#0f172a', cursor: 'pointer', fontSize: '0.95rem' }}>
                    Timesheet - Individual
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Regular icon grid */
            <div className="more-grid">
              {drawerItems.map(item => (
                <div key={item.id} className="more-item" onClick={() => {
                  if (item.id === 'reports') { setMobileReportsOpen(true); }
                  else { setActiveTab(item.id); setMobileMoreOpen(false); }
                }}>
                  <div className="more-icon" style={{ background: item.drawerBg }}>
                    {item.drawerIcon}
                  </div>
                  <span className="more-label">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MOBILE BOTTOM FIXED NAVIGATION TAB BAR */}
      <nav className="saas-mobile-bottom-nav">
        <button className={`mobile-nav-btn ${activeTab === 'overview' && !mobileMoreOpen ? 'active' : ''}`} onClick={() => { setActiveTab('overview'); setMobileMoreOpen(false); }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          <span className="mobile-nav-label">Home</span>
        </button>
        {bottomNavItems.map(item => (
          <button key={item.id} className={`mobile-nav-btn ${activeTab === item.id && !mobileMoreOpen ? 'active' : ''}`} onClick={() => { setActiveTab(item.id); setMobileMoreOpen(false); }}>
            {item.bottomNavIcon}
            <span className="mobile-nav-label">{item.label}</span>
          </button>
        ))}
        {showMoreButton && (
          <button className={`mobile-nav-btn ${mobileMoreOpen ? 'active' : ''}`} onClick={() => setMobileMoreOpen(!mobileMoreOpen)}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="12" r="2"></circle></svg>
            <span className="mobile-nav-label">More</span>
          </button>
        )}
      </nav>

      {/* MAIN CONTENT AREA */}
      <div className="saas-main-area">
        <header className="saas-main-header">
          <div className="saas-header-left-breadcrumbs-group">
            <button className="saas-hamburger-btn" onClick={() => setSidebarOpen(true)}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <button className="saas-back-nav-btn" onClick={() => window.history.back()} title="Go back">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <div className="saas-breadcrumbs">
              <span className="saas-breadcrumb-item active">{header.title}</span>
            </div>
          </div>
          <div style={{ display: 'none' }}>
            <button className="saas-back-link" onClick={() => setActiveTab('overview')}>← {header.back}</button>
            <div className="saas-header-meta">
              <span className="saas-ticket-id">#{header.id}</span>
              <h1 className="saas-header-title">{header.title}</h1>
              <button className="saas-star-btn">☆</button>
            </div></div>
          <div className="saas-header-center-search" ref={searchContainerRef} style={{ position: 'relative' }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={handleSearchFocus}
              placeholder="Search here..."
            />

            {showSearchResults && searchQuery.trim() && (
              <div className="saas-search-results-overlay">
                {filteredTasks.length === 0 && filteredProjects.length === 0 && filteredUsers.length === 0 && (
                  <div className="no-comments-placeholder" style={{ padding: '1rem', fontSize: '0.85rem' }}>No results found for "{searchQuery}"</div>
                )}                {filteredTasks.length > 0 && (
                  <div className="saas-search-category">
                    <div className="saas-search-category-title">Tasks</div>
                    {filteredTasks.slice(0, 5).map(t => (
                      <div key={t.id} className="saas-search-item" onClick={() => handleItemClick('task', t)}>
                        <div className="saas-search-item-icon">#</div>
                        <div className="saas-search-item-content">
                          <div className="saas-search-item-title">{t.title}</div>
                          <div className="saas-search-item-subtitle">{t.taskNo || ''} • {t.status} • {t.priority}{t.projectName ? ` • ${t.projectName}` : ''}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {filteredProjects.length > 0 && (
                  <div className="saas-search-category">
                    <div className="saas-search-category-title">Projects</div>
                    {filteredProjects.slice(0, 5).map(p => (
                      <div key={p.id} className="saas-search-item" onClick={() => handleItemClick('project', p)}>
                        <div className="saas-search-item-icon project-icon">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        </div>
                        <div className="saas-search-item-content">
                          <div className="saas-search-item-title">{p.name}</div>
                          <div className="saas-search-item-subtitle">{p.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {filteredUsers.length > 0 && (
                  <div className="saas-search-category">
                    <div className="saas-search-category-title">Users & Employees</div>
                    {filteredUsers.slice(0, 5).map(u => (
                      <div key={u.id} className="saas-search-item" onClick={() => handleItemClick('user', u)}>
                        <div className="saas-search-item-icon user-icon">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        </div>
                        <div className="saas-search-item-content">
                          <div className="saas-search-item-title">{u.fullName || `${u.firstName || ''} ${u.lastName || ''}`}</div>
                          <div className="saas-search-item-subtitle">{u.role || 'Member'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="saas-header-right">
            {/* Action Icons Group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {/* Notification Bell Icon */}
              <div style={{ position: 'relative' }} ref={notificationDropdownRef}>
                <button
                  className="saas-header-icon-btn notification-btn"
                  title="Notifications"
                  onClick={() => setIsNotificationDropdownOpen(!isNotificationDropdownOpen)}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                  {notifications.filter(n => !n.isRead).length > 0 && (
                    <span className="notification-badge">{notifications.filter(n => !n.isRead).length}</span>
                  )}
                </button>

                {isNotificationDropdownOpen && (
                  <div className="saas-notification-dropdown">
                    <div className="saas-notification-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>Notifications</h4>
                      <span onClick={handleMarkAllAsRead} style={{ cursor: 'pointer', color: '#0066FF', fontSize: '0.75rem', fontWeight: 600 }}>Mark all read</span>
                    </div>
                    <div className="saas-notification-list" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>No notifications</div>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} className={`saas-notification-item ${!n.isRead ? 'unread' : ''}`} onClick={() => handleMarkAsRead(n.id)} style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: !n.isRead ? '#f0f9ff' : 'white', transition: 'background 0.2s' }}>
                            <div style={{ fontWeight: !n.isRead ? 700 : 600, color: '#0f172a', fontSize: '0.85rem' }}>{n.title}</div>
                            <div style={{ color: '#475569', fontSize: '0.8rem', marginTop: '0.25rem', lineHeight: '1.4' }}>{n.message}</div>
                            <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: '0.5rem', fontWeight: '500' }}>{new Date(n.createdAt).toLocaleString()}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modern Rajesh Kumar style User Profile */}
            <div
              className="saas-user-profile-header"
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              style={{ cursor: 'pointer', position: 'relative' }}
              ref={profileDropdownRef}
            >
              <div className="saas-user-avatar">
                {user?.profileImage ? (
                  <img src={user.profileImage} alt="Profile" className="header-avatar-img" />
                ) : (
                  <div className="header-avatar-placeholder">
                    {initials(user?.fullName || user?.name || user?.role || 'User')}
                  </div>
                )}
              </div>
              <div className="saas-user-info">
                <span className="saas-user-name">{user?.fullName || user?.name || user?.role || 'User'}</span>
                <span className="saas-user-email">{user?.role || 'Admin'}</span>
              </div>
              <span className="saas-profile-chevron" style={{ transform: isProfileDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </span>

              {/* Dropdown Menu */}
              {isProfileDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  width: '200px',
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  zIndex: 100,
                  padding: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}>
                  <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f1f5f9', marginBottom: '0.25rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a' }}>{user?.fullName || user?.firstName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{user?.email}</div>
                  </div>
                  <button
                    onClick={onLogout}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: '#fee2e2',
                      color: '#b91c1c',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      textAlign: 'left'
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'none' }}>
            <div className="saas-user-profile-header">
              <div className="saas-user-info">
                <span className="saas-user-name">{user?.fullName || user?.name || user?.role || 'User'}</span>
                <span className="saas-user-email">{user?.email || ''}</span>
              </div>
              <div className="saas-user-avatar">
                {user?.profileImage ? (
                  <img src={user.profileImage} alt="Profile" className="header-avatar-img" />
                ) : (
                  <div className="header-avatar-placeholder">
                    {initials(user?.fullName || user?.name || user?.role || 'User')}
                  </div>
                )}
              </div>

            </div></div>

        </header>

        <div className={`saas-page-content${activeTab === 'tasks' ? ' tasks-page-active' : ''}`}>

          {renderContent()}
        </div>
      </div>
    </div>
  );
}
