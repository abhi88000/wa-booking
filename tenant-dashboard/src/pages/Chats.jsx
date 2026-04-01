import { useState, useEffect } from 'react';
import api from '../api';

export default function Chats() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await api.getPatients({ search: search || undefined, limit: 50 });
      setPatients(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openChat = async (patient) => {
    setSelectedPatient(patient);
    setLoadingChat(true);
    try {
      const { data } = await api.getChat(patient.id);
      setMessages(data.reverse());
    } catch (err) {
      setMessages([]);
    } finally { setLoadingChat(false); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    load();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">WhatsApp Chats</h1>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Patient List */}
        <div className={`${selectedPatient ? 'hidden sm:flex' : 'flex'} flex-col w-full sm:w-80 bg-white rounded-xl shadow-sm border overflow-hidden`}>
          <form onSubmit={handleSearch} className="p-3 border-b">
            <input placeholder="Search patients..." value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </form>
          <div className="flex-1 overflow-y-auto">
            {loading ? <div className="p-4 text-center text-gray-400 text-sm">Loading...</div> :
              patients.map(p => (
                <div key={p.id} onClick={() => openChat(p)}
                  className={`px-4 py-3 border-b cursor-pointer hover:bg-gray-50 transition ${selectedPatient?.id === p.id ? 'bg-indigo-50' : ''}`}>
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-sm text-gray-900">{p.name || 'Unknown'}</p>
                    <span className="text-xs text-gray-400">{p.total_appointments || 0} appts</span>
                  </div>
                  <p className="text-xs text-gray-400">{p.phone}</p>
                </div>
              ))
            }
            {!loading && patients.length === 0 && (
              <div className="p-4 text-center text-gray-400 text-sm">No patients found</div>
            )}
          </div>
        </div>

        {/* Chat View */}
        <div className={`${selectedPatient ? 'flex' : 'hidden sm:flex'} flex-col flex-1 bg-white rounded-xl shadow-sm border overflow-hidden`}>
          {selectedPatient ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b flex items-center gap-3">
                <button onClick={() => setSelectedPatient(null)} className="sm:hidden text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <p className="font-medium text-gray-900">{selectedPatient.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-400">{selectedPatient.phone}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {loadingChat ? (
                  <div className="text-center text-gray-400 text-sm py-10">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-10">No messages yet</div>
                ) : messages.map((m, i) => (
                  <div key={i} className={`flex ${m.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                      m.direction === 'outgoing'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                    }`}>
                      <p className="whitespace-pre-wrap">{m.message_body || m.content || '(media)'}</p>
                      <p className={`text-[10px] mt-1 ${m.direction === 'outgoing' ? 'text-indigo-200' : 'text-gray-400'}`}>
                        {new Date(m.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a patient to view chat history
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
