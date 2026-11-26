export function ReportLetterhead({ variant = 'report' }: { variant?: 'report' | 'request' }) {
  const isRequest = variant === 'request';

  return (
    <header className={isRequest ? '' : 'border-b-2 border-black pb-2 text-center'}>
      <img
        src="/kop-pengajuan-atk.png"
        width={719}
        height={138}
        alt="Universitas Teknokrat Indonesia"
        className={isRequest ? 'h-auto w-[44%]' : 'mx-auto h-auto w-full max-w-[32rem]'}
      />
      {!isRequest && <p className="text-[11px] font-semibold">Bagian Umum dan Rumah Tangga</p>}
    </header>
  );
}
