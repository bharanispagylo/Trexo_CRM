import { useState } from "react";

const steps = [
  { id: 1, label: "Personal",   icon: "" },
  { id: 2, label: "Address",    icon: "" },
  { id: 3, label: "Education",  icon: "" },
  { id: 4, label: "Job History",icon: "" },
  { id: 5, label: "KYC & Health",icon: "" },
  { id: 6, label: "Security",   icon: "" },
];

const BLOOD_GROUPS = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"];
const KYC_TYPES    = ["Aadhaar Card", "PAN Card", "Passport", "Voter ID", "Driving License"];

const initialForm = {
  firstName: "", lastName: "", dob: "", gender: "", phone: "", email: "",
  bloodGroup: "",
  street: "", city: "", state: "", pincode: "", country: "",
  edu: [{ degree: "", institution: "", year: "", grade: "" }],
  jobs: [{ company: "", role: "", from: "", to: "", current: false, desc: "" }],
  kycType: "", kycNumber: "", kycFile: null,
  password: "", confirm: "",
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap');

  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

  :root {
    --bg: #f0f4ff ;
    --surface: #ffffff;
    --card: #f7f9ff;
    --accent: #2563eb;
    --accent2: #0ea5e9;
    --danger: #ef4444;
    --success: #10b981;
    --text: #0f172a;
    --muted: #64748b;
    --border: #e2e8f0;
    --border-focus: #2563eb;
    --shadow: 0 4px 24px rgba(37,99,235,0.10);
    --shadow-lg: 0 12px 48px rgba(37,99,235,0.15);
    --radius: 14px;
  }

  body {
    font-family: 'Outfit', sans-serif;
    background: var(--bg);
    min-height: 100vh;
    color: var(--text);
  }

  .er-root {
    min-height: 100vh;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 2rem 1rem 4rem;
    background:
      radial-gradient(ellipse 70% 50% at 20% 0%, rgba(37,99,235,0.08) 0%, transparent 60%),
      radial-gradient(ellipse 50% 40% at 80% 100%, rgba(14,165,233,0.07) 0%, transparent 60%),
      #f0f4ff;
  }

  .er-card {
    width: 100%;
    max-width: 780px;
    background: var(--surface);
    border-radius: 24px;
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }

  /* ── Header ── */
  .er-header {
    background: linear-gradient(135deg, #1d4ed8 0%, #0284c7 100%);
    padding: 2.2rem 2.5rem 1.8rem;
    position: relative;
    overflow: hidden;
  }
  .er-header::before {
    content:'';
    position:absolute;
    inset:0;
    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Ccircle cx='30' cy='30' r='20'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }
  .er-header h1 {
    font-size: 1.7rem;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.02em;
    position: relative;
  }
  .er-header p {
    color: rgba(255,255,255,0.7);
    font-size: 0.88rem;
    margin-top: 0.3rem;
    position: relative;
  }

  /* ── Stepper ── */
  .er-stepper {
    display: flex;
    overflow-x: auto;
    padding: 1.4rem 2rem;
    gap: 0;
    border-bottom: 1px solid var(--border);
    background: var(--card);
    scrollbar-width: none;
  }
  .er-stepper::-webkit-scrollbar { display:none; }

  .step-item {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
  }

  .step-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    cursor: default;
    flex-shrink: 0;
  }

  .step-circle {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    border: 2px solid var(--border);
    background: var(--surface);
    color: var(--muted);
    transition: all 0.3s;
  }
  .step-circle.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
    box-shadow: 0 0 0 4px rgba(37,99,235,0.15);
  }
  .step-circle.done {
    background: var(--success);
    border-color: var(--success);
    color: #fff;
  }

  .step-label {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }
  .step-label.active { color: var(--accent); }
  .step-label.done   { color: var(--success); }

  .step-line {
    flex: 1;
    height: 2px;
    background: var(--border);
    margin: 0 0.4rem;
    margin-bottom: 1.1rem;
    transition: background 0.3s;
  }
  .step-line.done { background: var(--success); }

  /* ── Body ── */
  .er-body {
    padding: 2rem 2.5rem 1.5rem;
  }

  .step-title {
    font-size: 1.15rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text);
  }

  /* ── Grid ── */
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.1rem;
  }
  .col-full { grid-column: 1 / -1; }

  /* ── Field ── */
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .field label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .field label .req { color: var(--danger); margin-left: 2px; }

  .field input,
  .field select,
  .field textarea {
    background: var(--card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    padding: 0.72rem 1rem;
    font-family: 'Outfit', sans-serif;
    font-size: 0.93rem;
    color: var(--text);
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    width: 100%;
  }
  .field input:focus,
  .field select:focus,
  .field textarea:focus {
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    background: #fff;
  }
  .field input.error,
  .field select.error { border-color: var(--danger); }
  .field .err-msg {
    font-size: 0.75rem;
    color: var(--danger);
    font-weight: 500;
  }
  .field textarea { resize: vertical; min-height: 80px; }

  .field input[type="file"] {
    padding: 0.5rem;
    cursor: pointer;
  }

  /* ── Password strength ── */
  .pwd-wrap { position: relative; }
  .pwd-wrap input { padding-right: 2.8rem; }
  .pwd-toggle {
    position: absolute;
    right: 0.9rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    color: var(--muted);
    padding: 0;
    line-height: 1;
  }
  .strength-bar {
    height: 4px;
    border-radius: 2px;
    margin-top: 0.4rem;
    background: var(--border);
    overflow: hidden;
  }
  .strength-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.4s, background 0.4s;
  }
  .strength-label {
    font-size: 0.72rem;
    font-family: 'Fira Code', monospace;
    margin-top: 0.25rem;
  }

  /* ── Repeatable rows ── */
  .repeat-block {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .repeat-row {
    background: var(--card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    padding: 1.2rem;
    position: relative;
    transition: border-color 0.2s;
  }
  .repeat-row:hover { border-color: rgba(37,99,235,0.3); }

  .row-num {
    font-size: 0.72rem;
    font-family: 'Fira Code', monospace;
    color: var(--accent);
    font-weight: 600;
    margin-bottom: 0.8rem;
    letter-spacing: 0.1em;
  }

  .remove-btn {
    position: absolute;
    top: 0.8rem;
    right: 0.8rem;
    width: 26px; height: 26px;
    border-radius: 50%;
    background: rgba(239,68,68,0.1);
    border: none;
    color: var(--danger);
    font-size: 0.9rem;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s;
  }
  .remove-btn:hover { background: rgba(239,68,68,0.2); }

  .add-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1.2rem;
    background: rgba(37,99,235,0.07);
    border: 1.5px dashed rgba(37,99,235,0.35);
    border-radius: var(--radius);
    color: var(--accent);
    font-family: 'Outfit', sans-serif;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
    width: 100%;
    justify-content: center;
  }
  .add-btn:hover {
    background: rgba(37,99,235,0.12);
    border-color: var(--accent);
  }

  /* ── Checkbox ── */
  .check-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.6rem;
  }
  .check-row input[type="checkbox"] {
    width: 16px; height: 16px;
    accent-color: var(--accent);
    cursor: pointer;
  }
  .check-row label {
    font-size: 0.85rem;
    color: var(--muted);
    cursor: pointer;
    text-transform: none;
    letter-spacing: 0;
  }

  /* ── KYC file preview ── */
  .file-zone {
    border: 2px dashed var(--border);
    border-radius: var(--radius);
    padding: 1.5rem;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    background: var(--card);
  }
  .file-zone:hover { border-color: var(--accent); background: rgba(37,99,235,0.03); }
  .file-zone.has-file { border-color: var(--success); background: rgba(16,185,129,0.04); }
  .file-zone-icon { font-size: 2rem; margin-bottom: 0.4rem; }
  .file-zone-text { font-size: 0.85rem; color: var(--muted); }
  .file-zone-name { font-size: 0.82rem; color: var(--success); font-weight: 600; margin-top: 0.3rem; }

  /* ── Footer nav ── */
  .er-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2.5rem;
    border-top: 1px solid var(--border);
    background: var(--card);
  }

  .btn-back {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.72rem 1.6rem;
    background: none;
    border: 1.5px solid var(--border);
    border-radius: 50px;
    color: var(--muted);
    font-family: 'Outfit', sans-serif;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-back:hover { border-color: var(--accent); color: var(--accent); }
  .btn-back:disabled { opacity: 0.4; cursor: default; }

  .btn-next {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.72rem 2rem;
    background: linear-gradient(135deg, #2563eb, #0284c7);
    border: none;
    border-radius: 50px;
    color: #fff;
    font-family: 'Outfit', sans-serif;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    transition: box-shadow 0.2s, transform 0.2s;
    box-shadow: 0 4px 16px rgba(37,99,235,0.35);
  }
  .btn-next:hover {
    box-shadow: 0 6px 24px rgba(37,99,235,0.45);
    transform: translateY(-1px);
  }
  .btn-next.submit { background: linear-gradient(135deg, #10b981, #0284c7); }

  .step-counter {
    font-size: 0.78rem;
    color: var(--muted);
    font-family: 'Fira Code', monospace;
  }

  /* ── Success screen ── */
  .success-screen {
    padding: 4rem 2.5rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  .success-icon {
    width: 80px; height: 80px;
    background: linear-gradient(135deg, #10b981, #0284c7);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 2.2rem;
    animation: pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both;
  }
  @keyframes pop {
    from { transform: scale(0); opacity:0; }
    to   { transform: scale(1); opacity:1; }
  }
  .success-screen h2 {
    font-size: 1.6rem; font-weight: 800; color: var(--text);
  }
  .success-screen p { color: var(--muted); max-width: 380px; line-height: 1.6; }
  .btn-reset {
    margin-top: 0.5rem;
    padding: 0.75rem 2rem;
    background: linear-gradient(135deg, #2563eb, #0284c7);
    border: none; border-radius: 50px;
    color: #fff; font-family: 'Outfit',sans-serif;
    font-size: 0.9rem; font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(37,99,235,0.3);
  }

  /* ── Responsive ── */
  @media (max-width: 600px) {
    .er-body { padding: 1.5rem 1.2rem 1rem; }
    .er-footer { padding: 1.2rem; }
    .er-header { padding: 1.6rem 1.2rem 1.4rem; }
    .form-grid { grid-template-columns: 1fr; }
    .col-full { grid-column: 1; }
  }
`;

function pwdStrength(pwd) {
  if (!pwd) return { score: 0, label: "", color: "" };
  let s = 0;
  if (pwd.length >= 8) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  const map = [
    { label: "Too weak", color: "#ef4444" },
    { label: "Weak",     color: "#f97316" },
    { label: "Fair",     color: "#eab308" },
    { label: "Strong",   color: "#22c55e" },
    { label: "Excellent",color: "#10b981" },
  ];
  return { score: s, ...map[s] };
}

export default function EmployeeRegister() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [showPwd, setShowPwd] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fileName, setFileName] = useState("");

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const setEdu = (i, key, val) => setForm(f => {
    const edu = [...f.edu];
    edu[i] = { ...edu[i], [key]: val };
    return { ...f, edu };
  });

  const setJob = (i, key, val) => setForm(f => {
    const jobs = [...f.jobs];
    jobs[i] = { ...jobs[i], [key]: val };
    return { ...f, jobs };
  });

  const addEdu = () => setForm(f => ({
    ...f, edu: [...f.edu, { degree:"", institution:"", year:"", grade:"" }]
  }));
  const removeEdu = i => setForm(f => ({ ...f, edu: f.edu.filter((_,idx)=>idx!==i) }));

  const addJob = () => setForm(f => ({
    ...f, jobs: [...f.jobs, { company:"", role:"", from:"", to:"", current:false, desc:"" }]
  }));
  const removeJob = i => setForm(f => ({ ...f, jobs: f.jobs.filter((_,idx)=>idx!==i) }));

  const validate = (s) => {
    const e = {};
    if (s === 1) {
      if (!form.firstName.trim()) e.firstName = "First name is required";
      if (!form.lastName.trim())  e.lastName  = "Last name is required";
      if (!form.dob)              e.dob        = "Date of birth is required";
      if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = "Valid email required";
      if (!form.phone.match(/^\d{10}$/)) e.phone = "10-digit phone required";
      if (!form.bloodGroup)       e.bloodGroup = "Please select blood group";
    }
    if (s === 2) {
      if (!form.street.trim()) e.street = "Street address required";
      if (!form.city.trim())   e.city   = "City required";
      if (!form.state.trim())  e.state  = "State required";
      if (!form.pincode.match(/^\d{6}$/)) e.pincode = "6-digit pincode required";
      if (!form.country.trim()) e.country = "Country required";
    }
    if (s === 3) {
      form.edu.forEach((ed, i) => {
        if (!ed.degree.trim())      e[`edu_degree_${i}`]      = "Degree required";
        if (!ed.institution.trim()) e[`edu_institution_${i}`] = "Institution required";
        if (!ed.year)               e[`edu_year_${i}`]        = "Year required";
      });
    }
    if (s === 5) {
      if (!form.kycType)            e.kycType   = "Select KYC type";
      if (!form.kycNumber.trim())   e.kycNumber = "KYC number required";
    }
    if (s === 6) {
      if (form.password.length < 8) e.password = "Minimum 8 characters";
      if (form.password !== form.confirm) e.confirm = "Passwords do not match";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate(step)) setStep(s => s + 1); };
  const back = () => { setErrors({}); setStep(s => s - 1); };

  const submit = () => {
    if (validate(6)) {
      console.log("Employee Data:", form);
      setSubmitted(true);
    }
  };

  const strength = pwdStrength(form.password);

  if (submitted) {
    return (
      <>
        <style>{styles}</style>
        <div className="er-root">
          <div className="er-card">
            <div className="er-header">
              <h1>Employee Registration</h1>
              <p>Complete your profile to get started</p>
            </div>
            <div className="success-screen">
              <div className="success-icon">✓</div>
              <h2>Registration Successful!</h2>
              <p>Welcome aboard, <strong>{form.firstName} {form.lastName}</strong>! Your employee profile has been created successfully.</p>
              <button className="btn-reset" onClick={() => { setForm(initialForm); setStep(1); setSubmitted(false); }}>
                Register Another Employee
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="er-root">
        <div className="er-card">

          {/* Header */}
          <div className="er-header">
            <h1>Employee Registration</h1>
            <p>Fill in all details to create a new employee profile</p>
          </div>

          {/* Stepper */}
          <div className="er-stepper">
            {steps.map((s, idx) => (
              <div className="step-item" key={s.id}>
                <div className="step-btn">
                  <div className={`step-circle ${step === s.id ? "active" : step > s.id ? "done" : ""}`}>
                    {step > s.id ? "✓" : s.icon}
                  </div>
                  <span className={`step-label ${step === s.id ? "active" : step > s.id ? "done" : ""}`}>
                    {s.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`step-line ${step > s.id ? "done" : ""}`} />
                )}
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="er-body">

            {/* ── STEP 1: Personal ── */}
            {step === 1 && (
              <>
                <div className="step-title">👤 Personal Information</div>
                <div className="form-grid">
                  <div className="field">
                    <label>First Name <span className="req">*</span></label>
                    <input className={errors.firstName ? "error" : ""} placeholder="John"
                      value={form.firstName} onChange={e => set("firstName", e.target.value)} />
                    {errors.firstName && <span className="err-msg">{errors.firstName}</span>}
                  </div>
                  <div className="field">
                    <label>Last Name <span className="req">*</span></label>
                    <input className={errors.lastName ? "error" : ""} placeholder="Doe"
                      value={form.lastName} onChange={e => set("lastName", e.target.value)} />
                    {errors.lastName && <span className="err-msg">{errors.lastName}</span>}
                  </div>
                  <div className="field">
                    <label>Date of Birth <span className="req">*</span></label>
                    <input type="date" className={errors.dob ? "error" : ""}
                      value={form.dob} onChange={e => set("dob", e.target.value)} />
                    {errors.dob && <span className="err-msg">{errors.dob}</span>}
                  </div>
                  <div className="field">
                    <label>Gender</label>
                    <select value={form.gender} onChange={e => set("gender", e.target.value)}>
                      <option value="">Select Gender</option>
                      <option>Male</option><option>Female</option><option>Other</option><option>Prefer not to say</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Email <span className="req">*</span></label>
                    <input type="email" className={errors.email ? "error" : ""} placeholder="john@company.com"
                      value={form.email} onChange={e => set("email", e.target.value)} />
                    {errors.email && <span className="err-msg">{errors.email}</span>}
                  </div>
                  <div className="field">
                    <label>Phone <span className="req">*</span></label>
                    <input placeholder="10-digit number" className={errors.phone ? "error" : ""}
                      value={form.phone} onChange={e => set("phone", e.target.value.replace(/\D/,"").slice(0,10))} />
                    {errors.phone && <span className="err-msg">{errors.phone}</span>}
                  </div>
                  <div className="field">
                    <label>Blood Group <span className="req">*</span></label>
                    <select className={errors.bloodGroup ? "error" : ""}
                      value={form.bloodGroup} onChange={e => set("bloodGroup", e.target.value)}>
                      <option value="">Select Blood Group</option>
                      {BLOOD_GROUPS.map(bg => <option key={bg}>{bg}</option>)}
                    </select>
                    {errors.bloodGroup && <span className="err-msg">{errors.bloodGroup}</span>}
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 2: Address ── */}
            {step === 2 && (
              <>
                <div className="step-title">Address Details</div>
                <div className="form-grid">
                  <div className="field col-full">
                    <label>Street Address <span className="req">*</span></label>
                    <input className={errors.street ? "error" : ""} placeholder="123, Main Street, Apt 4B"
                      value={form.street} onChange={e => set("street", e.target.value)} />
                    {errors.street && <span className="err-msg">{errors.street}</span>}
                  </div>
                  <div className="field">
                    <label>City <span className="req">*</span></label>
                    <input className={errors.city ? "error" : ""} placeholder="Chennai"
                      value={form.city} onChange={e => set("city", e.target.value)} />
                    {errors.city && <span className="err-msg">{errors.city}</span>}
                  </div>
                  <div className="field">
                    <label>State <span className="req">*</span></label>
                    <input className={errors.state ? "error" : ""} placeholder="Tamil Nadu"
                      value={form.state} onChange={e => set("state", e.target.value)} />
                    {errors.state && <span className="err-msg">{errors.state}</span>}
                  </div>
                  <div className="field">
                    <label>Pincode <span className="req">*</span></label>
                    <input className={errors.pincode ? "error" : ""} placeholder="600001"
                      value={form.pincode} onChange={e => set("pincode", e.target.value.replace(/\D/,"").slice(0,6))} />
                    {errors.pincode && <span className="err-msg">{errors.pincode}</span>}
                  </div>
                  <div className="field">
                    <label>Country <span className="req">*</span></label>
                    <input className={errors.country ? "error" : ""} placeholder="India"
                      value={form.country} onChange={e => set("country", e.target.value)} />
                    {errors.country && <span className="err-msg">{errors.country}</span>}
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 3: Education ── */}
            {step === 3 && (
              <>
                <div className="step-title">Education History</div>
                <div className="repeat-block">
                  {form.edu.map((ed, i) => (
                    <div className="repeat-row" key={i}>
                      <div className="row-num">QUALIFICATION #{i + 1}</div>
                      {form.edu.length > 1 && (
                        <button className="remove-btn" onClick={() => removeEdu(i)}>✕</button>
                      )}
                      <div className="form-grid">
                        <div className="field">
                          <label>Degree / Course <span className="req">*</span></label>
                          <input className={errors[`edu_degree_${i}`] ? "error" : ""}
                            placeholder="B.Sc Computer Science"
                            value={ed.degree} onChange={e => setEdu(i,"degree",e.target.value)} />
                          {errors[`edu_degree_${i}`] && <span className="err-msg">{errors[`edu_degree_${i}`]}</span>}
                        </div>
                        <div className="field">
                          <label>Institution <span className="req">*</span></label>
                          <input className={errors[`edu_institution_${i}`] ? "error" : ""}
                            placeholder="University / College name"
                            value={ed.institution} onChange={e => setEdu(i,"institution",e.target.value)} />
                          {errors[`edu_institution_${i}`] && <span className="err-msg">{errors[`edu_institution_${i}`]}</span>}
                        </div>
                        <div className="field">
                          <label>Year of Passing <span className="req">*</span></label>
                          <input type="number" min="1980" max="2030" className={errors[`edu_year_${i}`] ? "error" : ""}
                            placeholder="2024"
                            value={ed.year} onChange={e => setEdu(i,"year",e.target.value)} />
                          {errors[`edu_year_${i}`] && <span className="err-msg">{errors[`edu_year_${i}`]}</span>}
                        </div>
                        <div className="field">
                          <label>Grade / CGPA / %</label>
                          <input placeholder="8.6 CGPA / 86%"
                            value={ed.grade} onChange={e => setEdu(i,"grade",e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button className="add-btn" onClick={addEdu}>＋ Add Another Qualification</button>
                </div>
              </>
            )}

            {/* ── STEP 4: Job History ── */}
            {step === 4 && (
              <>
                <div className="step-title">Job History</div>
                <div className="repeat-block">
                  {form.jobs.map((job, i) => (
                    <div className="repeat-row" key={i}>
                      <div className="row-num">EXPERIENCE #{i + 1}</div>
                      {form.jobs.length > 1 && (
                        <button className="remove-btn" onClick={() => removeJob(i)}>✕</button>
                      )}
                      <div className="form-grid">
                        <div className="field">
                          <label>Company Name</label>
                          <input placeholder="TechCorp Pvt. Ltd."
                            value={job.company} onChange={e => setJob(i,"company",e.target.value)} />
                        </div>
                        <div className="field">
                          <label>Job Role / Title</label>
                          <input placeholder="Software Engineer"
                            value={job.role} onChange={e => setJob(i,"role",e.target.value)} />
                        </div>
                        <div className="field">
                          <label>From</label>
                          <input type="month"
                            value={job.from} onChange={e => setJob(i,"from",e.target.value)} />
                        </div>
                        <div className="field">
                          <label>To {job.current && <span style={{color:"var(--success)",fontSize:"0.75rem"}}>(Present)</span>}</label>
                          <input type="month" disabled={job.current}
                            value={job.to} onChange={e => setJob(i,"to",e.target.value)} />
                        </div>
                        <div className="field col-full">
                          <div className="check-row">
                            <input type="checkbox" id={`cur_${i}`}
                              checked={job.current} onChange={e => setJob(i,"current",e.target.checked)} />
                            <label htmlFor={`cur_${i}`}>Currently working here</label>
                          </div>
                        </div>
                        <div className="field col-full">
                          <label>Responsibilities / Description</label>
                          <textarea placeholder="Brief description of your role and responsibilities..."
                            value={job.desc} onChange={e => setJob(i,"desc",e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button className="add-btn" onClick={addJob}>＋ Add Another Job</button>
                </div>
              </>
            )}

            {/* ── STEP 5: KYC & Health ── */}
            {step === 5 && (
              <>
                <div className="step-title"> KYC Details & Health Info</div>
                <div className="form-grid">
                  <div className="field">
                    <label>KYC Document Type <span className="req">*</span></label>
                    <select className={errors.kycType ? "error" : ""}
                      value={form.kycType} onChange={e => set("kycType", e.target.value)}>
                      <option value="">Select Document</option>
                      {KYC_TYPES.map(k => <option key={k}>{k}</option>)}
                    </select>
                    {errors.kycType && <span className="err-msg">{errors.kycType}</span>}
                  </div>
                  <div className="field">
                    <label>Document Number <span className="req">*</span></label>
                    <input className={errors.kycNumber ? "error" : ""}
                      placeholder="Enter document number"
                      value={form.kycNumber} onChange={e => set("kycNumber", e.target.value)} />
                    {errors.kycNumber && <span className="err-msg">{errors.kycNumber}</span>}
                  </div>
                  <div className="field col-full">
                    <label>Upload KYC Document</label>
                    <div
                      className={`file-zone ${fileName ? "has-file" : ""}`}
                      onClick={() => document.getElementById("kyc-file").click()}
                    >
                      <div className="file-zone-icon">{fileName ? "" : ""}</div>
                      <div className="file-zone-text">
                        {fileName ? "Document uploaded" : "Click to upload (PDF, JPG, PNG — max 5MB)"}
                      </div>
                      {fileName && <div className="file-zone-name">{fileName}</div>}
                      <input id="kyc-file" type="file" accept=".pdf,.jpg,.jpeg,.png"
                        style={{display:"none"}}
                        onChange={e => {
                          const f = e.target.files[0];
                          if (f) { set("kycFile", f); setFileName(f.name); }
                        }} />
                    </div>
                  </div>
                  <div className="field">
                    <label>Emergency Contact Name</label>
                    <input placeholder="Parent / Spouse name"
                      value={form.emergencyName || ""}
                      onChange={e => set("emergencyName", e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Emergency Contact Phone</label>
                    <input placeholder="10-digit number"
                      value={form.emergencyPhone || ""}
                      onChange={e => set("emergencyPhone", e.target.value.replace(/\D/,"").slice(0,10))} />
                  </div>
                  <div className="field col-full">
                    <label>Known Medical Conditions (optional)</label>
                    <textarea placeholder="e.g. Diabetes, Hypertension, Allergies — leave blank if none"
                      value={form.medical || ""}
                      onChange={e => set("medical", e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 6: Security ── */}
            {step === 6 && (
              <>
                <div className="step-title">Create Password</div>
                <div className="form-grid">
                  <div className="field col-full">
                    <label>Password <span className="req">*</span></label>
                    <div className="pwd-wrap">
                      <input
                        type={showPwd ? "text" : "password"}
                        className={errors.password ? "error" : ""}
                        placeholder="Min. 8 chars with uppercase, number & symbol"
                        value={form.password}
                        onChange={e => set("password", e.target.value)}
                      />
                      <button className="pwd-toggle" type="button" onClick={() => setShowPwd(v => !v)}>
                        {showPwd ? "" : ""}
                      </button>
                    </div>
                    {form.password && (
                      <>
                        <div className="strength-bar">
                          <div className="strength-fill" style={{
                            width: `${(strength.score / 4) * 100}%`,
                            background: strength.color
                          }} />
                        </div>
                        <span className="strength-label" style={{ color: strength.color }}>
                          {strength.label}
                        </span>
                      </>
                    )}
                    {errors.password && <span className="err-msg">{errors.password}</span>}
                  </div>
                  <div className="field col-full">
                    <label>Confirm Password <span className="req">*</span></label>
                    <div className="pwd-wrap">
                      <input
                        type={showConf ? "text" : "password"}
                        className={errors.confirm ? "error" : ""}
                        placeholder="Re-enter your password"
                        value={form.confirm}
                        onChange={e => set("confirm", e.target.value)}
                      />
                      <button className="pwd-toggle" type="button" onClick={() => setShowConf(v => !v)}>
                        {showConf ? "" : ""}
                      </button>
                    </div>
                    {form.confirm && form.confirm === form.password && (
                      <span className="strength-label" style={{ color: "var(--success)" }}>✓ Passwords match</span>
                    )}
                    {errors.confirm && <span className="err-msg">{errors.confirm}</span>}
                  </div>
                  <div className="field col-full" style={{ marginTop:"0.5rem" }}>
                    <div style={{ background:"rgba(37,99,235,0.05)", border:"1.5px solid rgba(37,99,235,0.15)", borderRadius:"12px", padding:"1rem 1.2rem" }}>
                      <p style={{ fontSize:"0.82rem", color:"var(--muted)", lineHeight:"1.6" }}>
                        <strong>Password requirements:</strong> At least 8 characters, one uppercase letter, one number, and one special character.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>

          {/* Footer */}
          <div className="er-footer">
            <button className="btn-back" onClick={back} disabled={step === 1}>
              ← Back
            </button>
            <span className="step-counter">{step} / {steps.length}</span>
            {step < steps.length ? (
              <button className="btn-next" onClick={next}>
                Next →
              </button>
            ) : (
              <button className="btn-next submit" onClick={submit}>
                ✓ Register Employee
              </button>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
