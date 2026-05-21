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


// ── Icons ──────────────────────────────────────────────────
const Icons = {
  Users: <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
  CheckCircle: <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
  UserPlus: <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>,
  CalendarOff: <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>,
  Plus: <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  FileText: <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  BarChart: <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>,
  ShieldCheck: <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>,
  CalendarCheck: <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M9 16l2 2 4-4"></path></svg>,
  Coffee: <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>,
  Edit: <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  Clock: <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
};

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
function AdminDashboard({ user, onLogout, setActiveTab }) {
  const [stats, setStats] = useState({ totalEmployees: 0, activeThisMonth: 0, newJoiners: 0, onLeaveToday: 0 });
  const [recentEmps, setRecentEmps] = useState([]);
  const [depts, setDepts] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [employeesData, leavesData] = await Promise.all([
          api.get('/employees').catch(() => []),
          api.get('/leaves').catch(() => [])
        ]);

        const employees = Array.isArray(employeesData) ? employeesData : [];
        const leaves = Array.isArray(leavesData) ? leavesData : [];

        const total = employees.length;
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        let newJoinersCount = 0;
        let activeCount = 0;
        const deptCounts = {};

        employees.forEach(emp => {
          if ((emp.status || 'Active') === 'Active') activeCount++;

          if (emp.joinedDate || emp.createdAt) {
            const d = new Date(emp.joinedDate || emp.createdAt);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
              newJoinersCount++;
            }
          }

          const dpt = emp.dept || 'Others';
          deptCounts[dpt] = (deptCounts[dpt] || 0) + 1;
        });

        // Compute On Leave Today (Basic approximation based on Approved leaves that overlap today)
        const todayStr = new Date().toISOString().split('T')[0];
        let onLeaveCount = 0;
        leaves.forEach(l => {
          if (l.status === 'Approved' && l.dates) {
            if (l.dates.includes(todayStr) || l.dates.includes(new Date().toLocaleDateString('en-GB'))) {
              onLeaveCount++;
            }
          }
        });

        setStats({
          totalEmployees: total,
          activeThisMonth: activeCount,
          newJoiners: newJoinersCount,
          onLeaveToday: onLeaveCount
        });

        // Recent emps
        const sorted = [...employees].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
        setRecentEmps(sorted.map(e => ({
          name: e.name || `${e.firstName || ''} ${e.lastName || ''}`.trim(),
          role: e.designation || e.role || 'Employee',
          dept: e.dept || 'Others',
          joined: (e.joinedDate || e.createdAt) ? new Date(e.joinedDate || e.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
          status: e.status || 'Active',
          av: (e.name || e.firstName || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
        })));

        // Depts
        const colors = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-rose-500", "bg-amber-500", "bg-slate-400"];
        const deptArr = Object.entries(deptCounts).map(([name, count], i) => ({
          name,
          count,
          pct: Math.round((count / (total || 1)) * 100),
          color: colors[i % colors.length]
        })).sort((a, b) => b.count - a.count);

        setDepts(deptArr);

      } catch (err) {
        console.error("Dashboard data fetch error:", err);
      }
    };
    fetchData();
  }, []);

  const adminStatsDisplay = [
    { label: "Total Employees", value: stats.totalEmployees, change: "", up: true, icon: Icons.Users, grad: "from-blue-600 to-blue-400" },
    { label: "Active This Month", value: stats.activeThisMonth, change: "", up: true, icon: Icons.CheckCircle, grad: "from-emerald-600 to-emerald-400" },
    { label: "New Joiners", value: stats.newJoiners, change: "", up: true, icon: Icons.UserPlus, grad: "from-violet-600 to-violet-400" },
    { label: "On Leave Today", value: stats.onLeaveToday, change: "", up: false, icon: Icons.CalendarOff, grad: "from-amber-500 to-amber-400" },
  ];

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
        {/* Welcome */}
        <div className="welcome-banner">
          <div>
            <div className="welcome-sub">Welcome back,</div>
            <h1 className="welcome-title">{user.fullName || user.firstName} </h1>
            <p className="welcome-desc">
              <span className="role-tag-badge">{(user.role || 'Admin').toUpperCase()}</span> · {user.dept || 'Administration'} · {user.title || 'Administrator'}
            </p>
          </div>

          <Avatar
            initials={user.firstName?.charAt(0) || user.fullName?.charAt(0) || "U"}
            image={user.profileImage}
            size="lg"
            ring
          />

        </div>

        {/* Stats */}
        <div className="stats-grid">
          {adminStatsDisplay.map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-header">
                <div className="stat-icon" style={{ background: s.grad.includes('blue') ? 'linear-gradient(to bottom right, #2563eb, #60a5fa)' : s.grad.includes('emerald') ? 'linear-gradient(to bottom right, #059669, #34d399)' : s.grad.includes('violet') ? 'linear-gradient(to bottom right, #7c3aed, #a78bfa)' : 'linear-gradient(to bottom right, #f59e0b, #fbbf24)' }}>{s.icon}</div>
                <span className={`stat-change ${s.up ? "stat-change-up" : "stat-change-down"}`}>{s.change}</span>
              </div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Table + Depts */}
        <div className="content-grid">
          {/* Recent Employees */}
          <div className="panel-card panel-card-col-3">
            <div className="panel-header">
              <h2 className="panel-title">Recent Employees</h2>
              <button className="panel-link" onClick={() => setActiveTab('employees')}>View All →</button>
            </div>
            <div className="list-group">
              {recentEmps.length === 0 ? (
                <p style={{ color: '#94a3b8', padding: '1rem' }}>No employees found.</p>
              ) : (
                recentEmps.map((e, i) => (
                  <div key={i} className="list-item">
                    <Avatar initials={e.av} size="sm" />
                    <div className="list-item-info">
                      <div className="list-item-title">{e.name}</div>
                      <div className="list-item-sub">{e.role}</div>
                    </div>
                    <div className="list-item-date">{e.joined}</div>
                    <span className={`status-badge ${e.status === "Active" ? "status-badge-active" : "status-badge-leave"}`}>
                      {e.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Dept breakdown */}
          <div className="panel-card panel-card-col-2">
            <h2 className="panel-title" style={{ marginBottom: "1rem" }}>Department Breakdown</h2>
            <div className="dept-list">
              {depts.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>No data available.</p>
              ) : (
                depts.map((d, i) => (
                  <div key={i}>
                    <div className="dept-header">
                      <span className="dept-name">{d.name}</span>
                      <span className="dept-stats">{d.count} · {d.pct}%</span>
                    </div>
                    <div className="progress-bg">
                      <div className={`progress-bar ${d.color}`} style={{ width: `${d.pct}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions-panel">
          <h2 className="panel-title" style={{ marginBottom: "1rem" }}>Admin Quick Actions</h2>
          <div className="quick-actions-grid">
            {[
              { icon: Icons.Plus, label: "Add Employee", color: "action-blue", tab: "employees" },
              { icon: Icons.FileText, label: "Leave Requests", color: "action-amber", tab: "leave" },
              { icon: Icons.BarChart, label: "Reports", color: "action-violet", tab: "reports" },
              { icon: Icons.ShieldCheck, label: "KYC Review", color: "action-rose", tab: "users" },
            ].map((a, i) => (
              <button key={i} className={`action-btn ${a.color}`} onClick={() => setActiveTab(a.tab)}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{a.icon}</span> {a.label}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  EMPLOYEE DASHBOARD
// ══════════════════════════════════════════════════════════
function EmployeeDashboard({ user, onLogout, setActiveTab }) {
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [leaveBalance, setLeaveBalance] = useState(15);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const userName = (user.fullName || user.firstName || '').trim().toLowerCase();

        // 1. Fetch Attendance
        const allAttendance = await api.get('/attendance');
        const myAttendanceCount = (allAttendance || []).filter(a => a.name?.trim().toLowerCase() === userName).length;
        setAttendanceCount(myAttendanceCount);

        // 2. Fetch Leaves
        const allLeaves = await api.get('/leaves');
        const myLeaves = (allLeaves || []).filter(l => l.name?.trim().toLowerCase() === userName);
        setRecentLeaves(myLeaves.slice(0, 5));

        const myApprovedLeaves = myLeaves.filter(l => l.status === 'Approved');
        const usedDays = myApprovedLeaves.reduce((sum, l) => sum + (l.days || 0), 0);
        setLeaveBalance(15 - usedDays);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };
    fetchData();
  }, [user]);

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
        {/* Welcome Banner */}
        <div className="welcome-banner welcome-banner-emp">
          <div>
            <div className="welcome-sub welcome-sub-emp">Welcome back,</div>
            <h1 className="welcome-title">{user.fullName || user.firstName} </h1>
            <p className="welcome-desc welcome-desc-emp">
              <span className="role-tag-badge">{(user.role || 'Employee').toUpperCase()}</span> · {user.title || user.designation} · {user.dept || 'Engineering'}
            </p>
          </div>

          <Avatar
            initials={user.firstName?.charAt(0) || user.fullName?.charAt(0) || "U"}
            image={user.profileImage}
            size="lg"
            ring
          />

        </div>

        {/* Info row */}
        <div className="emp-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="emp-content">
            {/* Stats */}
            <div className="emp-stats-grid">
              {[
                { label: "Days Present", value: attendanceCount, icon: Icons.CalendarCheck, color: "icon-blue" },
                { label: "Leave Balance", value: leaveBalance, icon: Icons.Coffee, color: "icon-amber" },
              ].map((s, i) => (
                <div key={i} className="emp-stat-card">
                  <div className={`emp-stat-icon ${s.color}`}>{s.icon}</div>
                  <div className="emp-stat-value">{s.value}</div>
                  <div className="emp-stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* My Leaves */}
            <div className="tasks-panel" style={{ marginTop: '1.5rem' }}>
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 className="tasks-title" style={{ margin: 0 }}>Recent Leave History</h3>
                <button className="saas-btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setActiveTab('leave')}>View All</button>
              </div>
              <div className="tasks-list">
                {recentLeaves.length === 0 ? (
                  <p style={{ color: '#94a3b8', padding: '1rem' }}>No leave history found.</p>
                ) : (
                  recentLeaves.map((l) => (
                    <div key={l.id} className="task-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{l.type}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{l.dates} · {l.days} Days</div>
                      </div>
                      <span className={`badge ${l.status === 'Approved' ? 'badge-green' : l.status === 'Rejected' ? 'badge-red' : 'badge-yellow'}`} style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '12px', height: 'fit-content' }}>
                        {l.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick actions */}
            <div className="quick-actions-panel" style={{ marginTop: '1.5rem' }}>
              <h3 className="tasks-title">Self Service</h3>
              <div className="emp-actions-grid">
                <button className="action-btn action-btn-sm action-amber" onClick={() => setActiveTab('leave')}>
                  <span style={{ display: 'flex', alignItems: 'center' }}>{Icons.Edit}</span> Apply for Leave
                </button>
                <button className="action-btn action-btn-sm action-blue" onClick={() => setActiveTab('attendance')}>
                  <span style={{ display: 'flex', alignItems: 'center' }}>{Icons.Clock}</span> My Attendance
                </button>
              </div>
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
        <DashboardLayout user={user} onLogout={handleLogout} renderOverview={(setActiveTab) => <AdminDashboard user={user} onLogout={handleLogout} setActiveTab={setActiveTab} />} />
      </PermissionProvider>
    );
  }
  return (
    <PermissionProvider userRole={user.role}>
      <DashboardLayout user={user} onLogout={handleLogout} renderOverview={(setActiveTab) => <EmployeeDashboard user={user} onLogout={handleLogout} setActiveTab={setActiveTab} />} />
    </PermissionProvider>
  );
}

