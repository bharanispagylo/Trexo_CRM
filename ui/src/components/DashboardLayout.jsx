import React, { useState } from 'react';
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



export default function DashboardLayout({ user, onLogout, renderOverview }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [userToEdit, setUserToEdit] = useState(null);
  const { can, loading } = usePermissions();

  if (loading) return <div className="loading-screen">Loading Permissions...</div>;


  const renderContent = () => {
    switch (activeTab) {
      case 'employee': return <Employee user={user} />;
      case 'salary': return <Salary user={user} />;
      case 'leave': return <Leave user={user} />;
      case 'attendance': return <Attendance user={user} />;
      case 'projects': return <Projects user={user} />;
      case 'teams': return <Teams user={user} />;
      case 'tasks': return <Tasks user={user} />;
      case 'users': return <Users user={user} onAddUser={() => setActiveTab('add-user')} onEditUser={(u) => { setUserToEdit(u); setActiveTab('edit-user'); }} />;
      case 'roles': return <Roles user={user} />;
      case 'add-user': return <AddUser user={user} onBack={() => setActiveTab('users')} />;
      case 'edit-user': return <EditUser userToEdit={userToEdit} onBack={() => setActiveTab('users')} />;
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
      case 'tasks': return { title: 'Task Workspace', back: 'Operations', id: 'Tasks' };
      case 'users': return { title: 'User Management', back: 'Admin', id: 'Users' };
      case 'roles': return { title: 'Role Permissions', back: 'Admin', id: 'Roles' };
      case 'add-user': return { title: 'Create New User', back: 'Users', id: 'NewUser' };
      case 'edit-user': return { title: 'Edit User Profile', back: 'Users', id: 'EditUser' };
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
            <div className="saas-logo">OC</div>
            <div className="saas-brand-text">
              <div className="saas-company">Office CRM</div>
              <div className="saas-user-role">{user?.role || 'Admin'}</div>
            </div>
          </div>
          
          <div className="saas-sidebar-search">
             <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
             <input placeholder="Search" />
             <span className="saas-search-kbd">⌘ K</span>
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

          {(can('employees', 'view') || can('users', 'view') || can('roles', 'view')) && (
            <div className="saas-nav-group">
              {can('employees', 'view') && <NavItem id="employee" label="Employees" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>} />}
              {can('users', 'view') && <NavItem id="users" label="Users" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-3-3.87"></path><path d="M2 21v-2a4 4 0 0 1 3-3.87"></path><circle cx="12" cy="7" r="4"></circle></svg>} />}
              {user?.role?.toLowerCase() === 'admin' && <NavItem id="roles" label="Roles" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>} />}
            </div>
          )}

        </div>


      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="saas-main-area">
        <header className="saas-main-header">
           <div className="saas-header-left">
              <button className="saas-back-link" onClick={() => setActiveTab('overview')}>← {header.back}</button>
              <div className="saas-header-meta">
                 <span className="saas-ticket-id">#{header.id}</span>
                 <h1 className="saas-header-title">{header.title}</h1>
                 <button className="saas-star-btn">☆</button>
              </div>
           </div>
           <div className="saas-header-right">
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

              </div>
           </div>

        </header>

        <div className="saas-page-content">

          {renderContent()}
        </div>
      </div>
    </div>
  );
}
