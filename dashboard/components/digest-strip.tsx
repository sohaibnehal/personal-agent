'use client';

import { useEffect, useState } from 'react';

type DigestState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; text: string };

export function DigestStrip() {
  const [state, setState] = useState<DigestState>({ status: 'loading' });

  useEffect(() => {
    function load(lat?: number, lon?: number) {
      const qs = lat != null && lon != null ? `?lat=${lat}&lon=${lon}` : '';
      fetch(`/api/digest${qs}`)
        .then(async (res) => {
          if (!res.ok) { setState({ status: 'error' }); return; }
          const { digest } = await res.json();
          setState({ status: 'ok', text: digest });
        })
        .catch(() => setState({ status: 'error' }));
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => load(coords.latitude, coords.longitude),
        () => load(), // fallback to server-side default coords
        { timeout: 8000 }
      );
    } else {
      load();
    }
  }, []);

  const border = '1px solid var(--border)';

  return (
    <div
      style={{
        borderBottom: border,
        display: 'flex',
        alignItems: 'stretch',
        backgroundColor: 'var(--background)',
      }}
    >
      {/* Label */}
      <div
        style={{
          borderRight: border,
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            backgroundColor: 'var(--accent)',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 800,
            fontSize: '10px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--text1)',
            whiteSpace: 'nowrap',
          }}
        >
          Morning Digest
        </span>
      </div>

      {/* Content */}
      <div
        style={{
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          flex: 1,
        }}
      >
        {state.status === 'loading' && (
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '10px',
              letterSpacing: '0.1em',
              color: 'var(--text4)',
            }}
          >
            GENERATING...
          </span>
        )}
        {state.status === 'error' && (
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '10px',
              letterSpacing: '0.1em',
              color: 'var(--text4)',
            }}
          >
            DIGEST UNAVAILABLE
          </span>
        )}
        {state.status === 'ok' && (
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              lineHeight: 1.6,
              color: 'var(--text1)',
              margin: 0,
            }}
          >
            {state.text}
          </p>
        )}
      </div>
    </div>
  );
}
