import { useState, useEffect, useRef } from 'react';
import api from '../api';

export default function Inbox() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [patient, setPatient] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => { loadConversations(); }, [search]);
  useEffect(() => { if (selected) loadMessages(selected); }, [selected]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Auto-refresh conversations every 15s (pauses when tab hidden)
  useEffect(() => {
    let interval;
    const start = () => { interval = setInterval(() => loadConversations(true), 15000); };
    const stop = () => clearInterval(interval);
    const onVisibility = () => { document.hidden ? stop() : start(); };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [search]);

  async function loadConversations(silent = false) {
    if (!silent) setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      const { data } = await api.getConversations(params);
      setConversations(data.conversations || []);
    } catch (e) {
      // load error silenced
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadMessages(patientId) {
    setLoadingMsgs(true);
    try {
      const { data } = await api.getConversationMessages(patientId);
      setMessages(data.messages || []);
      setPatient(data.patient);
    } catch (e) {
      // load error silenced
    } finally {
      setLoadingMsgs(false);
    }
  }

  async function handleSend() {
    if (!reply.trim() || !selected || sending) return;
    setSending(true);
    try {
      await api.sendReply(selected, reply.trim());
      setReply('');
      await loadMessages(selected);
      loadConversations(true);
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (isToday) return time;
    if (isYesterday) return `Yesterday ${time}`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' + time;
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] sm:h-[calc(100vh-1.5rem)] -m-4 sm:-m-6 bg-white rounded-xl overflow-hidden border border-gray-200">
      {/* Left: Conversation list */}
      <div className={`w-full sm:w-80 border-r border-gray-100 flex flex-col ${selected ? 'hidden sm:flex' : 'flex'}`}>
        <div className="p-3 border-b border-gray-100">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-sm text-gray-400">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-sm text-gray-400">No conversations yet</div>
          ) : (
            conversations.map(c => (
              <div key={c.patient_id}
                onClick={() => setSelected(c.patient_id)}
                role="button" tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setSelected(c.patient_id)}
                className={`px-4 py-3 cursor-pointer border-b border-gray-50 hover:bg-gray-50 transition
                  ${selected === c.patient_id ? 'bg-slate-50' : ''}`}>
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{c.name || 'Unknown'}</span>
                      {c.unread_count > 0 && (
                        <span className="flex-shrink-0 w-5 h-5 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{c.phone}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">{formatTime(c.last_message_at)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {c.last_direction === 'outbound' ? '↩ ' : ''}{c.last_message}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: Chat view */}
      <div className={`flex-1 flex flex-col ${selected ? 'flex' : 'hidden sm:flex'}`}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">
            Select a conversation to view messages
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
              <button onClick={() => setSelected(null)} className="sm:hidden text-gray-400 hover:text-gray-600" aria-label="Back to conversations">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-sm font-medium text-slate-600" aria-hidden="true">
                {(patient?.name || '?')[0].toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">{patient?.name || 'Unknown'}</div>
                <div className="text-xs text-gray-400">{patient?.phone}</div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
              {loadingMsgs ? (
                <div className="text-sm text-gray-400 text-center py-8">Loading messages...</div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap
                      ${msg.direction === 'outbound'
                        ? 'bg-slate-800 text-white rounded-br-md'
                        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'}`}>
                      <div>{msg.content || `[${msg.message_type}]`}</div>
                      <div className={`text-[10px] mt-1 ${msg.direction === 'outbound' ? 'text-slate-400' : 'text-gray-400'} text-right`}>
                        {formatTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply input */}
            <div className="p-3 border-t border-gray-100 bg-white">
              <div className="flex gap-2">
                <input value={reply} onChange={e => setReply(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Type a reply..."
                  aria-label="Reply message"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-slate-400" />
                <button onClick={handleSend} disabled={!reply.trim() || sending}
                  className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-xl hover:bg-slate-700 disabled:opacity-40 transition">
                  {sending ? '...' : 'Send'}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 px-1">
                Replies are sent via WhatsApp. Note: messages outside 24h window require a template.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
