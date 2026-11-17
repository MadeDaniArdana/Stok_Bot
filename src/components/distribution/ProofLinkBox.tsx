'use client';

import { useState } from 'react';
import { Camera, Check, Copy, MessageCircle } from 'lucide-react';
import { formatPhoneForDisplay } from '@/lib/phone';

export function buildProofUrl(token: string) {
  return `${window.location.origin}/proof/distribusi/${token}`;
}

/** Link foto bukti untuk petugas: salin atau kirim langsung lewat WhatsApp. */
export function ProofLinkBox({
  token,
  officerName,
  location,
  itemsLabel,
  phone,
}: {
  token: string;
  officerName: string;
  location: string;
  itemsLabel: string;
  /** No. WhatsApp petugas (format 62xxx). Tanpa nomor, hanya tombol Salin Link. */
  phone?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const url = buildProofUrl(token);
  const message =
    `Halo ${officerName}, mohon kirim foto bukti pemasangan ${itemsLabel} di ${location} melalui link berikut:\n${url}\n\n` +
    'Buka link, ambil foto hasil pemasangan, lalu tekan Kirim Bukti Pemasangan.';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Salin link foto bukti:', url);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
      <p className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
        <Camera className="h-4 w-4" aria-hidden="true" /> Link foto bukti untuk petugas
      </p>
      <p className="mt-1 text-[11px] text-amber-800">
        {phone
          ? `Kirim link ini ke ${officerName} lewat WhatsApp. Petugas cukup membuka link, memotret hasil pemasangan, lalu mengirimnya. Tidak perlu login.`
          : `Salin link ini lalu bagikan ke ${officerName}. Isi No. WhatsApp petugas di form agar bisa dikirim langsung lewat WhatsApp.`}
      </p>
      <input
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
        aria-label="Link foto bukti"
        className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 font-mono text-[11px] text-slate-700"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Tersalin' : 'Salin Link'}
        </button>
        {phone && (
          <a
            href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Kirim ke WhatsApp {formatPhoneForDisplay(phone)}
          </a>
        )}
      </div>
    </div>
  );
}
