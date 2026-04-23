import type { ReactNode } from 'react';

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 4,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="wb-eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>
        <h1
          className="wb-h-display"
          style={{ margin: 0, fontSize: 32, lineHeight: 1.1, color: 'var(--ink-0)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-2)', maxWidth: 720 }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div>}
    </header>
  );
}
