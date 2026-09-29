import type { ReactNode } from 'react';

export function Disclosure({ summary, children, tone = 'plain' }: { summary: string; children: ReactNode; tone?: 'plain' | 'amber' }) {
  return (
    <details className={`disclosure disclosure--${tone}`}>
      <summary>{summary}</summary>
      <div className="disclosure__body">{children}</div>
    </details>
  );
}
