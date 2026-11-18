'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, LoaderCircle, Package, MapPin, AlertCircle } from 'lucide-react';
import { BrowserErrorReporter } from '@/components/BrowserErrorReporter';

interface TaskDetails {
  productName: string;
  quantity: number;
  unit: string;
  assigneeName: string;
  location: string;
  notes: string | null;
  status: string;
  completedAt: string | null;
  photoUrl: string | null;
  /** Ringkasan beberapa barang (distribusi); jika ada, dipakai menggantikan nama + jumlah. */
  itemsSummary?: string;
  /** Lokasi pemasangan (distribusi listrik); tiap lokasi butuh foto sendiri jika lebih dari satu. */
  locations?: { location: string; items: string; done: boolean; photoUrl: string | null }[];
}

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Mengecilkan foto di HP sebelum diunggah: sisi terpanjang maksimal 1600 px, JPEG kualitas 80%.
 * Foto kamera 3–8 MB biasanya menjadi 200–400 KB. Jika gagal, file asli dipakai.
 */
async function compressPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob || (blob.size >= file.size && file.type === 'image/jpeg')) return file;
    return new File([blob], 'bukti.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** Dipakai untuk tugas pemasangan Telegram (/api/tasks/proof) dan distribusi listrik (/api/distributions/proof). */
export function TaskProofPage({ token, apiBase = '/api/tasks/proof' }: { token: string; apiBase?: string }) {
  const [task, setTask] = useState<TaskDetails | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [sizeInfo, setSizeInfo] = useState('');
  const [activeLocation, setActiveLocation] = useState('');

  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [canSwitch, setCanSwitch] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };
  const stopCamera = () => {
    stopStream();
    setCameraOn(false);
  };
  useEffect(() => stopStream, []);

  // Minta izin kamera (HTTPS wajib). Gagal/ditolak -> pakai input file.
  const startStream = async (mode: 'environment' | 'user') => {
    stopStream();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    streamRef.current = stream;
    setFacing(mode);
    setCameraOn(true);
    navigator.mediaDevices.enumerateDevices()
      .then((devices) => setCanSwitch(devices.filter((d) => d.kind === 'videoinput').length > 1))
      .catch(() => {});
  };

  // Pasang stream setelah <video> tampil. iOS Safari butuh atribut muted & playsinline di DOM,
  // kalau tidak videonya tetap hitam.
  useEffect(() => {
    const video = videoRef.current;
    if (!cameraOn || !video || !streamRef.current) return;
    video.muted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.srcObject = streamRef.current;
    video.play().catch(() => {});
  }, [cameraOn, facing]);

  const openCamera = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      document.getElementById('proof-photo')?.click();
      return;
    }
    try {
      await startStream(facing);
    } catch (cameraError) {
      const denied = cameraError instanceof DOMException && cameraError.name === 'NotAllowedError';
      setError(
        denied
          ? 'Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser, atau pakai tombol "Pilih dari galeri".'
          : 'Kamera tidak bisa dibuka di perangkat ini. Gunakan tombol "Pilih dari galeri".'
      );
    }
  };

  const switchCamera = async () => {
    try {
      await startStream(facing === 'environment' ? 'user' : 'environment');
    } catch {
      setError('Kamera lain tidak bisa dibuka.');
    }
  };

  const takeSnapshot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      stopCamera();
      handlePhotoSelected(new File([blob], 'bukti.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  };

  const handlePhotoSelected = async (file: File | null) => {
    setError('');
    setSizeInfo('');
    if (!file) {
      setPhoto(null);
      return;
    }
    setCompressing(true);
    const compressed = await compressPhoto(file);
    setCompressing(false);
    setPhoto(compressed);
    setSizeInfo(
      compressed === file
        ? `Ukuran foto: ${formatSize(file.size)}`
        : `Foto dikompres: ${formatSize(file.size)} → ${formatSize(compressed.size)}`
    );
  };

  useEffect(() => {
    fetch(`${apiBase}/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Tugas tidak dapat dimuat.');
        setTask(data);
        setActiveLocation(data.locations?.find((l: { done: boolean }) => !l.done)?.location ?? '');
      })
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [token, apiBase]);

  useEffect(() => {
    if (!photo) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const submitProof = async () => {
    if (!photo) {
      setError('Ambil foto pemasangan terlebih dahulu.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const body = new FormData();
      body.append('photo', photo);
      if (multi) body.append('location', activeLocation);
      const response = await fetch(`${apiBase}/${encodeURIComponent(token)}`, {
        method: 'POST',
        body,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Foto gagal dikirim.');
      const locations = task?.locations?.map((l) =>
        l.location === data.location
          ? { ...l, done: true, photoUrl: `${apiBase}/${encodeURIComponent(token)}/photo?location=${encodeURIComponent(l.location)}&t=${Date.now()}` }
          : l
      );
      setTask((current) => current ? {
        ...current,
        status: data.status,
        completedAt: data.completedAt,
        locations,
        photoUrl: multi ? null : `${apiBase}/${encodeURIComponent(token)}/photo`,
      } : current);
      setActiveLocation(locations?.find((l) => !l.done)?.location ?? '');
      setPhoto(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Foto gagal dikirim.');
    } finally {
      setSubmitting(false);
    }
  };

  const multi = (task?.locations?.length ?? 0) > 1;
  const pendingCount = task?.locations?.filter((l) => !l.done).length ?? 0;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <BrowserErrorReporter />
      <section className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-maroon-900 px-6 py-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-maroon-100">StockFlow</p>
          <h1 className="mt-1 text-xl font-bold">Bukti Pemasangan Barang</h1>
        </div>

        <div className="space-y-5 p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Memuat tugas...
            </div>
          ) : error && !task ? (
            <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
          ) : task ? (
            <>
              <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <Package className="mt-0.5 h-5 w-5 text-maroon-800" />
                  <div>
                    <p className="text-xs text-slate-500">Barang dan jumlah</p>
                    <p className="font-semibold text-slate-900">{task.itemsSummary ?? `${task.productName} - ${task.quantity} ${task.unit}`}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 text-maroon-800" />
                  <div>
                    <p className="text-xs text-slate-500">Pemasang dan lokasi</p>
                    <p className="font-semibold text-slate-900">{task.assigneeName} - {task.location}</p>
                  </div>
                </div>
                {task.notes && <p className="border-t border-slate-200 pt-3 text-sm text-slate-600">{task.notes}</p>}
              </div>

              {multi && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-700">
                    Lokasi pemasangan ({task.locations!.length - pendingCount}/{task.locations!.length} sudah difoto)
                  </p>
                  {task.locations!.map((l) => (
                    <button
                      key={l.location}
                      type="button"
                      disabled={l.done || task.status === 'COMPLETED'}
                      onClick={() => { setActiveLocation(l.location); setPhoto(null); setError(''); }}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${
                        l.done ? 'border-emerald-200 bg-emerald-50' : l.location === activeLocation ? 'border-maroon-700 bg-maroon-50' : 'border-slate-200'
                      }`}
                    >
                      {l.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <MapPin className="h-5 w-5 shrink-0 text-maroon-800" />}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900">{l.location}</span>
                        <span className="block text-xs text-slate-500">{l.items}</span>
                        <span className={`block text-[11px] font-semibold ${l.done ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {l.done ? 'Foto sudah diterima' : l.location === activeLocation ? 'Ambil foto di bawah' : 'Ketuk untuk memilih'}
                        </span>
                      </span>
                      {l.done && l.photoUrl && <img src={l.photoUrl} alt={`Bukti ${l.location}`} className="h-14 w-14 shrink-0 rounded-lg object-cover" />}
                    </button>
                  ))}
                </div>
              )}

              {task.status === 'COMPLETED' ? (
                <div className="space-y-3 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                  <p className="font-semibold text-emerald-800">Bukti berhasil diterima. Tugas selesai.</p>
                  {task.photoUrl && (
                    <img src={task.photoUrl} alt="Bukti pemasangan" className="mx-auto max-h-80 rounded-xl object-contain" />
                  )}
                  {task.completedAt && (
                    <p className="text-xs text-slate-500">
                      {new Date(task.completedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-700">
                      Foto bukti pemasangan{multi && activeLocation ? `: ${activeLocation}` : ''}
                    </p>
                    {cameraOn ? (
                      <div className="space-y-2">
                        <video ref={videoRef} playsInline muted autoPlay className={`w-full rounded-xl bg-black ${facing === 'user' ? '-scale-x-100' : ''}`} />
                        <div className="flex gap-2">
                          <button type="button" onClick={takeSnapshot} className="flex-1 rounded-xl bg-maroon-800 px-4 py-3 text-sm font-semibold text-white hover:bg-maroon-900">
                            Ambil Foto
                          </button>
                          {canSwitch && (
                            <button type="button" onClick={switchCamera} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">
                              {facing === 'environment' ? 'Kamera Depan' : 'Kamera Belakang'}
                            </button>
                          )}
                          <button type="button" onClick={stopCamera} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button type="button" onClick={openCamera} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-maroon-50 px-4 py-3 text-sm font-semibold text-maroon-900">
                          <Camera className="h-4 w-4" /> {photo ? 'Foto Ulang' : 'Buka Kamera'}
                        </button>
                        <label htmlFor="proof-photo" className="cursor-pointer rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">
                          Pilih dari galeri
                        </label>
                      </div>
                    )}
                    <input
                      id="proof-photo"
                      type="file"
                      accept="image/*"
                      onChange={(event) => handlePhotoSelected(event.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      {compressing
                        ? 'Mengecilkan ukuran foto...'
                        : sizeInfo || 'Browser akan meminta izin kamera. Foto otomatis dikecilkan.'}
                    </p>
                  </div>
                  {previewUrl && <img src={previewUrl} alt="Pratinjau bukti" className="max-h-80 w-full rounded-xl object-contain" />}
                  {error && (
                    <p className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={submitProof}
                    disabled={!photo || submitting || compressing}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-maroon-800 px-4 py-3 text-sm font-semibold text-white hover:bg-maroon-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    {submitting ? 'Mengirim bukti...' : multi ? `Kirim Foto ${activeLocation}` : 'Kirim Bukti Pemasangan'}
                  </button>
                </>
              )}
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
