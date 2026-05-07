import { BrowserRouter, Routes, Route, NavLink, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import RequireAuth from './components/RequireAuth/index.jsx';
import Dashboard from './pages/Dashboard/index.jsx';
import NewAssessment from './pages/NewAssessment/index.jsx';
import Processing from './pages/Processing/index.jsx';
import Report from './pages/Report/index.jsx';
import SkillsManager from './pages/SkillsManager/index.jsx';
import AgentsManager from './pages/AgentsManager/index.jsx';
import WorkflowsManager from './pages/WorkflowsManager/index.jsx';
import SourcesManager from './pages/SourcesManager/index.jsx';
import UsersManager from './pages/UsersManager/index.jsx';
import Login from './pages/Login/index.jsx';

function Nav() {
  const { user, logout } = useAuth();

  const linkClass = ({ isActive }) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <span className="font-bold text-brand text-lg tracking-wide">AVAR</span>
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={linkClass}>לוח בקרה</NavLink>
          <NavLink to="/new" className={linkClass}>הערכה חדשה</NavLink>
          <NavLink to="/workflows" className={linkClass}>Workflows</NavLink>
          <NavLink to="/skills" className={linkClass}>מיומנויות</NavLink>
          <NavLink to="/agents" className={linkClass}>סוכנים</NavLink>
          <NavLink to="/sources" className={linkClass}>מקורות</NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/users" className={linkClass}>משתמשים</NavLink>
          )}
        </nav>
        {user && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{user.username}</span>
            <button
              onClick={logout}
              className="text-xs text-gray-500 hover:text-red-500 transition-colors"
            >
              יציאה
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function Layout() {
  return (
    <>
      <Nav />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <Outlet />
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen flex flex-col">
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Protected — all authenticated users */}
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/new" element={<NewAssessment />} />
                <Route path="/processing/:sessionId" element={<Processing />} />
                <Route path="/report/:sessionId" element={<Report />} />
                <Route path="/workflows" element={<WorkflowsManager />} />
                <Route path="/skills" element={<SkillsManager />} />
                <Route path="/agents" element={<AgentsManager />} />
                <Route path="/sources" element={<SourcesManager />} />

                {/* Admin only */}
                <Route element={<RequireAuth role="admin" />}>
                  <Route path="/users" element={<UsersManager />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
