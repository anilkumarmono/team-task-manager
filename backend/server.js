// ============================================================
// TaskFlow — Backend API (Node.js + Express + sqlite3)
// npm install express sqlite3 bcryptjs jsonwebtoken cors
// node server.js
// ============================================================

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'taskflow-dev-secret-change-in-prod';

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database(path.join(__dirname, 'taskflow.db'), (err) => {
  if (err) { console.error('DB error:', err); }
  console.log('✓ Database connected');
});

const run = (sql, params = []) => new Promise((res, rej) =>
  db.run(sql, params, function (err) { err ? rej(err) : res(this); }));
const get = (sql, params = []) => new Promise((res, rej) =>
  db.get(sql, params, (err, row) => err ? rej(err) : res(row)));
const all = (sql, params = []) => new Promise((res, rej) =>
  db.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));

async function initDB() {
  await run(`PRAGMA journal_mode = WAL`);
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#7c6af7',
    owner_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS project_members (
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (project_id, user_id)
  )`);
  await run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    due_date DATE,
    project_id INTEGER,
    assignee_id INTEGER,
    creator_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  const existing = await get('SELECT id FROM users WHERE email = ?', ['admin@demo.com']);
  if (!existing) {
    const hash = bcrypt.hashSync('password123', 10);
    await run('INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)',
      ['Admin User', 'admin@demo.com', hash, 'admin']);
    console.log('✓ Demo admin seeded: admin@demo.com / password123');
  }
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'Unauthorized' });
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch { res.status(401).json({ message: 'Invalid token' }); }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  next();
}

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password min 6 chars' });
    const exists = await get('SELECT id FROM users WHERE email = ?', [email]);
    if (exists) return res.status(409).json({ message: 'Email already registered' });
    const hash = bcrypt.hashSync(password, 10);
    const result = await run('INSERT INTO users (name, email, password) VALUES (?,?,?)', [name, email, hash]);
    const user = { id: result.lastID, name, email, role: 'member' };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    const user = await get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ message: 'Invalid credentials' });
    const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: payload });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/users', authMiddleware, async (req, res) => {
  try { res.json(await all('SELECT id, name, email, role FROM users ORDER BY name')); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/projects', authMiddleware, async (req, res) => {
  try {
    let projects;
    if (req.user.role === 'admin') {
      projects = await all('SELECT * FROM projects ORDER BY created_at DESC');
    } else {
      projects = await all(`
        SELECT DISTINCT p.* FROM projects p
        LEFT JOIN project_members pm ON pm.project_id = p.id
        WHERE p.owner_id = ? OR pm.user_id = ?
        ORDER BY p.created_at DESC
      `, [req.user.id, req.user.id]);
    }
    res.json(projects);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/projects', authMiddleware, async (req, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name) return res.status(400).json({ message: 'Name required' });
    const result = await run('INSERT INTO projects (name, description, color, owner_id) VALUES (?,?,?,?)',
      [name, description || '', color || '#7c6af7', req.user.id]);
    res.status(201).json(await get('SELECT * FROM projects WHERE id = ?', [result.lastID]));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.put('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const project = await get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ message: 'Not found' });
    if (project.owner_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Forbidden' });
    const { name, description, color } = req.body;
    await run('UPDATE projects SET name=?, description=?, color=? WHERE id=?',
      [name || project.name, description ?? project.description, color || project.color, req.params.id]);
    res.json(await get('SELECT * FROM projects WHERE id = ?', [req.params.id]));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete('/api/projects/:id', authMiddleware, adminOnly, async (req, res) => {
  try { await run('DELETE FROM projects WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/projects/:id/members', authMiddleware, async (req, res) => {
  try {
    await run('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?,?)',
      [req.params.id, req.body.user_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/tasks', authMiddleware, async (req, res) => {
  try {
    let tasks;
    if (req.user.role === 'admin') {
      tasks = await all(`
        SELECT t.*, u.name AS assignee_name, p.name AS project_name
        FROM tasks t
        LEFT JOIN users u ON u.id = t.assignee_id
        LEFT JOIN projects p ON p.id = t.project_id
        ORDER BY t.created_at DESC
      `);
    } else {
      tasks = await all(`
        SELECT t.*, u.name AS assignee_name, p.name AS project_name
        FROM tasks t
        LEFT JOIN users u ON u.id = t.assignee_id
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN project_members pm ON pm.project_id = t.project_id
        WHERE t.assignee_id = ? OR t.creator_id = ? OR pm.user_id = ?
        GROUP BY t.id
        ORDER BY t.created_at DESC
      `, [req.user.id, req.user.id, req.user.id]);
    }
    res.json(tasks);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const { title, description, status, priority, due_date, project_id, assignee_id } = req.body;
    if (!title) return res.status(400).json({ message: 'Title required' });
    const result = await run(`
      INSERT INTO tasks (title, description, status, priority, due_date, project_id, assignee_id, creator_id)
      VALUES (?,?,?,?,?,?,?,?)
    `, [title, description || '', status || 'todo', priority || 'medium',
        due_date || null, project_id || null, assignee_id || null, req.user.id]);
    const task = await get(`
      SELECT t.*, u.name AS assignee_name, p.name AS project_name
      FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
      LEFT JOIN projects p ON p.id = t.project_id WHERE t.id = ?
    `, [result.lastID]);
    res.status(201).json(task);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const task = await get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) return res.status(404).json({ message: 'Not found' });
    if (req.user.role !== 'admin' && task.creator_id !== req.user.id && task.assignee_id !== req.user.id)
      return res.status(403).json({ message: 'Forbidden' });
    const { title, description, status, priority, due_date, project_id, assignee_id } = req.body;
    await run(`UPDATE tasks SET title=?,description=?,status=?,priority=?,due_date=?,project_id=?,assignee_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [title??task.title, description??task.description, status??task.status, priority??task.priority,
       due_date!==undefined?due_date:task.due_date, project_id!==undefined?project_id:task.project_id,
       assignee_id!==undefined?assignee_id:task.assignee_id, req.params.id]);
    const updated = await get(`
      SELECT t.*, u.name AS assignee_name, p.name AS project_name
      FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
      LEFT JOIN projects p ON p.id = t.project_id WHERE t.id = ?
    `, [req.params.id]);
    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const task = await get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) return res.status(404).json({ message: 'Not found' });
    if (req.user.role !== 'admin' && task.creator_id !== req.user.id)
      return res.status(403).json({ message: 'Forbidden' });
    await run('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// root route (Railway needs this)
app.get("/", (req, res) => {
  res.send("TaskFlow API is running ✅");
});

// start server immediately
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// run DB in background (don’t block server)
initDB()
  .then(() => {
    console.log("✓ DB initialized");
    console.log("Demo login: admin@demo.com / password123");
  })
  .catch(err => {
    console.error("DB init failed:", err);
  });
