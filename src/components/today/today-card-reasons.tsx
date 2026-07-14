import { AlertTriangle } from 'lucide-react';
import type { ReasonCode } from '../../types';

const SEVERITY_DOT: Record<ReasonCode['severity'], string> = {
  bad: 'bg-maf-red',
  warn: 'bg-amber-400',
  good: 'bg-emerald-400',
};

const BOOK_LABEL: Record<string, string> = {
  CH3: 'Ch3', CH4: 'Ch4', CH5: 'Ch5', CH6: 'Ch6', CH7: 'Ch7', CH8: 'Ch8', CH9: 'Ch9',
};

interface TodayCardReasonsProps {
  reasons: ReasonCode[];
}

/** "Vì sao có gợi ý này?" — signals + book citations that shaped today's plan. Hidden when there's nothing to explain. */
export default function TodayCardReasons({ reasons }: TodayCardReasonsProps) {
  if (reasons.length === 0) return null;

  return (
    <div className="pt-2 border-t border-white/10">
      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        Vì sao có gợi ý này?
      </h4>
      <ul className="space-y-1.5">
        {reasons.map((r) => (
          <li key={r.code} className="text-[12px] text-slate-300 flex items-start gap-2">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[r.severity]}`} />
            <span>
              {r.text}
              {r.bookRef && <span className="text-slate-500"> ({BOOK_LABEL[r.bookRef]})</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
