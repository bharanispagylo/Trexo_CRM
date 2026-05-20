import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import './DashboardLayout.css';
import { usePermissions } from '../hooks/usePermissions';
import Employee from './pages/HR/Employee';
import Salary from './pages/HR/Salary';
import Leave from './pages/HR/Leave';
import Attendance from './pages/HR/Attendance';
import Projects from './pages/Operations/Projects';
import Teams from './pages/Operations/Teams';
import Tasks from './pages/Operations/Tasks';
import Users from './pages/Administration/Users';
import Roles from './pages/Administration/Roles';
import AddUser from './pages/Administration/AddUser';
import EditUser from './pages/Administration/EditUser';
import Reports from './pages/Administration/Reports';



export default function DashboardLayout({ user, onLogout, renderOverview }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [userToEdit, setUserToEdit] = useState(null);
  const { can, loading } = usePermissions();
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);

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
      case 'employee': return <Employee user={user} />;
      case 'salary': return <Salary user={user} />;
      case 'leave': return <Leave user={user} />;
      case 'attendance': return <Attendance user={user} />;
      case 'projects': return (
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
      case 'teams': return <Teams user={user} />;
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
      default: return renderOverview(setActiveTab);


    }
  };

  const NavItem = ({ id, label, icon }) => (
    <button className={`nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
    </button>
  );

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'employee': return { title: 'Employee Directory', back: 'HR', id: 'Employees' };
      case 'salary': return { title: 'Payroll Management', back: 'HR', id: 'Salary' };
      case 'leave': return { title: 'Leave Requests', back: 'HR', id: 'Leave' };
      case 'attendance': return { title: 'Attendance Logs', back: 'HR', id: 'Attendance' };
      case 'projects': return { title: 'Project Portfolio', back: 'Operations', id: 'Projects' };
      case 'teams': return { title: 'Team Structure', back: 'Operations', id: 'Teams' };
      case 'tasks': return isTaskDetailOpen
        ? { title: 'Task Details', back: 'Tasks', id: 'TaskDetails' }
        : { title: 'Tasks', back: 'Operations', id: 'Tasks' };
      case 'users': return { title: 'User Management', back: 'Admin', id: 'Users' };
      case 'roles': return { title: 'Role Permissions', back: 'Admin', id: 'Roles' };
      case 'add-user': return { title: 'Create New User', back: 'Users', id: 'NewUser' };
      case 'edit-user': return { title: 'Edit User Profile', back: 'Users', id: 'EditUser' };
      case 'reports': return { title: 'Reports', back: 'Reports', id: 'Reports' };
      default: return { title: 'Dashboard Overview', back: 'Main', id: 'Overview' };


    }
  };

  const header = getHeaderInfo();
  console.log(user?.role);
    const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase() : '?';

    return (
    <div className="saas-dashboard-layout">
      {/* SIDEBAR */}
      <aside className="saas-sidebar-nav">
        <div className="saas-sidebar-header">
          <div className="saas-brand">
            <div className="saas-logo spagylo-logo">S</div>
            <div className="saas-brand-text">
              <div className="saas-company">Spagylo CRM</div>
              <div className="saas-user-role">{user?.role || 'Admin'}</div>
            </div>
          </div>
        </div>

        <div className="saas-nav-groups">
          <div className="saas-nav-group">
            <NavItem id="overview" label="Dashboard" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>} />
            {can('attendance', 'view') && <NavItem id="attendance" label="Attendance" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>} />}
            {can('leave', 'view') && <NavItem id="leave" label="Leave" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>} />}
          </div>

          <div className="saas-nav-group">
            {can('tasks', 'view') && <NavItem id="tasks" label="Tasks" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>} />}
            {can('teams', 'view') && <NavItem id="teams" label="Teams" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>} />}
            {can('projects', 'view') && <NavItem id="projects" label="Projects" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>} />}
          </div>

          {(can('employees', 'view') || can('users', 'view') || can('roles', 'view') || user?.role?.toLowerCase() === 'admin') && (
            <div className="saas-nav-group">
              {can('employees', 'view') && <NavItem id="employee" label="Employees" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>} />}
              {can('users', 'view') && <NavItem id="users" label="Users" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-3-3.87"></path><path d="M2 21v-2a4 4 0 0 1 3-3.87"></path><circle cx="12" cy="7" r="4"></circle></svg>} />}
              {user?.role?.toLowerCase() === 'admin' && <NavItem id="reports" label="Reports" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>} />}
              {user?.role?.toLowerCase() === 'admin' && <NavItem id="roles" label="Settings" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>} />}
            </div>
          )}

        </div>

        {/* Sidebar Help Support Card */}
        <div className="saas-sidebar-footer">
          <div className="support-card-modern">
            <div className="support-icon-circle">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#2563eb" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <div className="support-text-wrapper">
              <span className="support-title">Need help?</span>
              <span className="support-subtitle">Contact Support</span>
            </div>
          </div>
        </div>

      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="saas-main-area">
        <header className="saas-main-header">
           <div className="saas-header-left-breadcrumbs-group">
               <button className="saas-hamburger-btn">
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
                     )}

                     {filteredTasks.length > 0 && (
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
                                 <div className="saas-search-item-icon project-icon">📁</div>
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
                                 <div className="saas-search-item-icon user-icon">👤</div>
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
                <button className="saas-header-icon-btn notification-btn" title="Notifications">
                   <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                   <span className="notification-badge">2</span>
                </button>

                {/* Help support circle question mark icon */}
                <button className="saas-header-icon-btn help-btn" title="Help & Support">
                   <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                </button>
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
