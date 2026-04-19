import { useState, useEffect } from 'react';
import api from '../api';

export default function InviteCodes() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(null);

  const fetchCodes = async () => {
    try {
      const { data } = await api.getInviteCodes();
      setCodes(data);
    } catch (err) {
      // silenced
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCodes(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.createInviteCode({ note: note.trim() || undefined });
      setNote('');
      fetchCodes();
    } catch (err) {
      alert('Failed to generate code');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this invite code?')) return;
    try {
      await api.deleteInviteCode(id);
      fetchCodes();
    } catch (err) {
      alert('Failed to delete code');
    }
  };

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const active = codes.filter(c => c.is_active && !c.used_by_tenant_id && (!c.expires_at || new Date(c.expires_at) > new Date()));
  const used = codes.filter(c => c.used_by_tenant_id);
  const inactive = codes.filter(c => !c.is_active || (c.expires_at && new Date(c.expires_at) <= new Date() && !c.used_by_tenant_id));

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Invite Codes</h1>
        <p className="text-sm text-gray-500 mt-1">Generate single-use invite codes for new customers</p>
      </div>

      {/* Generate New Code */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Generate New Code</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Optional note (e.g. customer name)"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-slate-400"
            maxLength={200}
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap"
          >
            {generating ? 'Generating...' : 'Generate Code'}
          </button>
        </div>
      </div>

      {/* Active Codes */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-700">Active Codes ({active.length})</h2>
        </div>
        {active.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">No active codes. Generate one above.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {active.map(c => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-medium text-gray-900 bg-gray-50 px-2.5 py-1 rounded">{c.code}</span>
                  {c.note && <span className="text-xs text-gray-400">{c.note}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {c.expires_at && (
                    <span className="text-xs text-gray-400">
                      Expires {new Date(c.expires_at).toLocaleDateString()}
                    </span>
                  )}
                  <button onClick={() => handleCopy(c.code)}
                    className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
                    {copied === c.code ? 'Copied!' : 'Copy'}
                  </button>
                  <button onClick={() => handleDelete(c.id)}
                    className="px-2.5 py-1 text-xs text-red-500 hover:text-red-700 border border-gray-200 rounded-lg hover:bg-red-50">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Used Codes */}
      {used.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-700">Used Codes ({used.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {used.map(c => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-gray-400 line-through bg-gray-50 px-2.5 py-1 rounded">{c.code}</span>
                  {c.note && <span className="text-xs text-gray-400">{c.note}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>Used by <span className="text-gray-600 font-medium">{c.used_by_business || 'Unknown'}</span></span>
                  <span>{new Date(c.used_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inactive/Expired */}
      {inactive.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-500">Expired / Deactivated ({inactive.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {inactive.map(c => (
              <div key={c.id} className="px-5 py-3 flex items-center gap-3 text-xs text-gray-400">
                <span className="font-mono bg-gray-50 px-2.5 py-1 rounded">{c.code}</span>
                {c.note && <span>{c.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
