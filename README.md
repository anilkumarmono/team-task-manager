# ⬡ TaskFlow — Team Task Manager

A full-stack team task management app with role-based access control.

## 🚀 Stack
- **Frontend**: React 18 (no bundler for dev, use Vite for prod)
- **Backend**: Node.js + Express + SQLite (`better-sqlite3`)
- **Auth**: JWT + bcryptjs
- **Deployment**: Railway

---

## 📁 Project Structure

```
team-task-manager/
├── frontend/
│   ├── index.html       # Entry point
│   └── App.jsx          # Full React app
└── backend/
    ├── server.js        # Express API + SQLite DB
    ├── package.json
    └── railway.toml     # Railway deployment config
```

---

## ⚙️ Local Setup

### Backend
```bash
cd backend
npm install
node server.js
# API runs at http://localhost:4000
# Demo: admin@demo.com / password123
```

### Frontend (dev, no bundler)
```bash
cd frontend
# Serve with any static server:
npx serve .
# OR use VS Code Live Server
# Visit http://localhost:3000 (or whatever port)
```

> The frontend calls `http://localhost:4000/api` by default.  
> Change the `API` constant in `App.jsx` for production.

### Frontend (production with Vite)
```bash
npm create vite@latest frontend-prod -- --template react
# Copy App.jsx content into src/App.jsx
# Adjust imports (remove React CDN globals, use import statements)
npm run build
```

---

## 🔑 Features

### Authentication
- Signup / Login with JWT
- Password hashing (bcrypt)
- Token stored in localStorage

### Role-Based Access Control
| Feature           | Admin | Member |
|-------------------|-------|--------|
| All projects      | ✅    | Own only |
| Create project    | ✅    | ✅     |
| Delete project    | ✅    | ❌     |
| Create task       | ✅    | ✅     |
| Edit own task     | ✅    | ✅     |
| Delete any task   | ✅    | Own only |
| Manage roles      | ✅    | ❌     |

### Projects & Tasks
- Create projects with custom color labels
- Kanban board (Todo / In Progress / Done) per project
- Tasks have title, description, priority, due date, assignee
- Overdue detection (due_date < today and not done)

### Dashboard
- Stats: total, in progress, done, overdue
- "My Tasks" quick view
- Overdue alerts

---

## 🌐 Deploy to Railway

### Backend
1. Push to GitHub
2. Create new Railway project → "Deploy from GitHub repo"
3. Select `/backend` folder
4. Add env variable: `JWT_SECRET=your-very-long-secret-here`
5. Railway auto-detects Node and runs `node server.js`
6. Copy the generated Railway URL

### Frontend
1. Update the `API` constant in `App.jsx`:
   ```js
   const API = 'https://your-railway-backend.railway.app/api';
   ```
2. Deploy frontend to Railway, Vercel, or Netlify as a static site
3. Use `npx serve frontend` or a Vite build

---

## 🔌 API Reference

| Method | Endpoint                        | Auth     | Description          |
|--------|---------------------------------|----------|----------------------|
| POST   | /api/auth/signup                | —        | Register             |
| POST   | /api/auth/login                 | —        | Login, get JWT       |
| GET    | /api/users                      | ✅       | List all users       |
| PUT    | /api/users/:id/role             | Admin    | Update role          |
| GET    | /api/projects                   | ✅       | List projects        |
| POST   | /api/projects                   | ✅       | Create project       |
| PUT    | /api/projects/:id               | Owner/Admin | Update project    |
| DELETE | /api/projects/:id               | Admin    | Delete project       |
| POST   | /api/projects/:id/members       | ✅       | Add member           |
| DELETE | /api/projects/:id/members/:uid  | Admin    | Remove member        |
| GET    | /api/tasks                      | ✅       | List tasks           |
| POST   | /api/tasks                      | ✅       | Create task          |
| PUT    | /api/tasks/:id                  | Creator/Assignee/Admin | Update task |
| DELETE | /api/tasks/:id                  | Creator/Admin | Delete task     |
| GET    | /api/health                     | —        | Health check         |

---

## 📹 Demo Video Checklist (2–5 min)
1. Sign up as new member
2. Login as admin (admin@demo.com)
3. Create a project
4. Add tasks in different columns
5. Assign task to member
6. Show overdue task
7. Show Dashboard stats
8. Show role restriction (login as member, try to delete)
9. Show live Railway URL

---

## 📝 README for Submission
- Live URL: `https://your-app.railway.app`
- GitHub: `https://github.com/your-username/taskflow`
- Demo video: `https://loom.com/...`
