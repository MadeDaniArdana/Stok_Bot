/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
    ];
  },
};

export default nextConfig;
