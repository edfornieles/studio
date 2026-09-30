export function Meter({ value, label, detail, tone = 'green' }: { value: number; label: string; detail?: string; tone?: 'green' | 'amber' }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={`meter meter--${tone}`}>
      <div className="meter__row">
        <span className="meter__label">{label}</span>
        <span className="meter__value">{detail ?? `${pct}%`}</span>
      </div>
      <div className="meter__track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
        <div className="meter__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
