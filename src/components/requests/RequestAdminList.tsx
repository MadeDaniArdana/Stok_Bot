'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, X, LoaderCircle, Printer, PenLine } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { refreshAdminPulse } from '@/lib/admin-pulse';
import { SearchCombobox, type ComboOption } from '@/components/ui/SearchCombobox';
import { SignaturePad } from '@/components/ui/SignaturePad';
import {
  fetchDistributionBootstrap,
  getCachedDistributionBootstrap,
  type DistributionBootstrapData,
} from '@/lib/distribution-bootstrap';
import { formatDateTime, itemName, itemQty, ItemsList, StatusBadge, type RequestRow } from './shared';
import type { StockGroup } from '@/lib/stock-groups';

const fieldClass = 'rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-500/20';

const todayInJakarta = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

const formatDay = (value: string) =>
  new Date(value).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' });

/** Form review satu pengajuan: jumlah ACC per barang, pemetaan barang di luar daftar, tanggal ACC, tanda tangan. */
function ReviewPanel({
  request,
  busy,
  onApprove,
  onReject,
}: {
  request: RequestRow;
  busy: boolean;
  onApprove: (payload: Record<string, unknown>) => void;
  onReject: () => void;
}) {
  const [acc, setAcc] = useState<Record<string, string>>(() => Object.fromEntries(request.items.map((i) => [i.id, String(i.quantity)])));
  const [notesByItem, setNotesByItem] = useState<Record<string, string>>(() =>
    Object.fromEntries(request.items.map((i) => [i.id, i.itemNotes ?? '']))
  );
  const [mapTo, setMapTo] = useState<Record<string, string>>({});
  const [noStock, setNoStock] = useState<Record<string, boolean>>({});
  const [date, setDate] = useState(todayInJakarta);
  const [recipientUnit, setRecipientUnit] = useState(request.divisionName);
  const [signature, setSignature] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [bootstrap, setBootstrap] = useState<DistributionBootstrapData | undefined>(() =>
    getCachedDistributionBootstrap(request.stockGroup as StockGroup)
  );

  useEffect(() => {
    fetchDistributionBootstrap(request.stockGroup as StockGroup)
      .then(setBootstrap)
      .catch(() => undefined);
  }, [request.stockGroup]);

  const products = bootstrap?.products ?? [];
  const recipientOptions = useMemo<ComboOption[]>(
    () => [
      ...(bootstrap?.templates ?? []).map((t) => ({
        value: t.recipientUnit,
        hint: t.name !== t.recipientUnit ? `Paket: ${t.name}` : undefined,
      })),
      ...(bootstrap?.recipients ?? []).map((value) => ({ value })),
    ],
    [bootstrap]
  );

  const submit = () => {
    onApprove({
      date,
      recipientUnit,
      adminSignature: signature,
      items: request.items.map((item) => ({
        id: item.id,
        approvedQuantity: Number(acc[item.id] || 0),
        itemNotes: notesByItem[item.id] ?? '',
        productId: item.product ? undefined : mapTo[item.id] || undefined,
        noStock: item.product ? undefined : Boolean(noStock[item.id]),
      })),
    });
  };

  const allZero = request.items.every((i) => !(Number(acc[i.id]) > 0));

  return (
    <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
      <p className="text-xs font-semibold text-emerald-900">Review: tentukan jumlah yang di-ACC</p>
      <div className="divide-y divide-emerald-100 rounded-lg border border-emerald-100 bg-white text-sm">
        {request.items.map((item) => {
          const custom = !item.product;
          const mapped = mapTo[item.id];
          return (
            <div key={item.id} className="space-y-1.5 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">
                    {itemName(item)}
                    {custom && <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Di luar daftar</span>}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Kebutuhan: {itemQty(item, item.quantity)}
                    {item.specification && <> · Spek: {item.specification}</>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <label htmlFor={`acc-${item.id}`} className="text-[11px] font-semibold text-slate-600">ACC</label>
                  <input
                    id={`acc-${item.id}`}
                    type="number"
                    min={0}
                    step={1}
                    value={acc[item.id] ?? ''}
                    onChange={(e) => setAcc((cur) => ({ ...cur, [item.id]: e.target.value }))}
                    className={`${fieldClass} w-20 !py-1.5`}
                  />
                  <span className="text-xs text-slate-500">{item.product?.unit ?? item.customUnit}</span>
                  <input
                    value={notesByItem[item.id] ?? ''}
                    onChange={(e) => setNotesByItem((cur) => ({ ...cur, [item.id]: e.target.value }))}
                    maxLength={150}
                    placeholder="Ket. (opsional)"
                    aria-label={`Keterangan ${itemName(item)}`}
                    className={`${fieldClass} w-36 !py-1.5 text-xs`}
                  />
                </div>
              </div>
              {custom && Number(acc[item.id]) > 0 && (
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                  <select
                    aria-label={`Petakan ${itemName(item)} ke barang master`}
                    value={noStock[item.id] ? '__NOSTOCK__' : mapped ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNoStock((cur) => ({ ...cur, [item.id]: v === '__NOSTOCK__' }));
                      setMapTo((cur) => ({ ...cur, [item.id]: v === '__NOSTOCK__' ? '' : v }));
                    }}
                    className={`${fieldClass} flex-1 !py-1.5`}
                  >
                    <option value="">Pilih barang master yang sesuai...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (stok {p.currentStock} {p.unit})
                      </option>
                    ))}
                    <option value="__NOSTOCK__">Tanpa stok (tidak mengurangi stok)</option>
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`date-${request.id}`} className="mb-1 block text-xs font-semibold text-slate-700">Tanggal ACC</label>
          <input id={`date-${request.id}`} type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={`${fieldClass} w-full`} />
          <p className="mt-0.5 text-[11px] text-slate-500">Bisa pilih tanggal hari ini, maju (jadwal ACC), atau mundur. Tercetak di formulir &amp; distribusi.</p>
        </div>
        <div>
          <label htmlFor={`recipient-${request.id}`} className="mb-1 block text-xs font-semibold text-slate-700">
            Kepada &amp; Tempat Penyimpanan <span className="text-rose-500">*</span>
          </label>
          <SearchCombobox
            id={`recipient-${request.id}`}
            required
            value={recipientUnit}
            onChange={setRecipientUnit}
            options={recipientOptions}
            placeholder="Pilih paket distribusi atau ketik nama unit"
            className="!py-2 !text-sm"
          />
          <p className="mt-0.5 text-[11px] text-slate-500">Tercetak sama pada baris Kepada &amp; kolom Tempat Penyimpanan di PDF.</p>
        </div>
      </div>

      {signing ? (
        <div className="sm:max-w-sm">
          <SignaturePad label="Tanda tangan admin (opsional)" onChange={setSignature} height={110} />
        </div>
      ) : (
        <button type="button" onClick={() => setSigning(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-maroon-800 hover:underline">
          <PenLine className="h-3.5 w-3.5" /> Tambah tanda tangan admin (opsional)
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || request.status === 'PROCESSING' || allZero || !recipientUnit.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Setujui (ACC)
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <X className="h-4 w-4" /> Tolak
        </button>
      </div>
    </div>
  );
}

/** Daftar pengajuan untuk admin: "incoming" (bisa di-ACC/ditolak) atau "history". */
export function RequestAdminList({ view }: { view: 'incoming' | 'history' }) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/requests?view=${view}`, { cache: 'no-store' });
    if (res.ok) setRows(await res.json());
  }, [view]);

  useEffect(() => {
    load();
    // Pop-up pengingat memberi sinyal ini saat ada pengajuan baru masuk.
    window.addEventListener('requests-changed', load);
    return () => window.removeEventListener('requests-changed', load);
  }, [load]);

  const act = async (id: string, action: 'approve' | 'reject', payload: Record<string, unknown> = {}) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/requests/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'reject' ? { reason } : payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal memproses pengajuan.');
      showToast(
        action === 'approve' ? 'Pengajuan Disetujui' : 'Pengajuan Ditolak',
        action === 'approve'
          ? data.request.distributionNumber
            ? `Stok dikurangi dan tercatat di Distribusi ${data.request.distributionNumber}.`
            : 'Tercatat tanpa pengurangan stok.'
          : undefined
      );
      setRejectingId(null);
      setReason('');
      await load();
      refreshAdminPulse(true);
    } catch (err: any) {
      showToast('Gagal', err.message, 'error');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const title = useMemo(() => (view === 'incoming' ? 'Pengajuan Masuk' : 'Riwayat Pengajuan'), [view]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="text-xs text-slate-500">
          {view === 'incoming'
            ? 'Pengajuan barang dari divisi. Tentukan jumlah ACC dan tanggalnya; stok berkurang dan tercatat di Distribusi.'
            : 'Pengajuan yang sudah disetujui atau ditolak. Formulir PDF bisa dicetak dari sini.'}
        </p>
      </div>

      {rows === null ? (
        <p className="py-10 text-center text-sm text-slate-400">Memuat...</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          {view === 'incoming' ? 'Tidak ada pengajuan yang menunggu.' : 'Belum ada riwayat pengajuan.'}
        </p>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs font-bold text-maroon-800">{r.number}</p>
                <p className="text-sm font-semibold text-slate-900">
                  {view === 'incoming' ? `Dari: ${r.divisionName}` : `Kepada: ${r.divisionName}`}
                </p>
                <p className="text-[11px] text-slate-500">
                  {r.stockGroup === 'ATK' ? 'ATK' : 'Logistik'} • oleh {r.receiverName || r.requesterName} • diajukan {formatDateTime(r.createdAt)}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </div>

            {view === 'incoming' ? (
              <>
                {r.notes && <p className="text-xs text-slate-600">Catatan: {r.notes}</p>}
                {rejectingId === r.id ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      autoFocus
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={300}
                      placeholder="Alasan penolakan (wajib)"
                      className={`${fieldClass} flex-1`}
                    />
                    <button
                      onClick={() => act(r.id, 'reject')}
                      disabled={busyId === r.id || !reason.trim()}
                      className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Kirim Penolakan
                    </button>
                    <button onClick={() => { setRejectingId(null); setReason(''); }} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                      Batal
                    </button>
                  </div>
                ) : (
                  <ReviewPanel request={r} busy={busyId === r.id} onApprove={(payload) => act(r.id, 'approve', payload)} onReject={() => setRejectingId(r.id)} />
                )}
              </>
            ) : (
              <>
                <ItemsList items={r.items} />
                {r.notes && <p className="text-xs text-slate-600">Catatan: {r.notes}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    {r.status === 'APPROVED'
                      ? `Di-ACC ${r.decidedByName ?? ''} • ${r.approvedDate ? formatDay(r.approvedDate) : r.decidedAt ? formatDateTime(r.decidedAt) : ''} • Distribusi ${r.distributionNumber ?? '(tanpa pengurangan stok)'}`
                      : `Ditolak ${r.decidedByName ?? ''} • ${r.decidedAt ? formatDateTime(r.decidedAt) : ''} • Alasan: ${r.rejectReason ?? '-'}`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/print/request/${r.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Printer className="h-3.5 w-3.5" /> Cetak Pengajuan
                    </a>
                    {r.status === 'APPROVED' && r.distributionId && (
                      <a
                        href={`/print/distribution/${r.distributionId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-maroon-200 bg-maroon-50 px-3 py-1.5 text-xs font-semibold text-maroon-800 hover:bg-maroon-100"
                      >
                        <Printer className="h-3.5 w-3.5" /> Cetak Form Distribusi
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
