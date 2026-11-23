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

// Dijalankan sebelum halaman digambar agar sidebar ringkas tidak sempat tampil penuh lalu menyusut.
const SIDEBAR_INIT = `try{if(localStorage.getItem('stockflow:sidebar-collapsed')==='1')document.documentElement.dataset.sidebar='mini'}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_INIT }} />
      </head>
      <body className="font-sans antialiased selection:bg-maroon-100 selection:text-maroon-900">
        {children}
      </body>
    </html>
  );
}
