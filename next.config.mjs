/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // sharp adalah modul native; jangan di-bundle webpack.
  // optimizePackageImports memperkecil bundle ikon & chart via tree-shaking barrel exports.
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  async headers() {
    return [
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
