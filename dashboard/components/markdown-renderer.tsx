'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

// Relay heading treatments — mirror the card header's label system.
// h2 = section break (source-label style: Inter 800, uppercase, hairline top rule)
// h3 = sub-section  (account-label style: mono, uppercase, muted)
// h4 = item label   (Inter 600, normal case, text1)
const components: Components = {
  h2: ({ children }) => (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        marginTop: '20px',
        paddingTop: '12px',
        marginBottom: '8px',
        fontFamily: '"Inter", sans-serif',
        fontWeight: 800,
        fontSize: '11px',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--text1)',
      }}
    >
      {children}
    </div>
  ),
  h3: ({ children }) => (
    <div
      style={{
        marginTop: '14px',
        marginBottom: '4px',
        fontFamily: '"JetBrains Mono", monospace',
        fontWeight: 500,
        fontSize: '10px',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--text3)',
      }}
    >
      {children}
    </div>
  ),
  h4: ({ children }) => (
    <div
      style={{
        marginTop: '10px',
        marginBottom: '2px',
        fontFamily: '"Inter", sans-serif',
        fontWeight: 700,
        fontSize: '13px',
        color: 'var(--text1)',
      }}
    >
      {children}
    </div>
  ),
  a: ({ href, children, ...props }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
};

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="relay-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
