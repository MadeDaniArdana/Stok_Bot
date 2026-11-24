import { AppLayout } from '@/components/layout/AppLayout';

export default function DivisiLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout variant="divisi">{children}</AppLayout>;
}
