import { useState, useCallback, createContext, useContext } from 'react';

const Ctx = createContext();

export function useToast() { return useContext(Ctx); }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const success = useCallback((m) => toast(m, 'success'), [toast]);
  const error   = useCallback((m) => toast(m, 'error'), [toast]);
  const warn    = useCallback((m) => toast(m, 'warn'), [toast]);

  return (
    <Ctx.Provider value={{ toast, success, error, warn }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-slide-up
            ${t.type === 'success' ? 'bg-green-600 text-white' :
              t.type === 'error' ? 'bg-red-600 text-white' :
              t.type === 'warn' ? 'bg-yellow-500 text-white' :
              'bg-gray-800 text-white'}`}>
            {t.type === 'success' && <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
            {t.type === 'error' && <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
            {t.type === 'warn' && <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
