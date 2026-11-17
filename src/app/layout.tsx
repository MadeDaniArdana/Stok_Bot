import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

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
    <html lang="id" className={inter.variable}>
      <body className="font-sans antialiased selection:bg-maroon-100 selection:text-maroon-900">
        {children}
      </body>
    </html>
  );
}
