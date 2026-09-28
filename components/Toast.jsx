'use client';
import { createContext, useCallback, useContext, useState } from 'react';

// Global toast notifications. Mounted once in the root layout so every page
// (and modal, wherever it sits in the tree) can call useToast().

const ToastContext = createContext({ success: () => {}, error: () => {}, info: () => {} });

const ICONS = { success: '✓', error: '✕', info: 'ℹ' };

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const dismiss = useCallback((id) => {
        setToasts(t => t.filter(x => x.id !== id));
    }, []);

    const push = useCallback((type, message) => {
        const id = Math.random().toString(36).slice(2);
        setToasts(t => [...t.slice(-4), { id, type, message }]);
        setTimeout(() => dismiss(id), 4000);
    }, [dismiss]);

    const api = {
        success: (m) => push('success', m),
        error:   (m) => push('error', m),
        info:    (m) => push('info', m),
    };

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className="toast-stack" aria-live="polite">
                {toasts.map(t => (
                    <div key={t.id} className={`toast toast-${t.type}`} onClick={() => dismiss(t.id)} role="status">
                        <span className="toast-icon">{ICONS[t.type]}</span>
                        <span>{t.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);
