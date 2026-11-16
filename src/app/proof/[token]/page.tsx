'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  Package,
  Calendar,
  User,
  FileText,
  RotateCcw,
  Upload,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ImageIcon,
} from 'lucide-react';

export default function ProofCameraPage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [movement, setMovement] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Fetch movement info by token
  const fetchMovement = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/stock/proof/${token}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memuat informasi transaksi.');
      }

      setMovement(data.movement);
      if (data.movement.proofPhoto) {
        setCapturedPhoto(data.movement.proofPhoto);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchMovement();
    }
  }, [token]);

  // Client-side image compression using HTML5 Canvas
  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setCapturedPhoto(compressedDataUrl);
          setUploadSuccess(false);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleUploadProof = async () => {
    if (!capturedPhoto) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/stock/proof/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: capturedPhoto }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengunggah foto bukti.');
      }

      setUploadSuccess(true);
      fetchMovement();
    } catch (err: any) {
      alert(`Gagal: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-4 border-maroon-800 border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-700">Mempersiapkan Kamera & Data Barang...</p>
        <p className="text-xs text-slate-400 mt-1">StockFlow Proof of Usage</p>
      </div>
    );
  }

  if (error || !movement) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Link Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            {error || 'Link kamera bukti ini tidak valid atau sudah kadaluarsa. Silakan hubungi Admin Gudang.'}
          </p>
        </div>
      </div>
    );
  }

  const isAlreadySaved = Boolean(movement.proofPhoto) && !uploadSuccess && capturedPhoto === movement.proofPhoto;

  return (
    <div className="min-h-screen bg-[#FDFBFB] flex flex-col justify-between p-4 sm:p-6 max-w-lg mx-auto">
      {/* Header */}
      <header className="py-2 flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-maroon-700 to-maroon-950 text-white flex items-center justify-center font-bold text-xs shadow-sm">
            SF
          </div>
          <div>
            <h1 className="font-extrabold text-sm text-slate-900">StockFlow Bukti Fisik</h1>
            <p className="text-[10px] text-slate-400">Verifikasi Kamera Tanpa Login</p>
          </div>
        </div>

        <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          Terverifikasi
        </span>
      </header>

      {/* Main Body */}
      <main className="flex-1 py-4 space-y-4">
        {/* Info Card Barang Yang Diambil */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-soft space-y-3">
          <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-maroon-800 bg-maroon-50 px-2 py-0.5 rounded">
                Barang Dipakai
              </span>
              <h2 className="text-base font-extrabold text-slate-900 mt-1">
                {movement.productName}
              </h2>
              <p className="font-mono text-xs text-slate-400 mt-0.5">SKU: {movement.productSku}</p>
            </div>

            <div className="text-right">
              <span className="text-xl font-black text-maroon-800">
                {movement.quantity}
              </span>
              <span className="text-xs text-slate-500 font-bold ml-1">{movement.unit}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate">{movement.actorName}</span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {new Date(movement.createdAt).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {movement.notes && (
            <div className="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-100 flex items-start gap-2">
              <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="leading-snug">{movement.notes}</p>
            </div>
          )}
        </div>

        {/* Status Banner */}
        {uploadSuccess ? (
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 text-center space-y-1 animate-in fade-in zoom-in-95">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <h3 className="text-sm font-bold">Foto Bukti Berhasil Dikirim!</h3>
            <p className="text-xs text-emerald-700">
              Foto bukti pemakaian barang telah langsung tersimpan ke sistem web StockFlow. Terima kasih!
            </p>
          </div>
        ) : isAlreadySaved ? (
          <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold">Bukti foto sudah tersimpan</span>
            </div>
            <span className="text-[10px] text-emerald-600">
              {movement.proofUploadedAt
                ? new Date(movement.proofUploadedAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : ''}
            </span>
          </div>
        ) : (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Silakan ambil foto fisik barang yang telah Anda ambil sebagai pertanggungjawaban.</span>
          </div>
        )}

        {/* Hidden File Inputs for Native Camera & Gallery */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={cameraInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          type="file"
          accept="image/*"
          ref={galleryInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Camera / Photo Area */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-soft space-y-4">
          {capturedPhoto ? (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video sm:aspect-square flex items-center justify-center">
                <img
                  src={capturedPhoto}
                  alt="Bukti Pengambilan Barang"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full">
                  Foto Bukti Fisik
                </div>
              </div>

              {/* Action Buttons for Captured Photo */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Foto Ulang</span>
                </button>

                <button
                  type="button"
                  onClick={handleUploadProof}
                  disabled={isSubmitting || isAlreadySaved}
                  className="py-2.5 px-3 rounded-xl bg-maroon-800 hover:bg-maroon-900 active:bg-maroon-950 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Mengunggah...</span>
                  ) : isAlreadySaved ? (
                    <span>Sudah Tersimpan</span>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Kirim Bukti Foto</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-maroon-50 text-maroon-800 flex items-center justify-center mx-auto border border-maroon-200/80 shadow-sm">
                <Camera className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800">Ambil Foto Barang</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Arahkan kamera ke barang yang dipakai agar terlihat jelas.
                </p>
              </div>

              <div className="flex flex-col gap-2 max-w-xs mx-auto pt-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full py-3 px-4 rounded-xl bg-maroon-800 hover:bg-maroon-900 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>Buka Kamera Sekarang</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-full py-2 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Pilih dari Galeri Foto</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[10px] text-slate-400 py-3 border-t border-slate-100">
        StockFlow • Sistem Pergudangan & Verifikasi Bukti Fisik
      </footer>
    </div>
  );
}
