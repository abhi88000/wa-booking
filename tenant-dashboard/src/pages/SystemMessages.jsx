// ============================================================
// SystemMessages — Standalone page (sidebar entry).
// Lets users edit all bot messages outside the Flow Builder.
// ============================================================
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';
import MessagesPanel from './FlowBuilder/MessagesPanel';
import { Ico } from './FlowBuilder/icons';

export default function SystemMessages() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [overrides, setOverrides] = useState({});
  const [originalOverrides, setOriginalOverrides] = useState({});
  const [flowConfig, setFlowConfig] = useState({});
  const [labels, setLabels] = useState({});

  const focusId = new URLSearchParams(location.search).get('focus');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.getFlowConfig();
        setFlowConfig(data.flow_config || {});
        setLabels(data.labels || {});
        setOverrides(data.messages || {});
        setOriginalOverrides(data.messages || {});
      } catch (e) {
        setError('Failed to load messages');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const dirty = JSON.stringify(overrides) !== JSON.stringify(originalOverrides);

  const doSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.saveFlowConfig({ flow_config: flowConfig, labels, messages: overrides });
      setOriginalOverrides(overrides);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const doDiscard = () => {
    setOverrides(originalOverrides);
    setError('');
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center text-slate-500">
        <div className="text-center">
          <Ico.spinner className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          Loading messages...
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Ico.message className="w-5 h-5 text-emerald-600" />
            Bot Messages
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Edit every message your WhatsApp bot sends — confirmations, reminders, errors, navigation.</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && !dirty && (
            <span className="text-sm text-emerald-600 inline-flex items-center gap-1">
              <Ico.check className="w-4 h-4" /> Saved
            </span>
          )}
          {dirty && !saving && (
            <button
              onClick={doDiscard}
              className="text-sm px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700"
            >
              Discard
            </button>
          )}
          <button
            onClick={doSave}
            disabled={!dirty || saving}
            className="text-sm px-4 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Ico.save className="w-4 h-4" /> {saving ? 'Saving...' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex-1 min-h-0 relative">
        <MessagesPanel
          overrides={overrides}
          onChange={setOverrides}
          focusId={focusId}
        />

        {/* Sticky save bar — appears over the list when there are unsaved changes */}
        {dirty && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2.5 bg-slate-900/95 backdrop-blur text-white rounded-full shadow-2xl border border-slate-700">
            <span className="text-sm flex items-center gap-2">
              <Ico.warn className="w-4 h-4 text-amber-400" />
              You have unsaved changes
            </span>
            <button
              onClick={doDiscard}
              disabled={saving}
              className="text-xs px-3 py-1 rounded-full text-slate-300 hover:text-white hover:bg-slate-700 transition disabled:opacity-50"
            >
              Discard
            </button>
            <button
              onClick={doSave}
              disabled={saving}
              className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white inline-flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Ico.save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
