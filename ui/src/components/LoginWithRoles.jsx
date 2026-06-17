import { useState, useEffect } from "react";
import "./LoginWithRoles.css";
import DashboardLayout from "./DashboardLayout";
import { api } from "../api/client";
import { PermissionProvider, usePermissions } from "../hooks/usePermissions";


// ── Mock Users Database Removed ──────────────────────────────

const PasswordToggleIcon = ({ show }) => {
  if (show) {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
};




// ══════════════════════════════════════════════════════════
//  LOGIN PAGE
// ══════════════════════════════════════════════════════════
function LoginPage({ onLogin, onRegisterClick, onForgotPasswordClick }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, []);

  const handleLogin = async () => {
    setError("");
    if (!email || !password) { setError("Please enter email and password."); return; }
    setLoading(true);
    try {
      const user = await api.post('/login', { email, password });
      onLogin(user);
    } catch (err) {
      setError(err.message || "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
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
          <img src="/spagylo-logo.png" alt="Spagylo CRM Logo" style={{ width: '2.75rem', height: 'auto', objectFit: 'contain' }} />
          <div>
            <div className="logo-text">Spagylo CRM</div>
          </div>
        </div>



        <div className="login-footer">© 2026 Spagylo CRM · All rights reserved</div>
      </div>

      {/* Right panel — login form */}
      <div className="login-right-panel">
        <div className="mobile-logo">
          <img src="/spagylo-logo.png" alt="Spagylo CRM Logo" style={{ width: '2.25rem', height: 'auto', objectFit: 'contain' }} />
          <div className="logo-text logo-text-lg">Spagylo CRM</div>
        </div>

        <div className="login-form-container">
          <h1 className="login-heading">Welcome</h1>
          <p className="login-subheading">Sign in to your account to continue</p>

          {error && (
            <div className="error-message">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={e => { e.preventDefault(); handleLogin(); }} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
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
                  placeholder="Enter your password"
                  className="input-field input-field-pwd"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="pwd-toggle-btn"
                >
                  <PasswordToggleIcon show={showPwd} />
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.35rem' }}>
                <button type="button" onClick={onForgotPasswordClick} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.8rem', cursor: 'pointer', padding: 0, fontWeight: 500 }}>Forgot password?</button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? (
                <><span className="spinner"></span> Signing in...</>
              ) : (
                <><span></span> Sign In</>
              )}
            </button>
          </form>

          <div className="auth-switch-prompt">
            <span className="auth-switch-text">Don't have an account? </span>
            <button className="auth-switch-btn" onClick={onRegisterClick}>Register now</button>
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
  const [successMessage, setSuccessMessage] = useState("");

  const handleRegister = async () => {
    setError("");
    if (!name || !email || !password) { setError("Please fill all fields."); return; }
    setLoading(true);
    try {
      await api.post('/users', {
        firstName: name.split(' ')[0],
        lastName: name.split(' ').slice(1).join(' '),
        email,
        password,
        role: 'Employee',
        status: 'Pending',
        empId: `EMP-${Math.floor(1000 + Math.random() * 9000)}`
      });
      setSuccessMessage("Your registration request was submitted successfully! It is currently pending admin approval. You can sign in once approved.");
    } catch (err) {
      setError(err.message || "Registration failed. Email might already be in use.");
    } finally {
      setLoading(false);
    }
  };

  if (successMessage) {
    return (
      <div className="login-container app-container">
        {/* Left panel */}
        <div className="login-left-panel">
          <div className="login-bg-gradient" />
          <div className="login-bg-pattern" />
          <div className="login-bg-glow-1" />
          <div className="login-bg-glow-2" />

          <div className="logo-container">
            <img src="/spagylo-logo.png" alt="Spagylo CRM Logo" style={{ width: '2.75rem', height: 'auto', objectFit: 'contain' }} />
            <div>
              <div className="logo-text">Spagylo CRM</div>
            </div>
          </div>

          <div className="login-footer">© 2026 Spagylo CRM · All rights reserved</div>
        </div>

        {/* Right panel */}
        <div className="login-right-panel">
          <div className="login-form-container" style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', background: '#dcfce7', color: '#16a34a', borderRadius: '50%', marginBottom: '1.5rem', fontSize: '1.75rem', fontWeight: 'bold' }}>✓</div>
            <h1 className="login-heading" style={{ fontSize: '1.75rem', color: '#16a34a', marginBottom: '0.75rem' }}>Registration Successful</h1>
            <p className="login-subheading" style={{ color: '#475569', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '2rem', padding: '0 0.5rem' }}>
              {successMessage}
            </p>
            <button className="btn-primary" onClick={onLoginClick}>Back to Sign In</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container app-container">
      {/* Left panel */}
      <div className="login-left-panel">
        <div className="login-bg-gradient" />
        <div className="login-bg-pattern" />
        <div className="login-bg-glow-1" />
        <div className="login-bg-glow-2" />

        <div className="logo-container">
          <img src="/spagylo-logo.png" alt="Spagylo CRM Logo" style={{ width: '2.75rem', height: 'auto', objectFit: 'contain' }} />
          <div>
            <div className="logo-text">Spagylo CRM</div>
          </div>
        </div>

        <div className="login-footer">© 2026 Spagylo CRM · All rights reserved</div>
      </div>

      {/* Right panel */}
      <div className="login-right-panel">
        <div className="mobile-logo">
          <img src="/spagylo-logo.png" alt="Spagylo CRM Logo" style={{ width: '2.25rem', height: 'auto', objectFit: 'contain' }} />
          <div className="logo-text logo-text-lg">Spagylo CRM</div>
        </div>

        <div className="login-form-container">
          <h1 className="login-heading">Create an account</h1>
          <p className="login-subheading">Sign up to get started</p>

          {error && (
            <div className="error-message">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={e => { e.preventDefault(); handleRegister(); }} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
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
                  placeholder="Create a password"
                  className="input-field input-field-pwd"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="pwd-toggle-btn"
                >
                  <PasswordToggleIcon show={showPwd} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? (
                <><span className="spinner"></span> Registering...</>
              ) : (
                <>Sign Up</>
              )}
            </button>
          </form>

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
//  FORGOT PASSWORD PAGE
// ══════════════════════════════════════════════════════════
function ForgotPasswordPage({ onBackToLogin }) {
  const [step, setStep] = useState(1); // 1: Enter Email/Send OTP, 2: Enter OTP/Verify, 3: Enter New Password/Reset
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleRequestOtp = async () => {
    setError("");
    setMessage("");
    if (!email) { setError("Please enter your email address."); return; }
    setLoading(true);
    try {
      const res = await api.post('/forgot-password/request-otp', { email });
      setMessage(res.message || "OTP sent successfully.");
      setStep(2);
    } catch (err) {
      setError(err.error || err.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    setMessage("");
    if (!otp) { setError("Please enter the OTP verification code."); return; }
    setLoading(true);
    try {
      const res = await api.post('/forgot-password/verify-otp', { email, otp });
      setMessage(res.message || "OTP verified successfully.");
      setStep(3);
    } catch (err) {
      setError(err.error || err.message || "Invalid or expired OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    setMessage("");
    if (!newPassword || !confirmPassword) { setError("Please fill all fields."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const res = await api.post('/forgot-password/reset-password', { email, newPassword, confirmPassword });
      setMessage(res.message || "Password has been successfully reset.");
      setTimeout(() => {
        onBackToLogin();
      }, 2000);
    } catch (err) {
      setError(err.error || err.message || "Failed to reset password. Please try again.");
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
          <img src="/spagylo-logo.png" alt="Spagylo CRM Logo" style={{ width: '2.75rem', height: 'auto', objectFit: 'contain' }} />
          <div>
            <div className="logo-text">Spagylo CRM</div>
          </div>
        </div>

        <div className="login-footer">© 2026 Spagylo CRM · All rights reserved</div>
      </div>

      {/* Right panel */}
      <div className="login-right-panel">
        <div className="mobile-logo">
          <img src="/spagylo-logo.png" alt="Spagylo CRM Logo" style={{ width: '2.25rem', height: 'auto', objectFit: 'contain' }} />
          <div className="logo-text logo-text-lg">Spagylo CRM</div>
        </div>

        <div className="login-form-container">
          <h1 className="login-heading">Reset Password</h1>
          <p className="login-subheading">
            {step === 1 && "Enter your email address to receive an OTP code"}
            {step === 2 && "Enter the 6-digit OTP code sent to your email"}
            {step === 3 && "Create a secure new password for your account"}
          </p>

          {error && (
            <div className="error-message">
              <span>⚠️</span> {error}
            </div>
          )}

          {message && (
            <div style={{ padding: '0.75rem', background: '#dcfce7', color: '#166534', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>✅</span> {message}
            </div>
          )}

          {step === 1 && (
            <>
              <div className="input-group">
                <label className="input-label">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleRequestOtp()}
                  placeholder="you@officecrm.in"
                  className="input-field"
                />
              </div>

              <button
                onClick={handleRequestOtp}
                disabled={loading}
                className="btn-primary"
                style={{ marginTop: '1rem' }}
              >
                {loading ? (
                  <><span className="spinner"></span> Sending OTP...</>
                ) : (
                  <>Send Verification Code</>
                )}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                <label className="input-label">Email Address</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="input-field"
                    style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed', flex: 1 }}
                  />
                  <button
                    onClick={() => { setStep(1); setError(""); setMessage(""); }}
                    style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Change
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Enter OTP Code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === "Enter" && handleVerifyOtp()}
                  placeholder="123456"
                  className="input-field"
                  style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.25rem', fontWeight: 'bold' }}
                />
              </div>

              <button
                onClick={handleVerifyOtp}
                disabled={loading}
                className="btn-primary"
                style={{ marginTop: '1rem' }}
              >
                {loading ? (
                  <><span className="spinner"></span> Verifying...</>
                ) : (
                  <>Verify Code</>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button
                  onClick={handleRequestOtp}
                  disabled={loading}
                  style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Resend Verification Code
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="input-group">
                <label className="input-label">New Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="input-field"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="pwd-toggle-btn"
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <PasswordToggleIcon show={showPwd} />
                  </button>
                </div>
              </div>

              <div className="input-group" style={{ marginTop: '1rem' }}>
                <label className="input-label">Confirm New Password</label>
                <input
                  type={showPwd ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleResetPassword()}
                  placeholder="Confirm new password"
                  className="input-field"
                />
              </div>

              <button
                onClick={handleResetPassword}
                disabled={loading}
                className="btn-primary"
                style={{ marginTop: '1.5rem' }}
              >
                {loading ? (
                  <><span className="spinner"></span> Resetting...</>
                ) : (
                  <>Reset Password</>
                )}
              </button>
            </>
          )}

          <div className="auth-switch-prompt" style={{ marginTop: '1.5rem' }}>
            <span className="auth-switch-text">Remember your password? </span>
            <button className="auth-switch-btn" onClick={onBackToLogin}>Back to login</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  MOBILE HOME DASHBOARD (ClickUp-style)
// ══════════════════════════════════════════════════════════
function MobileHomeDashboard({ user, todayCount, overdueCount, myTasksCount, priorityCount, upcomingCount, setActiveTab }) {
  const [taskLists, setTaskLists] = useState([]);
  const [listTaskCounts, setListTaskCounts] = useState({});
  const [allTasks, setAllTasks] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/task-lists').catch(() => []),
      api.get('/tasks').catch(() => []),
      api.get('/projects').catch(() => []),
      api.get('/clients').catch(() => []),
      api.get('/users').catch(() => [])
    ]).then(([lists, tasks, projects, clients, users]) => {
      setTaskLists(lists || []);
      setAllTasks(tasks || []);
      setAllProjects(projects || []);
      setAllClients(clients || []);
      setAllUsers(users || []);
      const counts = {};
      (tasks || []).forEach(t => {
        if (t.taskListId) counts[t.taskListId] = (counts[t.taskListId] || 0) + 1;
      });
      setListTaskCounts(counts);
    });
  }, []);

  const q = searchQuery.trim().toLowerCase();

  const searchResults = q ? [
    ...allTasks
      .filter(t => (t.title || '').toLowerCase().includes(q) || (t.taskNo || '').toLowerCase().includes(q))
      .slice(0, 4)
      .map(t => ({
        type: 'task', tab: 'tasks', id: t.id,
        title: t.title,
        sub: `${t.status || 'Task'} · ${t.priority || ''}`,
        badge: 'Task', badgeColor: '#2563eb', badgeBg: '#eff6ff',
        icon: (
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#2563eb" strokeWidth="2">
            <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
        )
      })),
    ...allProjects
      .filter(p => (p.name || '').toLowerCase().includes(q))
      .slice(0, 3)
      .map(p => ({
        type: 'project', tab: 'projects', id: p.id,
        title: p.name,
        sub: `Project · ${p.status || 'Active'}`,
        badge: 'Project', badgeColor: '#7c3aed', badgeBg: '#f5f3ff',
        icon: (
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#7c3aed" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        )
      })),
    ...allClients
      .filter(c => (c.name || c.companyName || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q))
      .slice(0, 3)
      .map(c => ({
        type: 'client', tab: 'clients', id: c.id,
        title: c.name || c.companyName || c.email,
        sub: `Client · ${c.email || ''}`,
        badge: 'Client', badgeColor: '#0d9488', badgeBg: '#f0fdfa',
        icon: (
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#0d9488" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        )
      })),
    ...allUsers
      .filter(u => (u.fullName || `${u.firstName || ''} ${u.lastName || ''}`).toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
      .slice(0, 2)
      .map(u => ({
        type: 'user', tab: 'users', id: u.id,
        title: u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
        sub: `${u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : 'User'} · ${u.email || ''}`,
        badge: 'User', badgeColor: '#ea580c', badgeBg: '#fff7ed',
        icon: (
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#ea580c" strokeWidth="2">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        )
      })),
  ] : [];

  const statCards = [
    {
      label: 'Today', count: todayCount, iconBg: '#7c3aed',
      icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    },
    {
      label: 'Overdue', count: overdueCount, iconBg: '#ef4444', warn: overdueCount > 0,
      icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
    },
    {
      label: 'My Priorities', count: priorityCount, iconBg: '#f97316',
      icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
    },
    {
      label: 'Upcoming', count: upcomingCount, iconBg: '#f59e0b',
      icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
    },
    {
      label: 'My Tasks', count: myTasksCount, iconBg: '#2563eb',
      icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
    },
    {
      label: 'Reminders', count: 0, iconBg: '#0d9488',
      icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 16 14"/></svg>
    },
    {
      label: 'Comments', count: 0, iconBg: '#16a34a',
      icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    },
  ];

  return (
    <div className="mhd-wrap">
      {/* Search bar */}
      <div className="mhd-search" style={{ position: 'relative' }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#94a3b8" strokeWidth="2.5" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          className="mhd-search-input"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
          onFocus={() => setShowSearchResults(true)}
          onBlur={() => setTimeout(() => setShowSearchResults(false), 250)}
          placeholder="Search tasks, projects, clients..."
        />
        {showSearchResults && searchQuery.trim() && (
          <div className="mhd-search-results">
            {searchResults.length === 0 ? (
              <div className="mhd-search-no-result">No results for "{searchQuery}"</div>
            ) : (
              searchResults.map((r, i) => (
                <div
                  key={`${r.type}-${r.id}-${i}`}
                  className="mhd-search-result-item"
                  onMouseDown={() => {
                    setSearchQuery('');
                    setShowSearchResults(false);
                    setActiveTab && setActiveTab(r.tab);
                  }}
                >
                  <span className="mhd-search-result-icon" style={{ background: r.badgeBg }}>
                    {r.icon}
                  </span>
                  <div className="mhd-search-result-content">
                    <div className="mhd-search-result-title">{r.title}</div>
                    <div className="mhd-search-result-sub">{r.sub}</div>
                  </div>
                  <span className="mhd-search-result-badge" style={{ color: r.badgeColor, background: r.badgeBg }}>
                    {r.badge}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Stats cards grid */}
      <div className="mhd-stats-grid">
        {statCards.map((card, i) => (
          <button key={i} className={`mhd-stat-card${card.label === 'Reminders' ? ' mhd-stat-card--reminders' : ''}`} onClick={() => setActiveTab && setActiveTab('tasks')}>
            <div className="mhd-stat-card-hdr">
              <div className="mhd-stat-icon" style={{ background: card.iconBg }}>{card.icon}</div>
              <span className={`mhd-stat-count${card.warn ? ' mhd-warn' : ''}`}>{card.count}</span>
            </div>
            <span className={`mhd-stat-label${card.warn ? ' mhd-warn' : ''}`}>{card.label}</span>
          </button>
        ))}
      </div>

      {/* My Lists section */}
      <div className="mhd-lists-section">
        <div className="mhd-lists-hdr">
          <span className="mhd-lists-title">My Lists</span>
          <button className="mhd-lists-add-btn" onClick={() => setActiveTab && setActiveTab('tasks')}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
        {taskLists.length === 0 ? (
          <p className="mhd-lists-empty">No lists yet</p>
        ) : (
          taskLists.map(list => (
            <button key={list.id} className="mhd-list-row" onClick={() => setActiveTab && setActiveTab('tasks')}>
              <div className="mhd-list-icon-wrap">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </div>
              <span className="mhd-list-name">{list.name}</span>
              <span className="mhd-list-count">{listTaskCounts[list.id] || 0}</span>
            </button>
          ))
        )}
      </div>

      {/* What's next CTA */}
      <button className="mhd-whats-next-btn" onClick={() => setActiveTab && setActiveTab('tasks')}>
        <svg viewBox="0 0 24 24" width="20" height="20">
          <defs>
            <linearGradient id="wnGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6366f1"/>
              <stop offset="50%" stopColor="#ec4899"/>
              <stop offset="100%" stopColor="#f97316"/>
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="10" fill="url(#wnGrad)"/>
          <path d="M8 12h8M12 8l4 4-4 4" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        What's next?
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  ADMIN DASHBOARD
// ══════════════════════════════════════════════════════════

function AdminDashboard({ user, onLogout, setActiveTab, handleTaskClick }) {
  const [tasks, setTasks] = useState({ today: [], upcoming: [], backlog: [] });
  const [projects, setProjects] = useState([]);


  useEffect(() => {
    const fetchData = async () => {
      try {
        const [allTasksRaw, projectsData] = await Promise.all([
          api.get('/tasks'),
          api.get('/projects').catch(() => [])
        ]);
        const allTasks = allTasksRaw || [];
        setProjects(projectsData || []);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();
        const todayTasks = [];
        const upcomingTasks = [];
        const backlogTasks = [];

        allTasks.forEach(task => {
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
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: type === 'backlog' ? '#ef4444' : '#1e293b' }}>{t.title}</span>
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





  // Derived counts for card grid
  const _now = new Date(); _now.setHours(0, 0, 0, 0);
  const _all = [...tasks.today, ...tasks.upcoming, ...tasks.backlog];
  const _overdue = _all.filter(t => { if (!t.dueDate) return false; const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0); return d < _now; }).length;
  const _prio = _all.filter(t => t.priority === 'High' || t.priority === 'Critical').length;

  // eslint-disable-next-line no-unused-vars
  const _cards = [
    {
      label: 'Today',
      count: tasks.today.length,
      bg: 'linear-gradient(135deg,#7c3aed,#6366f1)',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      )
    },
    {
      label: 'Overdue',
      count: _overdue,
      bg: 'linear-gradient(135deg,#ef4444,#f97316)',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      ),
      warn: true
    },
    {
      label: 'My Priorities',
      count: _prio,
      bg: 'linear-gradient(135deg,#f97316,#fb923c)',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
          <line x1="4" y1="22" x2="4" y2="15"></line>
        </svg>
      )
    },
    {
      label: 'Upcoming',
      count: tasks.upcoming.length,
      bg: 'linear-gradient(135deg,#f59e0b,#fbbf24)',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      )
    },
    {
      label: 'My Tasks',
      count: _all.length,
      bg: 'linear-gradient(135deg,#2563eb,#60a5fa)',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="9 11 12 14 22 4"></polyline>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
      )
    },
    {
      label: 'Backlog',
      count: tasks.backlog.length,
      bg: 'linear-gradient(135deg,#0d9488,#14b8a6)',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      )
    },
  ];

  // eslint-disable-next-line no-unused-vars
  const recents = [
    ..._all.map(t => ({ type: 'task', id: t.id, name: t.title, date: t.createdAt || '' })),
    ...projects.map(p => ({ type: 'project', id: p.id, name: p.name, date: p.createdAt || '' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);

  return (
    <div className="db-overview-page">
      {/* ── Mobile Home (ClickUp-style) ── */}
      <MobileHomeDashboard
        user={user}
        todayCount={tasks.today.length}
        overdueCount={_overdue}
        myTasksCount={_all.length}
        priorityCount={_prio}
        upcomingCount={tasks.upcoming.length}
        setActiveTab={setActiveTab}
      />

      {/* ── Desktop panel layout ── */}
      <div className="db-desktop-panels" style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem', marginTop: '1rem' }}>
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
            if (user.id && assignee === user.id.toLowerCase().trim()) return true;
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
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: type === 'backlog' ? '#ef4444' : '#1e293b' }}>{t.title}</span>
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

  // Employee derived counts
  const _enow = new Date(); _enow.setHours(0, 0, 0, 0);
  const _eall = [...tasks.today, ...tasks.upcoming, ...tasks.backlog];
  const _eovd = _eall.filter(t => { if (!t.dueDate) return false; const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0); return d < _enow; }).length;
  const _eprio = _eall.filter(t => t.priority === 'High' || t.priority === 'Critical').length;

  // eslint-disable-next-line no-unused-vars
  const _ecards = [
    {
      label: 'Today',
      count: tasks.today.length,
      bg: 'linear-gradient(135deg,#7c3aed,#6366f1)',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      )
    },
    {
      label: 'Overdue',
      count: _eovd,
      bg: 'linear-gradient(135deg,#ef4444,#f97316)',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      ),
      warn: true
    },
    {
      label: 'My Priorities',
      count: _eprio,
      bg: 'linear-gradient(135deg,#f97316,#fb923c)',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
          <line x1="4" y1="22" x2="4" y2="15"></line>
        </svg>
      )
    },
    {
      label: 'Upcoming',
      count: tasks.upcoming.length,
      bg: 'linear-gradient(135deg,#f59e0b,#fbbf24)',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      )
    },
    {
      label: 'My Tasks',
      count: _eall.length,
      bg: 'linear-gradient(135deg,#2563eb,#60a5fa)',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="9 11 12 14 22 4"></polyline>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
      )
    },
    {
      label: 'Backlog',
      count: tasks.backlog.length,
      bg: 'linear-gradient(135deg,#0d9488,#14b8a6)',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      )
    },
  ];

  // eslint-disable-next-line no-unused-vars
  const recents = _eall
    .map(t => ({ type: 'task', id: t.id, name: t.title, date: t.createdAt || '' }))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 15);

  return (
    <div className="db-overview-page">
      {/* ── Mobile Home (ClickUp-style) ── */}
      <MobileHomeDashboard
        user={user}
        todayCount={tasks.today.length}
        overdueCount={_eovd}
        myTasksCount={_eall.length}
        priorityCount={_eprio}
        upcomingCount={tasks.upcoming.length}
        setActiveTab={setActiveTab}
      />

      {/* ── Desktop panel layout ── */}
      <div className="db-desktop-panels" style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
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
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  ROOT — ENTRY POINT
// ══════════════════════════════════════════════════════════
function LoginSuccessToast({ user: u, onClose }) {
  const name = u?.fullName || `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || u?.email || 'User';
  const role = u?.role ? (u.role.charAt(0).toUpperCase() + u.role.slice(1)) : 'User';
  const isAdmin = u?.role?.toLowerCase() === 'admin';

  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="login-toast-overlay" onClick={onClose}>
      <div className="login-toast-card" onClick={e => e.stopPropagation()}>
        <div className="login-toast-icon-wrap">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" fill="#22c55e" stroke="#22c55e"/>
            <polyline points="9 12 11.5 14.5 16 9.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="login-toast-title">Login Successfully!</div>
        <div className="login-toast-name">Welcome back, <strong>{name}</strong></div>
        <div className={`login-toast-role-pill ${isAdmin ? 'login-toast-role-admin' : 'login-toast-role-user'}`}>
          {isAdmin ? (
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          )}
          {role}
        </div>
        <div className="login-toast-bar">
          <div className="login-toast-bar-fill" />
        </div>
      </div>
    </div>
  );
}

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
  const [isForgotPwd, setIsForgotPwd] = useState(false);
  const [loginToast, setLoginToast] = useState(null);



  const handleLogin = (u) => {
    setUser(u);
    localStorage.setItem('crm_user', JSON.stringify(u));
    setLoginToast(u);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('crm_user');
    window.history.pushState(null, '', '/');
  };

  if (!user) {
    if (isRegistering) {
      return <RegisterPage onRegister={handleLogin} onLoginClick={() => setIsRegistering(false)} />;
    }
    if (isForgotPwd) {
      return <ForgotPasswordPage onBackToLogin={() => setIsForgotPwd(false)} />;
    }
    return <LoginPage onLogin={handleLogin} onRegisterClick={() => setIsRegistering(true)} onForgotPasswordClick={() => setIsForgotPwd(true)} />;
  }

  return (
    <>
      <PermissionProvider userRole={user.role}>
        <DashboardContainer user={user} onLogout={handleLogout} />
      </PermissionProvider>
      {loginToast && <LoginSuccessToast user={loginToast} onClose={() => setLoginToast(null)} />}
    </>
  );
}

function DashboardContainer({ user, onLogout }) {
  const { getLevel } = usePermissions();
  const dashboardView = getLevel('dashboard', 'view');

  const renderOverview = (setActiveTab, handleTaskClick) => {
    if (dashboardView === 'None' && user.role?.toLowerCase() !== 'admin') {
      return (
        <div className="db-overview-page" style={{ padding: '2rem 3rem' }}>
          <h3>Access Denied</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>You do not have permission to view the dashboard overview.</p>
        </div>
      );
    }
    if (dashboardView === 'All' || user.role?.toLowerCase() === 'admin') {
      return <AdminDashboard user={user} onLogout={onLogout} setActiveTab={setActiveTab} handleTaskClick={handleTaskClick} />;
    }
    return <EmployeeDashboard user={user} onLogout={onLogout} setActiveTab={setActiveTab} handleTaskClick={handleTaskClick} />;
  };

  return (
    <DashboardLayout 
      user={user} 
      onLogout={onLogout} 
      renderOverview={renderOverview} 
    />
  );
}

