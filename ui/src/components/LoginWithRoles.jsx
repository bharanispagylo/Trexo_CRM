import { useState, useEffect } from "react";
import "./LoginWithRoles.css";
import DashboardLayout from "./DashboardLayout";
import { api } from "../api/client";
import { PermissionProvider } from "../hooks/usePermissions";

// ── Mock Users Database Removed ──────────────────────────────

// ── Avatar ─────────────────────────────────────────────────
function Avatar({ initials, image, size = "md", ring = false }) {
  const sizeClass = `avatar-${size}`;
  const ringClass = ring ? "avatar-ring" : "";

  if (image) {
    return (
      <div className={`avatar ${sizeClass} ${ringClass}`}>
        <img src={image} alt={initials} className="avatar-img" />
      </div>
    );
  }

  const validInitials = ["RK", "MS", "AK", "PN", "KS"];
  const gradClass = validInitials.includes(initials) ? `avatar-${initials}` : "avatar-default";

  return (
    <div className={`avatar ${sizeClass} ${gradClass} ${ringClass}`}>
      {initials}
    </div>
  );
}


// ══════════════════════════════════════════════════════════
//  LOGIN PAGE
// ══════════════════════════════════════════════════════════
function LoginPage({ onLogin, onRegisterClick }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoUsers, setDemoUsers] = useState([]);

  useEffect(() => {
    const fetchDemo = async () => {
      try {
        const data = await api.get('/users');
        setDemoUsers(data.slice(0, 5) || []);
      } catch (err) {
        console.error("Demo fetch error:", err);
      }
    };
    fetchDemo();
  }, []);

  const handleLogin = async () => {
    setError("");
    if (!email || !password) { setError("Please enter email and password."); return; }
    setLoading(true);
    try {
      const user = await api.post('/login', { email, password });
      onLogin(user);
    } catch (err) {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (u) => {
    setEmail(u.email);
    setPassword(u.password);
    setError("");
  };

  return (
    <div className="login-container app-container">
      {/* Left panel — branding */}
      <div className="login-left-panel">
        <div className="login-bg-gradient" />
        <div className="login-bg-pattern" />
        <div className="login-bg-glow-1" />
        <div className="login-bg-glow-2" />

        <div className="logo-container">
          <div className="logo-icon">O</div>
          <div>
            <div className="logo-text">OfficeCRM</div>
            <div className="logo-subtext">Employee Management Portal</div>
          </div>
        </div>

        <div className="login-center-content">
          <div className="login-badge">Secure Role-Based Access</div>
          <h2 className="login-title">
            One portal.<br />
            <span className="login-title-highlight">Two roles.</span><br />
            Seamless access.
          </h2>
          <p className="login-desc">
            Administrators manage the full workforce. Employees access their own profile, leave, and documents — all from a single secure login.
          </p>

          <div className="role-cards">
            <div className="role-card">
              <div className="role-card-title">Admin</div>
              <div className="role-card-desc">Full workforce control & reporting</div>
            </div>
            <div className="role-card">
              <div className="role-card-title">Employee</div>
              <div className="role-card-desc">Personal profile & self-service</div>
            </div>
          </div>
        </div>

        <div className="login-footer">© 2025 OfficeCRM · All rights reserved</div>
      </div>

      {/* Right panel — login form */}
      <div className="login-right-panel">
        <div className="mobile-logo">
          <div className="logo-icon logo-icon-sm">O</div>
          <div className="logo-text logo-text-lg">OfficeCRM</div>
        </div>

        <div className="login-form-container">
          <h1 className="login-heading">Welcome back</h1>
          <p className="login-subheading">Sign in to your account to continue</p>

          {error && (
            <div className="error-message">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="you@officecrm.in"
              className="input-field"
            />
          </div>

          <div className="input-group input-group-mb-lg">
            <label className="input-label">Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="Enter your password"
                className="input-field input-field-pwd"
              />
              <button
                onClick={() => setShowPwd(v => !v)}
                className="pwd-toggle-btn"
              >{showPwd ? "" : ""}</button>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? (
              <><span className="spinner"></span> Signing in...</>
            ) : (
              <><span></span> Sign In</>
            )}
          </button>

          <div className="auth-switch-prompt">
            <span className="auth-switch-text">Don't have an account? </span>
            <button className="auth-switch-btn" onClick={onRegisterClick}>Register now</button>
          </div>

          {/* Demo credentials */}
          <div className="demo-section">
            <div className="demo-divider">
              <div className="demo-divider-line" />
              <span className="demo-divider-text">Try Registered Accounts</span>
              <div className="demo-divider-line" />
            </div>
            <div className="demo-list">
              {demoUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => fillDemo(u)}
                  className="demo-btn"
                >
                  <Avatar
                    initials={u.firstName?.charAt(0) || u.fullName?.charAt(0) || "U"}
                    image={u.profileImage}
                    size="sm"
                  />
                  <div className="demo-info">

                    <div className="demo-name">{u.fullName || `${u.firstName} ${u.lastName}`}</div>
                    <div className="demo-email">{u.email}</div>
                  </div>
                  <span className={`role-badge ${(u.role || 'employee').toLowerCase() === "admin" ? "role-badge-admin" : "role-badge-emp"}`}>
                    {u.role || "Employee"}
                  </span>
                </button>
              ))}
            </div>
            {demoUsers.length === 0 && <p className="demo-hint">No registered users yet. Please register or add one via Admin.</p>}
            {demoUsers.length > 0 && <p className="demo-hint">Click any account to auto-fill credentials</p>}
          </div>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════
//  REGISTER PAGE
// ══════════════════════════════════════════════════════════
function RegisterPage({ onRegister, onLoginClick }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError("");
    if (!name || !email || !password) { setError("Please fill all fields."); return; }
    setLoading(true);
    try {
      const newUser = await api.post('/users', {
        firstName: name.split(' ')[0],
        lastName: name.split(' ').slice(1).join(' '),
        email,
        password,
        role: 'admin',
        empId: `ADM-${Math.floor(1000 + Math.random() * 9000)}`
      });
      onRegister(newUser);
    } catch (err) {
      setError(err.message || "Registration failed. Email might already be in use.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="login-container app-container">
      {/* Left panel */}
      <div className="login-left-panel">
        <div className="login-bg-gradient" />
        <div className="login-bg-pattern" />
        <div className="login-bg-glow-1" />
        <div className="login-bg-glow-2" />

        <div className="logo-container">
          <div className="logo-icon">O</div>
          <div>
            <div className="logo-text">OfficeCRM</div>
            <div className="logo-subtext">Employee Management Portal</div>
          </div>
        </div>

        <div className="login-center-content">
          <div className="login-badge">Join Our Team</div>
          <h2 className="login-title">
            Start your journey.<br />
            <span className="login-title-highlight">Register today.</span><br />
            Seamless onboarding.
          </h2>
          <p className="login-desc">
            Create an account to access the full suite of tools and manage your profile with ease.
          </p>
        </div>
        <div className="login-footer">© 2025 OfficeCRM · All rights reserved</div>
      </div>

      {/* Right panel */}
      <div className="login-right-panel">
        <div className="mobile-logo">
          <div className="logo-icon logo-icon-sm">O</div>
          <div className="logo-text logo-text-lg">OfficeCRM</div>
        </div>

        <div className="login-form-container">
          <h1 className="login-heading">Create an account</h1>
          <p className="login-subheading">Sign up to get started</p>

          {error && (
            <div className="error-message">
              <span></span> {error}
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="John Doe"
              className="input-field"
            />
          </div>

          <div className="input-group">
            <label className="input-label">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@officecrm.in"
              className="input-field"
            />
          </div>

          <div className="input-group input-group-mb-lg">
            <label className="input-label">Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRegister()}
                placeholder="Create a password"
                className="input-field input-field-pwd"
              />
              <button
                onClick={() => setShowPwd(v => !v)}
                className="pwd-toggle-btn"
              >{showPwd ? "👁️" : "🔒"}</button>
            </div>
          </div>


          <button
            onClick={handleRegister}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? (
              <><span className="spinner"></span> Registering...</>
            ) : (
              <><span></span> Sign Up</>
            )}
          </button>

          <div className="auth-switch-prompt">
            <span className="auth-switch-text">Already have an account? </span>
            <button className="auth-switch-btn" onClick={onLoginClick}>Sign in</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  ADMIN DASHBOARD
// ══════════════════════════════════════════════════════════

function AdminDashboard({ user, onLogout, setActiveTab, handleTaskClick }) {
  const [tasks, setTasks] = useState({ today: [], upcoming: [], backlog: [] });


  useEffect(() => {
    const fetchData = async () => {
      try {
        const allTasks = await api.get('/tasks');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();
        const todayTasks = [];
        const upcomingTasks = [];
        const backlogTasks = [];

        (allTasks || []).forEach(task => {
          if (task.status === 'Delivered' || task.status === 'Prod Verified') return;
          
          // 1. Backlog Tasks: if deliveredDate or dueDate is in the past
          let isBacklog = false;
          if (task.deliveredDate) {
             const d = new Date(task.deliveredDate);
             d.setHours(0, 0, 0, 0);
             if (d.getTime() < todayTime) {
                isBacklog = true;
             }
          } else if (task.dueDate) {
             const d = new Date(task.dueDate);
             d.setHours(0, 0, 0, 0);
             if (d.getTime() < todayTime) {
                isBacklog = true;
             }
          }
          
          if (isBacklog) {
             backlogTasks.push(task);
             return;
          }

          // 2. Today Tasks: based on assignedDate
          let isToday = false;
          if (task.assignedDate) {
             const a = new Date(task.assignedDate);
             a.setHours(0, 0, 0, 0);
             if (a.getTime() === todayTime) {
                isToday = true;
             }
          } else {
             // Fallback to createdAt if assignedDate is not set
             const c = new Date(task.createdAt || Date.now());
             c.setHours(0, 0, 0, 0);
             if (c.getTime() === todayTime) {
                isToday = true;
             }
          }

          if (isToday) {
             todayTasks.push(task);
          } else {
             // 3. Upcoming Tasks: remaining tasks
             upcomingTasks.push(task);
          }
        });
        setTasks({ today: todayTasks, upcoming: upcomingTasks, backlog: backlogTasks });



      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      }
    };
    fetchData();
  }, []);

  const renderTaskCard = (title, tasksList, type) => (
    <div className={`panel-card task-card-${type}`} style={{ flex: 1, minWidth: '300px' }}>
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="panel-title">{title}</h3>
        <span style={{ background: '#e2e8f0', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>{tasksList.length}</span>
      </div>
      <div className="list-group" style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {tasksList.length === 0 ? (
          <p style={{ color: '#94a3b8', padding: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>No tasks found.</p>
        ) : (
          tasksList.slice(0, 5).map((t, i) => (
            <div key={i} className="list-item" style={{ cursor: 'pointer', padding: '0.75rem', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '4px' }} onClick={() => handleTaskClick ? handleTaskClick(t) : (setActiveTab && setActiveTab('tasks'))}>
               <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>{t.title}</span>
                  <span className={`status-badge status-${t.status.toLowerCase().replace(' ', '-')}`} style={{ fontSize: '0.7rem' }}>{t.status}</span>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.taskNo || `TSK-${t.id?.substring(0, 4)}`} • {t.priority}</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'No Date'}</span>
               </div>
            </div>
          ))
        )}
        {tasksList.length > 5 && (
          <button onClick={() => handleTaskClick ? handleTaskClick(null) : (setActiveTab && setActiveTab('tasks'))} style={{ width: '100%', padding: '0.5rem', background: 'none', border: 'none', color: '#2563eb', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600, borderTop: '1px solid #f1f5f9' }}>View All {tasksList.length} Tasks →</button>
        )}
      </div>
    </div>
  );





  return (
    <div className="dashboard-container app-container">
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="logo-icon logo-icon-sm">O</div>
          <span className="topbar-title">OfficeCRM</span>
        </div>
        <div className="topbar-context">
          <div className="topbar-context-title">Admin Dashboard</div>
          <p className="topbar-context-sub">Full system access</p>
        </div>
        <div className="flex-spacer" />
        <div className="topbar-actions">
          {/* Profile block removed in favor of DashboardLayout header */}
        </div>
      </header>

      <main className="main-content">
        {/* Task Cards Section */}
        <h2 className="panel-title" style={{ marginTop: "1rem", marginBottom: "1rem" }}>Task Overview</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '2 1 60%', minWidth: '300px', display: 'flex' }}>
              {renderTaskCard("Today's Tasks", tasks.today, "today")}
            </div>
            <div style={{ flex: '1 1 30%', minWidth: '250px', display: 'flex' }}>
              {renderTaskCard("Upcoming Tasks", tasks.upcoming, "upcoming")}
            </div>
          </div>
          <div style={{ width: '100%', display: 'flex' }}>
            {renderTaskCard("Backlog Tasks", tasks.backlog, "backlog")}
          </div>
        </div>
      </main>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  EMPLOYEE DASHBOARD
// ══════════════════════════════════════════════════════════
function EmployeeDashboard({ user, onLogout, setActiveTab, handleTaskClick }) {
  const [tasks, setTasks] = useState({ today: [], upcoming: [], backlog: [] });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userName = (user.fullName || user.firstName || '').trim().toLowerCase();

        // 1. Fetch Attendance
        // const allAttendance = await api.get('/attendance');
        // const myAttendanceCount = (allAttendance || []).filter(a => a.name?.trim().toLowerCase() === userName).length;
        // setAttendanceCount(myAttendanceCount);

        // 2. Fetch Leaves
        // const allLeaves = await api.get('/leaves');
        // const myLeaves = (allLeaves || []).filter(l => l.name?.trim().toLowerCase() === userName);
        // setRecentLeaves(myLeaves.slice(0, 5));

        // const myApprovedLeaves = myLeaves.filter(l => l.status === 'Approved');
        // const usedDays = myApprovedLeaves.reduce((sum, l) => sum + (l.days || 0), 0);
        // setLeaveBalance(15 - usedDays);

        // 3. Fetch Tasks
        const allTasks = await api.get('/tasks');
        
        // Robust assignee matching
        const myTasks = allTasks.filter(t => {
          if (!t.assignees) return false;
          const assigneesList = t.assignees.split(',').map(s => s.trim().toLowerCase());
          const cleanName = userName.replace(/[^a-z0-9]/g, '');
          const cleanEmail = (user.email || '').toLowerCase().trim();
          const cleanEmailPrefix = cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '');

          return assigneesList.some(assignee => {
            const cleanAssignee = assignee.replace(/[^a-z0-9]/g, '');
            if (assignee === cleanEmail) return true;
            if (cleanAssignee === cleanEmailPrefix) return true;
            if (cleanAssignee.includes(cleanName) || cleanName.includes(cleanAssignee)) return true;
            return false;
          });
        });
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();

        const todayTasks = [];
        const upcomingTasks = [];
        const backlogTasks = [];

        myTasks.forEach(task => {
          if (task.status === 'Delivered' || task.status === 'Prod Verified') return; // ignore completed
          
          // 1. Backlog Tasks: if deliveredDate or dueDate is in the past
          let isBacklog = false;
          if (task.deliveredDate) {
             const d = new Date(task.deliveredDate);
             d.setHours(0, 0, 0, 0);
             if (d.getTime() < todayTime) {
                isBacklog = true;
             }
          } else if (task.dueDate) {
             const d = new Date(task.dueDate);
             d.setHours(0, 0, 0, 0);
             if (d.getTime() < todayTime) {
                isBacklog = true;
             }
          }
          
          if (isBacklog) {
             backlogTasks.push(task);
             return;
          }

          // 2. Today Tasks: based on assignedDate
          let isToday = false;
          if (task.assignedDate) {
             const a = new Date(task.assignedDate);
             a.setHours(0, 0, 0, 0);
             if (a.getTime() === todayTime) {
                isToday = true;
             }
          } else {
             // Fallback to createdAt if assignedDate is not set
             const c = new Date(task.createdAt || Date.now());
             c.setHours(0, 0, 0, 0);
             if (c.getTime() === todayTime) {
                isToday = true;
             }
          }

          if (isToday) {
             todayTasks.push(task);
          } else {
             // 3. Upcoming Tasks: remaining tasks
             upcomingTasks.push(task);
          }
        });
        setTasks({ today: todayTasks, upcoming: upcomingTasks, backlog: backlogTasks });

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };
    fetchData();
  }, [user]);

  const renderTaskCard = (title, tasksList, type) => (
    <div className={`panel-card task-card-${type}`} style={{ flex: 1, minWidth: '300px' }}>
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="panel-title">{title}</h3>
        <span style={{ background: '#e2e8f0', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>{tasksList.length}</span>
      </div>
      <div className="list-group" style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {tasksList.length === 0 ? (
          <p style={{ color: '#94a3b8', padding: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>No tasks found.</p>
        ) : (
          tasksList.slice(0, 5).map((t, i) => (
            <div key={i} className="list-item" style={{ cursor: 'pointer', padding: '0.75rem', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '4px' }} onClick={() => handleTaskClick ? handleTaskClick(t) : (setActiveTab && setActiveTab('tasks'))}>
               <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>{t.title}</span>
                  <span className={`status-badge status-${t.status.toLowerCase().replace(' ', '-')}`} style={{ fontSize: '0.7rem' }}>{t.status}</span>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.taskNo || `TSK-${t.id?.substring(0, 4)}`} • {t.priority}</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'No Date'}</span>
               </div>
            </div>
          ))
        )}
        {tasksList.length > 5 && (
          <button onClick={() => handleTaskClick ? handleTaskClick(null) : (setActiveTab && setActiveTab('tasks'))} style={{ width: '100%', padding: '0.5rem', background: 'none', border: 'none', color: '#2563eb', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600, borderTop: '1px solid #f1f5f9' }}>View All {tasksList.length} Tasks →</button>
        )}
      </div>
    </div>
  );

  return (
    <div className="dashboard-container dashboard-container-emp app-container">
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="logo-icon logo-icon-sm">O</div>
          <span className="topbar-title">OfficeCRM</span>
        </div>
        <div className="flex-spacer" />
        <div className="topbar-actions">
          {/* Profile block removed in favor of DashboardLayout header */}
        </div>
      </header>

      <main className="main-content main-content-emp">
        {/* Task Cards Section */}
        <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
          <h3 className="tasks-title" style={{ marginBottom: '1rem' }}>My Tasks</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '2 1 60%', minWidth: '300px', display: 'flex' }}>
                {renderTaskCard("Today's Tasks", tasks.today, "today")}
              </div>
              <div style={{ flex: '1 1 30%', minWidth: '250px', display: 'flex' }}>
                {renderTaskCard("Upcoming Tasks", tasks.upcoming, "upcoming")}
              </div>
            </div>
            <div style={{ width: '100%', display: 'flex' }}>
              {renderTaskCard("Backlog Tasks", tasks.backlog, "backlog")}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  ROOT — ENTRY POINT
// ══════════════════════════════════════════════════════════
export default function LoginWithRoles() {
  const [user, setUser] = useState(() => {
    // Restore session from localStorage on hard refresh
    try {
      const saved = localStorage.getItem('crm_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isRegistering, setIsRegistering] = useState(false);

  const handleLogin = (u) => {
    setUser(u);
    localStorage.setItem('crm_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('crm_user');
  };

  if (!user) {
    if (isRegistering) {
      return <RegisterPage onRegister={handleLogin} onLoginClick={() => setIsRegistering(false)} />;
    }
    return <LoginPage onLogin={handleLogin} onRegisterClick={() => setIsRegistering(true)} />;
  }
  if (user.role?.toLowerCase() === "admin") {
    return (
      <PermissionProvider userRole={user.role}>
        <DashboardLayout user={user} onLogout={handleLogout} renderOverview={(setActiveTab, handleTaskClick) => <AdminDashboard user={user} onLogout={handleLogout} setActiveTab={setActiveTab} handleTaskClick={handleTaskClick} />} />
      </PermissionProvider>
    );
  }
  return (
    <PermissionProvider userRole={user.role}>
      <DashboardLayout user={user} onLogout={handleLogout} renderOverview={(setActiveTab, handleTaskClick) => <EmployeeDashboard user={user} onLogout={handleLogout} setActiveTab={setActiveTab} handleTaskClick={handleTaskClick} />} />
    </PermissionProvider>
  );
}

