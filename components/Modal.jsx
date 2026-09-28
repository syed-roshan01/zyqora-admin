'use client';
import { useEffect } from 'react';

/**
 * Consistent modal shell: ESC to close, backdrop click to close (both blocked
 * while `busy`), animated open, sticky header/footer. Body + footer content
 * are passed as children so forms keep their own submit handling.
 */
export default function Modal({ title, onClose, children, maxWidth = 520, busy = false, closeable = true, backdropClose = true }) {
    useEffect(() => {
        if (!closeable) return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !busy) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, busy, closeable]);

    return (
        <div
            className="modal-overlay"
            onClick={e => { if (e.target === e.currentTarget && closeable && backdropClose && !busy) onClose(); }}
        >
            <div className="modal" style={maxWidth ? { maxWidth } : undefined} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
                <div className="modal-header">
                    <span className="modal-title">{title}</span>
                    {closeable && (
                        <button className="modal-close" onClick={onClose} disabled={busy} aria-label="Close">×</button>
                    )}
                </div>
                {children}
            </div>
        </div>
    );
}
