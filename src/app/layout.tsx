import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StockFlow - Inventory Management System',
  description: 'Sistem Pengelolaan Persediaan Berbasis Web dengan Integrasi Telegram',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="antialiased selection:bg-maroon-100 selection:text-maroon-900">
        {children}
      </body>
    </html>
  );
}
