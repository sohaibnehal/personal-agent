export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      {/* Relay: a single red square as the only color on the canvas */}
      <span
        style={{
          display: 'inline-block',
          width: '10px',
          height: '10px',
          backgroundColor: 'var(--accent)',
        }}
      />
      <p
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '11px',
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text2)',
        }}
      >
        NO BRIEFINGS YET
      </p>
      <p
        style={{
          fontFamily: '"Inter", sans-serif',
          fontSize: '13px',
          color: 'var(--text3)',
          textAlign: 'center',
          maxWidth: '300px',
          lineHeight: 1.6,
        }}
      >
        Run the agent to generate your first briefing.
      </p>
    </div>
  );
}
