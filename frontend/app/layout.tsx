import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ChatNexa — AI WhatsApp Business Platform',
  description: "India's first no-monthly-fee WhatsApp platform. Pay only for what you use.",
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#2563EB' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
