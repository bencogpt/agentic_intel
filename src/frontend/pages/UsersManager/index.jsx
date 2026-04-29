import { useState, useEffect } from 'react';
import { api } from '../../services/client.js';

export default function UsersManager() {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // Create form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState('');

  // Password reset state: { [username]: string }
  const [pwdInputs, setPwdInputs]   = useState({});
  const [pwdLoading, setPwdLoading] = useState({});

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      setUsers(await api.users.list());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      await api.users.create(newUsername, newPassword);
      setNewUsername('');
      setNewPassword('');
      await fetchUsers();
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(username) {
    if (!confirm(`למחוק את המשתמש "${username}"?`)) return;
    try {
      await api.users.remove(username);
      await fetchUsers();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handlePasswordChange(username) {
    const pwd = pwdInputs[username];
    if (!pwd) return;
    setPwdLoading(p => ({ ...p, [username]: true }));
    try {
      await api.users.updatePassword(username, pwd);
      setPwdInputs(p => ({ ...p, [username]: '' }));
      alert(`הסיסמה של "${username}" עודכנה`);
    } catch (e) {
      alert(e.message);
    } finally {
      setPwdLoading(p => ({ ...p, [username]: false }));
    }
  }

  const roleBadge = (role) => (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
      role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
    }`}>
      {role === 'admin' ? 'מנהל' : 'אנליסט'}
    </span>
  );

  return (
    <div dir="rtl" className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">ניהול משתמשים</h1>

      {error && <div className="text-red-600 mb-4 text-sm">{error}</div>}

      {/* Create user form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">הוספת משתמש חדש</h2>
        <form onSubmit={handleCreate} className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-32">
            <label className="block text-xs text-gray-600 mb-1">שם משתמש</label>
            <input
              required
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="שם משתמש"
            />
          </div>
          <div className="flex-1 min-w-32">
            <label className="block text-xs text-gray-600 mb-1">סיסמה</label>
            <input
              required
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="סיסמה"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50 transition-colors"
          >
            {creating ? 'יוצר...' : 'הוסף'}
          </button>
        </form>
        {createError && <p className="text-red-600 text-xs mt-2">{createError}</p>}
      </div>

      {/* Users table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-400 text-sm">טוען...</div>
        ) : users.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">אין משתמשים</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs font-medium">
                <th className="text-right px-4 py-3">משתמש</th>
                <th className="text-right px-4 py-3">תפקיד</th>
                <th className="text-right px-4 py-3">תאריך יצירה</th>
                <th className="text-right px-4 py-3">שינוי סיסמה</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.username} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.username}</td>
                  <td className="px-4 py-3">{roleBadge(u.role)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(u.createdAt).toLocaleDateString('he-IL')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 items-center">
                      <input
                        type="password"
                        placeholder="סיסמה חדשה"
                        value={pwdInputs[u.username] || ''}
                        onChange={e => setPwdInputs(p => ({ ...p, [u.username]: e.target.value }))}
                        className="border border-gray-300 rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                      <button
                        onClick={() => handlePasswordChange(u.username)}
                        disabled={!pwdInputs[u.username] || pwdLoading[u.username]}
                        className="text-xs text-brand hover:underline disabled:opacity-40"
                      >
                        עדכן
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.role !== 'admin' && (
                      <button
                        onClick={() => handleDelete(u.username)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        מחק
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
