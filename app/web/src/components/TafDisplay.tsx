export interface TafData {
  icaoId: string;
  rawTAF: string;
  issueTime: string;
  validTimeFrom: string;
  validTimeTo: string;
}

export default function TafDisplay({ taf }: { taf: TafData }) {
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-slate-700 dark:text-slate-300 font-semibold">TAF — {taf.icaoId}</h3>
        <span className="text-slate-500 text-xs font-mono">
          Valid {taf.validTimeFrom} → {taf.validTimeTo}
        </span>
      </div>
      <pre className="text-slate-700 dark:text-slate-300 text-xs font-mono bg-slate-100 dark:bg-slate-950 rounded p-3 whitespace-pre-wrap break-all leading-relaxed">
        {taf.rawTAF}
      </pre>
    </div>
  );
}
