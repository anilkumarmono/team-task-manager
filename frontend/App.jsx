// ============================================================
// TaskFlow — Full Frontend App (React, no bundler needed for dev)
// For production: use Vite or CRA, import as modules.
// ============================================================

const { useState, useEffect, useCallback, createContext, useContext } = React;

// ── API helpers ──────────────────────────────────────────────
const API = 'http://localhost:4000/api';
const getToken = () => localStorage.getItem('tf_token');
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: authHeaders(),
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// ── Auth Context ─────────────────────────────────────────────
const AuthCtx = createContext(null);
function useAuth() { return useContext(AuthCtx); }

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tf_user')); } catch { return null; }
  });

  const login = async (email, password) => {
    const data = await apiFetch('/auth/login', { method: 'POST', body: { email, password } });
    localStorage.setItem('tf_token', data.token);
    localStorage.setItem('tf_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const signup = async (name, email, password) => {
    const data = await apiFetch('/auth/signup', { method: 'POST', body: { name, email, password } });
    localStorage.setItem('tf_token', data.token);
    localStorage.setItem('tf_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('tf_token');
    localStorage.removeItem('tf_user');
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, login, signup, logout }}>{children}</AuthCtx.Provider>;
}

// ── Styles (CSS-in-JS object helpers) ───────────────────────
const S = {
  page: { minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 },
  btn: (variant = 'primary') => ({
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '10px 20px', borderRadius: 10, fontFamily: 'var(--font)', fontWeight: 700,
    fontSize: 14, cursor: 'pointer', border: 'none', transition: 'all 0.2s',
    ...(variant === 'primary' ? { background: 'var(--accent)', color: '#fff' } :
        variant === 'ghost'   ? { background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)' } :
        variant === 'danger'  ? { background: 'var(--danger)', color: '#fff' } :
                                { background: 'var(--surface2)', color: 'var(--text)' })
  }),
  input: {
    width: '100%', padding: '12px 16px', background: 'var(--surface2)',
    border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
    fontFamily: 'var(--font)', fontSize: 14, outline: 'none',
  },
  label: { fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' },
  badge: (color) => ({
    display: 'inline-block', padding: '3px 10px', borderRadius: 20,
    fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)',
    background: color + '22', color: color, border: `1px solid ${color}44`
  }),
};

// ── Small reusable components ────────────────────────────────
function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={S.label}>{label}</label>}
      <input style={S.input} {...props} />
    </div>
  );
}

function Select({ label, options, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={S.label}>{label}</label>}
      <select style={{ ...S.input, appearance: 'none' }} {...props}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000099', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ ...S.card, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} style={S.btn('ghost')}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toast({ msg, type }) {
  const colors = { success: 'var(--accent3)', error: 'var(--danger)', info: 'var(--accent)' };
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: 'var(--surface2)', border: `1px solid ${colors[type] || colors.info}`,
      borderRadius: 12, padding: '14px 20px', fontWeight: 600, fontSize: 14,
      color: colors[type] || colors.info, boxShadow: '0 8px 32px #00000066',
      animation: 'fadeIn 0.3s ease'
    }}>
      {msg}
    </div>
  );
}

// ── Status/Priority helpers ──────────────────────────────────
const STATUS_COLORS = { todo: '#6b6b85', in_progress: 'var(--accent)', done: 'var(--accent3)', overdue: 'var(--danger)' };
const PRIORITY_COLORS = { low: 'var(--accent3)', medium: 'var(--accent2)', high: 'var(--danger)' };
const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };

function isOverdue(task) {
  return task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();
}

