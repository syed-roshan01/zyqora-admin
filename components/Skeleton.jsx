'use client';

// Shimmer loading placeholders used while pages fetch data — replaces the
// old plain "Loading…" text so the layout doesn't jump when data arrives.

export function TableSkeleton({ rows = 7 }) {
    return (
        <div className="table-wrap" style={{ background: 'var(--bg-panel)' }}>
            <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton" style={{ width: '38%', height: 11 }} />
            </div>
            {Array.from({ length: rows }).map((_, i) => (
                <div className="skeleton-row" key={i} style={{ display: 'flex', gap: 18 }}>
                    <div className="skeleton" style={{ width: `${18 + ((i * 13) % 22)}%`, height: 14 }} />
                    <div className="skeleton" style={{ width: `${14 + ((i * 7) % 18)}%`, height: 14 }} />
                    <div className="skeleton" style={{ width: `${10 + ((i * 11) % 15)}%`, height: 14, marginLeft: 'auto' }} />
                </div>
            ))}
        </div>
    );
}

export function CardsSkeleton({ cards = 4 }) {
    return (
        <div className="skeleton-cards">
            {Array.from({ length: cards }).map((_, i) => (
                <div className="skeleton-card" key={i}>
                    <div className="skeleton" style={{ width: '45%', height: 11, marginBottom: 14 }} />
                    <div className="skeleton" style={{ width: '70%', height: 26, marginBottom: 10 }} />
                    <div className="skeleton" style={{ width: '55%', height: 11 }} />
                </div>
            ))}
        </div>
    );
}
