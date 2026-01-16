import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PulseCal SecureBand',
  description: 'Government wearable monitoring platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