// ── Auth Pages ───────────────────────────────────────────────
function AuthPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await signup(form.name, form.email, form.password);
    } catch (ex) { setErr(ex.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ ...S.page, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        .auth-card { animation: fadeIn 0.5s ease; }
        input:focus { border-color: var(--accent) !important; }
        button:hover { opacity: 0.85; transform: translateY(-1px); }
      `}</style>

      {/* Brand */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>⬡</div>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>
          Task<span style={{ color: 'var(--accent)' }}>Flow</span>
        </h1>
        <p style={{ color: 'var(--muted)', marginTop: 8, fontFamily: 'var(--mono)', fontSize: 13 }}>Team project & task management</p>
      </div>

      <div className="auth-card" style={{ ...S.card, width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {['login', 'signup'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              ...S.btn(mode === m ? 'primary' : 'ghost'),
              flex: 1, justifyContent: 'center', textTransform: 'capitalize'
            }}>{m === 'login' ? 'Sign In' : 'Sign Up'}</button>
          ))}
        </div>

        <form onSubmit={handle}>
          {mode === 'signup' && <Input label="Full Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" required />}
          <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" required />
          <Input label="Password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" required />
          {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 16, fontFamily: 'var(--mono)' }}>⚠ {err}</div>}
          <button type="submit" style={{ ...S.btn('primary'), width: '100%', justifyContent: 'center', padding: '14px' }} disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
          </button>
        </form>
      </div>

      <p style={{ marginTop: 20, fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
        Demo: admin@demo.com / password123
      </p>
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────
function Sidebar({ view, setView, projects, onNewProject }) {
  const { user, logout } = useAuth();
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '◈' },
    { id: 'tasks', label: 'My Tasks', icon: '◉' },
  ];

  return (
    <aside style={{
      width: 240, background: 'var(--surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0
    }}>
      {/* Brand */}
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
          Task<span style={{ color: 'var(--accent)' }}>Flow</span>
        </h2>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{user?.role}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '16px 12px', flex: 1 }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => setView(item.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: view === item.id ? 'var(--accent)22' : 'transparent',
            color: view === item.id ? 'var(--accent)' : 'var(--muted)',
            fontFamily: 'var(--font)', fontWeight: 700, fontSize: 14, marginBottom: 4,
            transition: 'all 0.15s'
          }}>
            <span style={{ fontSize: 16 }}>{item.icon}</span> {item.label}
          </button>
        ))}

        <div style={{ marginTop: 20, marginBottom: 8 }}>
          <div style={{ ...S.label, padding: '0 12px' }}>Projects</div>
        </div>
        {projects.map(p => (
          <button key={p.id} onClick={() => setView(`project:${p.id}`)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: view === `project:${p.id}` ? 'var(--accent)22' : 'transparent',
            color: view === `project:${p.id}` ? 'var(--accent)' : 'var(--text)',
            fontFamily: 'var(--font)', fontWeight: 600, fontSize: 13, marginBottom: 2,
            textAlign: 'left', transition: 'all 0.15s'
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || 'var(--accent)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          </button>
        ))}
        <button onClick={onNewProject} style={{
          ...S.btn('ghost'), width: '100%', justifyContent: 'center',
          marginTop: 8, fontSize: 12, padding: '8px'
        }}>+ New Project</button>
      </nav>

      <div style={{ padding: '16px 12px', borderTop: '1px solid var(--border)' }}>
        <button onClick={logout} style={{ ...S.btn('ghost'), width: '100%', justifyContent: 'center', fontSize: 13 }}>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

// ── Dashboard ────────────────────────────────────────────────
function Dashboard({ tasks, projects }) {
  const { user } = useAuth();
  const myTasks = tasks.filter(t => t.assignee_id === user.id);
  const overdueTasks = tasks.filter(isOverdue);
  const doneTasks = tasks.filter(t => t.status === 'done');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');

  const stats = [
    { label: 'Total Tasks', value: tasks.length, color: 'var(--accent)' },
    { label: 'In Progress', value: inProgressTasks.length, color: 'var(--accent2)' },
    { label: 'Completed', value: doneTasks.length, color: 'var(--accent3)' },
    { label: 'Overdue', value: overdueTasks.length, color: 'var(--danger)' },
  ];

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Good morning, {user.name.split(' ')[0]} 👋</h2>
      <p style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 13, marginBottom: 32 }}>
        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...S.card, borderLeft: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.color, fontFamily: 'var(--mono)' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* My Tasks */}
        <div style={S.card}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>My Tasks</h3>
          {myTasks.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--mono)' }}>No tasks assigned to you.</p>
          ) : myTasks.slice(0, 5).map(t => (
            <TaskRow key={t.id} task={t} compact />
          ))}
        </div>

        {/* Overdue */}
        <div style={S.card}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, color: overdueTasks.length ? 'var(--danger)' : undefined }}>
            ⚠ Overdue Tasks
          </h3>
          {overdueTasks.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--mono)' }}>All tasks on track!</p>
          ) : overdueTasks.slice(0, 5).map(t => (
            <TaskRow key={t.id} task={t} compact showDue />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── TaskRow ──────────────────────────────────────────────────
function TaskRow({ task, compact, showDue, onEdit, onDelete }) {
  const over = isOverdue(task);
  const statusColor = over ? STATUS_COLORS.overdue : STATUS_COLORS[task.status];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: compact ? '8px 0' : '12px 0',
      borderBottom: '1px solid var(--border)'
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 13 : 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
        {showDue && task.due_date && (
          <div style={{ fontSize: 11, color: 'var(--danger)', fontFamily: 'var(--mono)', marginTop: 2 }}>
            Due {new Date(task.due_date).toLocaleDateString()}
          </div>
        )}
      </div>
      <span style={S.badge(PRIORITY_COLORS[task.priority] || 'var(--muted)')}>{task.priority}</span>
      {!compact && onEdit && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onEdit(task)} style={S.btn('ghost')}>Edit</button>
          <button onClick={() => onDelete(task.id)} style={S.btn('danger')}>✕</button>
        </div>
      )}
    </div>
  );
}

// ── Project View ─────────────────────────────────────────────
function ProjectView({ projectId, tasks, members, onNewTask, onEditTask, onDeleteTask, isAdmin, project }) {
  const projectTasks = tasks.filter(t => t.project_id === parseInt(projectId));
  const columns = ['todo', 'in_progress', 'done'];

  return (
    <div style={{ padding: 32, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 800 }}>{project?.name || 'Project'}</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--mono)', marginTop: 4 }}>{project?.description}</p>
        </div>
        <button onClick={() => onNewTask(projectId)} style={S.btn('primary')}>+ Add Task</button>
      </div>

      {/* Kanban board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {columns.map(col => {
          const colTasks = projectTasks.filter(t => t.status === col);
          return (
            <div key={col} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>{STATUS_LABELS[col]}</span>
                <span style={S.badge(STATUS_COLORS[col])}>{colTasks.length}</span>
              </div>
              {colTasks.map(task => (
                <div key={task.id} style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: 14, marginBottom: 10
                }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{task.title}</div>
                  {task.description && (
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5 }}>{task.description}</p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <span style={S.badge(PRIORITY_COLORS[task.priority] || 'var(--muted)')}>{task.priority}</span>
                    {task.due_date && (
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: isOverdue(task) ? 'var(--danger)' : 'var(--muted)' }}>
                        {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {task.assignee_name && (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                      → {task.assignee_name}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button onClick={() => onEditTask(task)} style={{ ...S.btn('ghost'), padding: '5px 10px', fontSize: 11 }}>Edit</button>
                    {isAdmin && <button onClick={() => onDeleteTask(task.id)} style={{ ...S.btn('danger'), padding: '5px 10px', fontSize: 11 }}>Del</button>}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── My Tasks View ────────────────────────────────────────────
function MyTasksView({ tasks, onEdit, onDelete, isAdmin }) {
  const { user } = useAuth();
  const myTasks = tasks.filter(t => t.assignee_id === user.id);
  const [filter, setFilter] = useState('all');
  const filters = [
    { id: 'all', label: 'All' },
    { id: 'todo', label: 'To Do' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'done', label: 'Done' },
    { id: 'overdue', label: 'Overdue' },
  ];
  const filtered = myTasks.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'overdue') return isOverdue(t);
    return t.status === filter;
  });

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 24 }}>My Tasks</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            ...S.btn(filter === f.id ? 'primary' : 'ghost'), padding: '7px 16px', fontSize: 13
          }}>{f.label}</button>
        ))}
      </div>
      <div style={S.card}>
        {filtered.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 13 }}>No tasks found.</p>
        ) : filtered.map(t => (
          <TaskRow key={t.id} task={t} showDue onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

// ── Task Modal ───────────────────────────────────────────────
function TaskModal({ task, projectId, projects, members, onSave, onClose }) {
  const [form, setForm] = useState(task || {
    title: '', description: '', priority: 'medium', status: 'todo',
    due_date: '', assignee_id: '', project_id: projectId || ''
  });
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) return setErr('Title is required');
    try {
      await onSave(form);
      onClose();
    } catch (ex) { setErr(ex.message); }
  };

  return (
    <Modal title={task ? 'Edit Task' : 'New Task'} onClose={onClose}>
      <Input label="Title" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Task title" />
      <div style={{ marginBottom: 16 }}>
        <label style={S.label}>Description</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)}
          style={{ ...S.input, minHeight: 80, resize: 'vertical' }} placeholder="Optional description" />
      </div>
      <Select label="Project" value={form.project_id}
        onChange={e => set('project_id', e.target.value)}
        options={[{ value: '', label: '— Select project —' }, ...projects.map(p => ({ value: p.id, label: p.name }))]} />
      <Select label="Assignee" value={form.assignee_id}
        onChange={e => set('assignee_id', e.target.value)}
        options={[{ value: '', label: '— Unassigned —' }, ...members.map(m => ({ value: m.id, label: m.name }))]} />
      <Select label="Priority" value={form.priority}
        onChange={e => set('priority', e.target.value)}
        options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
      <Select label="Status" value={form.status}
        onChange={e => set('status', e.target.value)}
        options={[{ value: 'todo', label: 'To Do' }, { value: 'in_progress', label: 'In Progress' }, { value: 'done', label: 'Done' }]} />
      <Input label="Due Date" type="date" value={form.due_date || ''} onChange={e => set('due_date', e.target.value)} />
      {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, fontFamily: 'var(--mono)' }}>⚠ {err}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={save} style={{ ...S.btn('primary'), flex: 1, justifyContent: 'center' }}>Save Task</button>
        <button onClick={onClose} style={S.btn('ghost')}>Cancel</button>
      </div>
    </Modal>
  );
}

// ── Project Modal ────────────────────────────────────────────
function ProjectModal({ onSave, onClose }) {
  const [form, setForm] = useState({ name: '', description: '', color: '#7c6af7' });
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return setErr('Name is required');
    try { await onSave(form); onClose(); }
    catch (ex) { setErr(ex.message); }
  };

  return (
    <Modal title="New Project" onClose={onClose}>
      <Input label="Project Name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Project name" />
      <div style={{ marginBottom: 16 }}>
        <label style={S.label}>Description</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)}
          style={{ ...S.input, minHeight: 80, resize: 'vertical' }} placeholder="Optional description" />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={S.label}>Color</label>
        <input type="color" value={form.color} onChange={e => set('color', e.target.value)}
          style={{ width: '100%', height: 44, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer' }} />
      </div>
      {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, fontFamily: 'var(--mono)' }}>⚠ {err}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={save} style={{ ...S.btn('primary'), flex: 1, justifyContent: 'center' }}>Create Project</button>
        <button onClick={onClose} style={S.btn('ghost')}>Cancel</button>
      </div>
    </Modal>
  );
}

// ── Main App ─────────────────────────────────────────────────
function App() {
  const { user } = useAuth();
  const [view, setView] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [modal, setModal] = useState(null); // 'newProject' | 'newTask' | { task }
  const [taskProjectId, setTaskProjectId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    try {
      const [p, t, m] = await Promise.all([
        apiFetch('/projects'),
        apiFetch('/tasks'),
        apiFetch('/users'),
      ]);
      setProjects(p);
      setTasks(t);
      setMembers(m);
    } catch (ex) { console.error(ex); }
  }, []);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  const isAdmin = user?.role === 'admin';

  const createProject = async (data) => {
    const p = await apiFetch('/projects', { method: 'POST', body: data });
    setProjects(prev => [...prev, p]);
    showToast('Project created!');
  };

  const createTask = async (data) => {
    const t = await apiFetch('/tasks', { method: 'POST', body: data });
    setTasks(prev => [...prev, t]);
    showToast('Task created!');
  };

  const updateTask = async (data) => {
    const t = await apiFetch(`/tasks/${data.id}`, { method: 'PUT', body: data });
    setTasks(prev => prev.map(x => x.id === t.id ? t : x));
    showToast('Task updated!');
  };

  const deleteTask = async (id) => {
    await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
    setTasks(prev => prev.filter(t => t.id !== id));
    showToast('Task deleted.', 'info');
  };

  const currentProjectId = view.startsWith('project:') ? view.split(':')[1] : null;
  const currentProject = currentProjectId ? projects.find(p => p.id === parseInt(currentProjectId)) : null;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        button:hover { opacity: 0.85; }
        input:focus, textarea:focus, select:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 3px var(--accent)22; }
      `}</style>

      <Sidebar view={view} setView={setView} projects={projects} onNewProject={() => setModal('newProject')} />

      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        {view === 'dashboard' && <Dashboard tasks={tasks} projects={projects} />}
        {view === 'tasks' && <MyTasksView tasks={tasks} members={members} onEdit={(t) => setModal({ task: t })} onDelete={deleteTask} isAdmin={isAdmin} />}
        {currentProjectId && (
          <ProjectView
            projectId={currentProjectId}
            project={currentProject}
            tasks={tasks}
            members={members}
            isAdmin={isAdmin}
            onNewTask={(pid) => { setTaskProjectId(pid); setModal('newTask'); }}
            onEditTask={(t) => setModal({ task: t })}
            onDeleteTask={deleteTask}
          />
        )}
      </main>

      {/* Modals */}
      {modal === 'newProject' && <ProjectModal onSave={createProject} onClose={() => setModal(null)} />}
      {modal === 'newTask' && (
        <TaskModal projectId={taskProjectId} projects={projects} members={members}
          onSave={createTask} onClose={() => setModal(null)} />
      )}
      {modal?.task && (
        <TaskModal task={modal.task} projects={projects} members={members}
          onSave={updateTask} onClose={() => setModal(null)} />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────
function Root() {
  const { user } = useAuth();
  return user ? <App /> : <AuthPage />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider><Root /></AuthProvider>
);
