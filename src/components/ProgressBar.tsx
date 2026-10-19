export function ProgressBar({ value, label }: { value: number; label: string }) {
  const rounded = Math.round(value);
  return (
    <div className="progress">
      <div
        className="progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rounded}
      >
        <div className="progress__bar" style={{ width: `${rounded}%` }} />
      </div>
      <span className="progress__value">{rounded}% complete</span>
    </div>
  );
}
