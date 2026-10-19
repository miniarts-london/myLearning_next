import LinearProgress from '@mui/material/LinearProgress';

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const rounded = Math.round(value);
  return (
    <div className="progress">
      {/* LinearProgress sets role="progressbar" and aria-valuenow itself. */}
      <LinearProgress variant="determinate" value={rounded} color="success" aria-label={label} />
      <span className="progress__value">{rounded}% complete</span>
    </div>
  );
}
