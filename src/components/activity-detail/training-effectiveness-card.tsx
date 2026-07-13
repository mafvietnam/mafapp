import { ClipboardCheck, Lightbulb } from 'lucide-react';
import type {
  CoachingInsight,
  EffectivenessTier,
  InsightSeverity,
} from '../../utils/maf-coaching-insights';

/**
 * Book-grounded training-effectiveness verdict + recommendations for one activity.
 * Pure render of a CoachingInsight (parent computes it via coachingInsights()).
 *
 * XSS discipline (mirrors activity-detail-sections.tsx): every string here is a
 * static Vietnamese literal or a literal with interpolated NUMBERS only. Strava
 * free text is never interpolated, and there is no dangerouslySetInnerHTML.
 */
interface TrainingEffectivenessCardProps {
  insight: CoachingInsight;
}

const TIER_BADGE: Record<EffectivenessTier, string> = {
  'aerobic-effective': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  mixed: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  'above-zone': 'bg-maf-red/10 text-maf-red border-maf-red/30',
};

const SEVERITY_DOT: Record<InsightSeverity, string> = {
  good: 'bg-emerald-400',
  warn: 'bg-maf-red',
  info: 'bg-white/40',
};

/** Chapter chip label — bookRef is a fixed union, no user data reaches it. */
function ChapterChip({ label }: { label: string }) {
  return (
    <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold text-white/40 bg-white/5">
      {label}
    </span>
  );
}

export default function TrainingEffectivenessCard({ insight }: TrainingEffectivenessCardProps) {
  const { tier, tierLabel, findings, recommendations } = insight;

  return (
    <div className="glass-card lg:desktop-card rounded-[16px] lg:rounded-2xl p-4 lg:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-full bg-maf-violet/10 flex items-center justify-center shrink-0">
          <ClipboardCheck className="w-4 h-4 text-maf-violet" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-white/50 uppercase tracking-wide">Phân tích hiệu quả buổi tập</p>
          <span className={`inline-flex items-center px-3 py-1 mt-1 rounded-full text-sm font-bold border ${TIER_BADGE[tier]}`}>
            {tierLabel}
          </span>
        </div>
      </div>

      {findings.length > 0 && (
        <ul className="space-y-2.5">
          {findings.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${SEVERITY_DOT[f.severity]}`} />
              <span className="flex-1 text-white/75">{f.text}</span>
              <ChapterChip label={f.bookRef} />
            </li>
          ))}
        </ul>
      )}

      {recommendations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 mb-2.5">
            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-[11px] font-bold text-white/50 uppercase tracking-wide">Khuyến nghị</p>
          </div>
          <ul className="space-y-2">
            {recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span className="text-amber-400 shrink-0">•</span>
                <span className="flex-1 text-white/75">{r.text}</span>
                <ChapterChip label={r.bookRef} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-[11px] text-white/40">
        Theo Dr. Phil Maffetone — The Big Book of Endurance Training and Racing.
      </p>
    </div>
  );
}
