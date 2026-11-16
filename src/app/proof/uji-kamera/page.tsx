'use client';
// SEMENTARA: uji kamera tanpa DB. Hapus folder ini setelah selesai.
import { TaskProofPage } from '@/components/tasks/TaskProofPage';

if (typeof window !== 'undefined' && !(window as any).__mocked) {
  (window as any).__mocked = true;
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/api/tasks/proof/')) {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ error: 'MODE UJI: tidak dikirim ke server.' }), { status: 400 });
      }
      return new Response(JSON.stringify({
        productName: 'Kabel Uji', quantity: 1, unit: 'pcs', assigneeName: 'Tester', location: 'Lokal',
        notes: null, status: 'PENDING', completedAt: null, photoUrl: null,
      }));
    }
    return real(input, init);
  };
}

export default function Page() {
  return <TaskProofPage token="test" />;
}
