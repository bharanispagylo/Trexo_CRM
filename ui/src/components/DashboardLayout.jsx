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
import { useAlert } from '../context/AlertContext';
import { onMessageListener } from '../firebase';
export default function DashboardLayout({ user, onLogout, renderOverview }) {
  const [activeTab, setActiveTab] = useState(() => {
    const path = window.location.pathname.substring(1);
    return path || 'overview';
  });
  const [userToEdit, setUserToEdit] = useState(null);
  const { can, loading } = usePermissions();
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);


  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.substring(1);
      setActiveTab(path || 'overview');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const currentPath = window.location.pathname.substring(1) || 'overview';
    if (activeTab !== currentPath) {
      const newUrl = activeTab === 'overview' ? '/' : `/${activeTab}`;
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
      }
    }
  }, [activeTab, loading, can, user]);

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

  const { alert } = useAlert();

  useEffect(() => {
    const unsubscribe = onMessageListener((payload) => {
      const title = payload?.notification?.title || 'New Notification';
      const body = payload?.notification?.body || 'You have a new update.';
      alert(body, 'info', title);
      fetchNotifications(); // Refresh dropdown
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const filteredTasks = searchQuery.trim()
    ? allTasks.filter(t =>
      (t.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
    : [];

  const filteredProjects = searchQuery.trim()
    ? allProjects.filter(p =>
      (p.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
    : [];

  const filteredUsers = searchQuery.trim()
    ? allUsers.filter(u =>
      (u.fullName || `${u.firstName || ''} ${u.lastName || ''}`).toLowerCase().includes(searchQuery.toLowerCase())
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
        />
      );
      case 'estimations': 
        if (['employee', 'intern', 'guest', 'team lead'].includes(user?.role?.toLowerCase())) {
          return renderOverview(setActiveTab, (taskData) => {
            setSearchSelectedTask(taskData);
            setIsTaskDetailOpen(true);
            setActiveTab('tasks');
          });
        }
        return <Estimations user={user} />;
      case 'clients': 
        if (user?.role?.toLowerCase() !== 'admin') {
          return renderOverview(setActiveTab, (taskData) => {
            setSearchSelectedTask(taskData);
            setIsTaskDetailOpen(true);
            setActiveTab('tasks');
          });
        }
        return <Clients user={user} />;
      case 'track-team':
        if (user?.role?.toLowerCase() !== 'admin') {
          return renderOverview(setActiveTab, (taskData) => {
            setSearchSelectedTask(taskData);
            setIsTaskDetailOpen(true);
            setActiveTab('tasks');
          });
        }
        return <TrackTeam user={user} />;
      case 'tasks': return (
        <Tasks
          user={user}
          initialSelectedTask={searchSelectedTask}
          onClearInitialTask={() => setSearchSelectedTask(null)}
          onDetailViewChange={(open) => setIsTaskDetailOpen(open)}
        />
      );
      case 'users': return <Users user={user} onAddUser={() => setActiveTab('add-user')} onEditUser={(u) => { setUserToEdit(u); setActiveTab('edit-user'); }} />;
      case 'roles': return <Roles user={user} />;
      case 'add-user': return <AddUser user={user} onBack={() => setActiveTab('users')} />;
      case 'edit-user': return <EditUser userToEdit={userToEdit} onBack={() => setActiveTab('users')} />;
      case 'reports': return <Reports user={user} />;
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
      case 'projects': return { title: 'Project Portfolio', back: 'Operations', id: 'Projects' };
      case 'track-team': return { title: 'Track your Team', back: 'Operations', id: 'TrackTeam' };
      case 'estimations': return { title: 'Estimations', back: 'Operations', id: 'Estimations' };
      case 'clients': return { title: 'Client Management', back: 'Operations', id: 'Clients' };
      case 'tasks': return isTaskDetailOpen
        ? { title: 'Task Details', back: 'Tasks', id: 'TaskDetails' }
        : { title: 'Tasks', back: 'Operations', id: 'Tasks' };
      case 'users': return { title: 'User Management', back: 'Admin', id: 'Users' };
      case 'roles': return { title: 'Role Permissions', back: 'Admin', id: 'Roles' };
      case 'add-user': return { title: 'Create New User', back: 'Users', id: 'NewUser' };
      case 'edit-user': return { title: 'Edit User Profile', back: 'Users', id: 'EditUser' };
      case 'reports': return { title: 'Reports', back: 'Reports', id: 'Reports' };
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
            {can('reports', 'view') && <NavItem id="reports" label="Reports" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>} />}
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
          onClick={() => setMobileMoreOpen(false)}
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
      {mobileMoreOpen && (
        <div className="saas-mobile-more-drawer">
          <div className="more-grid">
            <div className="more-item" onClick={() => { setActiveTab('reports'); setMobileMoreOpen(false); }}>
              <div className="more-icon" style={{ background: '#3b82f6' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              </div>
              <span className="more-label">Reports</span>
            </div>
            <div className="more-item" onClick={() => { setActiveTab('overview'); setMobileMoreOpen(false); }}>
              <div className="more-icon" style={{ background: '#8b5cf6' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="13" y2="17"></line></svg>
              </div>
              <span className="more-label">Dashboard</span>
            </div>
            <div className="more-item" onClick={() => { setActiveTab('tasks'); setMobileMoreOpen(false); }}>
              <div className="more-icon" style={{ background: '#7c3aed' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
              </div>
              <span className="more-label">Tasks</span>
            </div>
            <div className="more-item" onClick={() => { setActiveTab('track-team'); setMobileMoreOpen(false); }}>
              <div className="more-icon" style={{ background: '#10b981' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
              </div>
              <span className="more-label">My Team</span>
            </div>
            <div className="more-item" onClick={() => { setActiveTab('roles'); setMobileMoreOpen(false); }}>
              <div className="more-icon" style={{ background: '#3b82f6' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
              </div>
              <span className="more-label">Roles</span>
            </div>
            <div className="more-item" onClick={() => { setActiveTab('estimations'); setMobileMoreOpen(false); }}>
              <div className="more-icon" style={{ background: '#f59e0b' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </div>
              <span className="more-label">Estimations</span>
            </div>
            <div className="more-item" onClick={() => { setActiveTab('users'); setMobileMoreOpen(false); }}>
              <div className="more-icon" style={{ background: '#ec4899' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              </div>
              <span className="more-label">Users</span>
            </div>
            <div className="more-item" onClick={() => { setActiveTab('clients'); setMobileMoreOpen(false); }}>
              <div className="more-icon" style={{ background: '#10b981' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              </div>
              <span className="more-label">Clients</span>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM FIXED NAVIGATION TAB BAR */}
      <nav className="saas-mobile-bottom-nav">
        <button className={`mobile-nav-btn ${activeTab === 'overview' && !mobileMoreOpen ? 'active' : ''}`} onClick={() => { setActiveTab('overview'); setMobileMoreOpen(false); }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          <span className="mobile-nav-label">Home</span>
        </button>
        <button className={`mobile-nav-btn ${activeTab === 'tasks' && !mobileMoreOpen ? 'active' : ''}`} onClick={() => { setActiveTab('tasks'); setMobileMoreOpen(false); }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
          <span className="mobile-nav-label">My Tasks</span>
        </button>
        <button className={`mobile-nav-btn ${activeTab === 'projects' && !mobileMoreOpen ? 'active' : ''}`} onClick={() => { setActiveTab('projects'); setMobileMoreOpen(false); }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
          <span className="mobile-nav-label">Projects</span>
        </button>
        <button className={`mobile-nav-btn ${mobileMoreOpen ? 'active' : ''}`} onClick={() => setMobileMoreOpen(!mobileMoreOpen)}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="12" r="2"></circle></svg>
          <span className="mobile-nav-label">More</span>
        </button>
      </nav>

      {/* MAIN CONTENT AREA */}
      <div className="saas-main-area">
        <header className="saas-main-header">
          <div className="saas-header-left-breadcrumbs-group">
            <button className="saas-hamburger-btn" onClick={() => setSidebarOpen(true)}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div className="saas-breadcrumbs">
              <span className="saas-breadcrumb-item">{header.back}</span>
              <span className="saas-breadcrumb-separator">&gt;</span>
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
            <span className="saas-search-kbd">Ctrl + /</span>

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
                          <div className="saas-search-item-subtitle">{t.status} • {t.priority}</div>
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

        <div className="saas-page-content">

          {renderContent()}
        </div>
      </div>
    </div>
  );
}
