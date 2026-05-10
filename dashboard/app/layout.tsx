import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Briefing Agent',
  description: 'Personal morning briefing dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
