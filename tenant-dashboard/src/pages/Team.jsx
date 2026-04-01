import { useState, useEffect } from 'react';
import api from '../api';

const ROLES = ['admin', 'staff', 'doctor'];
const ROLE_COLOR = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  staff: 'bg-green-100 text-green-700',
  doctor: 'bg-indigo-100 text-indigo-700',
};

export default function Team() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await api.getTeam();
      setMembers(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.addTeamMember(form);
      setShowAdd(false);
      setForm({ name: '', email: '', password: '', role: 'staff' });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  };

  const toggleActive = async (m) => {
    await api.updateTeamMember(m.id, { isActive: !m.is_active });
    load();
  };

  const changeRole = async (m, role) => {
    await api.updateTeamMember(m.id, { role });
    load();
  };

  const handleDelete = async (m) => {
    if (!confirm(`Remove "${m.name || m.email}" from the team?`)) return;
    try {
      await api.deleteTeamMember(m.id);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-1">Manage who can access your dashboard</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
          + Invite Member
        </button>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Invite Team Member</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Name</label>
                <input placeholder="Full name" value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Email</label>
                <input type="email" placeholder="member@example.com" value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Temporary Password</label>
                <input type="text" placeholder="Set a password" value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Role</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">Admin: full access. Staff: view & manage appointments. Doctor: view own appointments.</p>
              </div>
              <div className="flex gap-3 justify-end mt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">Invite</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : (
          <>
            {/* Desktop */}
            <table className="w-full text-sm hidden sm:table">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {members.map(m => (
                  <tr key={m.id} className={`hover:bg-gray-50 ${m.is_active === false ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium">{m.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{m.email}</td>
                    <td className="px-4 py-3">
                      {m.role === 'owner' ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLOR[m.role]}`}>Owner</span>
                      ) : (
                        <select value={m.role} onChange={e => changeRole(m, e.target.value)}
                          className="text-xs border rounded px-2 py-1 outline-none">
                          {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {m.is_active !== false ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(m.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {m.role !== 'owner' && (
                        <div className="flex gap-2">
                          <button onClick={() => toggleActive(m)} className="text-xs text-indigo-600 hover:underline">
                            {m.is_active !== false ? 'Disable' : 'Enable'}
                          </button>
                          <button onClick={() => handleDelete(m)} className="text-xs text-red-500 hover:underline">Remove</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-400">No team members yet</td></tr>
                )}
              </tbody>
            </table>

            {/* Mobile */}
            <div className="sm:hidden divide-y">
              {members.map(m => (
                <div key={m.id} className={`p-4 ${m.is_active === false ? 'opacity-50' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{m.name || m.email}</p>
                      <p className="text-xs text-gray-400">{m.email}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLOR[m.role] || ROLE_COLOR.staff}`}>
                      {m.role}
                    </span>
                  </div>
                  {m.role !== 'owner' && (
                    <div className="flex gap-3 mt-3">
                      <button onClick={() => toggleActive(m)} className="text-xs text-indigo-600 hover:underline">
                        {m.is_active !== false ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => handleDelete(m)} className="text-xs text-red-500 hover:underline">Remove</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
