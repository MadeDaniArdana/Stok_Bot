/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Aplikasi tidak memakai next/image (foto bukti diproses sharp lewat route API terautentikasi).
  // Menonaktifkan /_next/image menutup seluruh permukaan serangan Image Optimization API.
  images: {
    unoptimized: true,
  },
  // sharp adalah modul native; jangan di-bundle bundler server.
  // optimizePackageImports memperkecil bundle ikon & chart via tree-shaking barrel exports.
  serverExternalPackages: ['sharp'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  async headers() {
    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // camera=(self) dipertahankan karena halaman /proof/[token] & /proof/uji-kamera memakai kamera perangkat.
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      ...(process.env.NODE_ENV === 'production'
        ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
        : []),
    ];
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/logo-yayasan.png',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ];
  },
  async redirects() {
    return [
      {
        // Halaman lama Barang Masuk kini berupa modal di /products.
        // Dialihkan di level routing (tanpa menjalankan serverless function);
        // query lama seperti ?productId=...&mode=new ikut diteruskan otomatis.
        source: '/stock/in',
        destination: '/products?entry=stock',
        permanent: false,
      },
      // Menu distribusi dipecah per jenis: /distribution/atk, /distribution/listrik, /distribution/logistik.
      { source: '/distribution', destination: '/distribution/atk', permanent: false },
      { source: '/distribution-reports', destination: '/distribution-reports/atk', permanent: false },
    ];
  },
};

export default nextConfig;
