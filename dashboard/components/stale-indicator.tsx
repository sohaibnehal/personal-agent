export function StaleIndicator() {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0 5px',
        lineHeight: '16px',
        border: '1px solid var(--accent)',
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--accent)',
        verticalAlign: 'middle',
      }}
    >
      STALE
    </span>
  );
}
