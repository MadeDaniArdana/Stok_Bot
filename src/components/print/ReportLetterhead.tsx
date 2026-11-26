export function ReportLetterhead({ subtitle = 'Bagian Umum dan Rumah Tangga', doubleRule = false }: {
  subtitle?: string;
  doubleRule?: boolean;
}) {
  return (
    <header className={`border-black pb-2 text-center ${doubleRule ? 'border-b-[3px] border-double' : 'border-b-2'}`}>
      <img
        src="/kop-pengajuan-atk.png"
        width={719}
        height={138}
        alt="Universitas Teknokrat Indonesia"
        className="mx-auto h-auto w-full max-w-[32rem]"
      />
      <p className="text-[11px] font-semibold">{subtitle}</p>
    </header>
  );
}
