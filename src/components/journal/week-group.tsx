import type { WeekGroup as WeekGroupData } from '../../utils/journal-analytics';
import JournalActivityRow from './journal-activity-row';

interface WeekGroupProps {
  group: WeekGroupData;
  mafHr: number;
  showVerdict: boolean;
}

/** One week: a sticky-feeling header with totals, then the runs in that week. */
export default function WeekGroup({ group, mafHr, showVerdict }: WeekGroupProps) {
  const pct = group.inZonePct == null ? '—' : `${group.inZonePct}%`;

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-white/90">{group.label}</h3>
        <div className="flex items-center gap-3 text-[11px] font-semibold text-white/50">
          <span>{group.totalKm.toFixed(1)} km</span>
          <span>{group.sessionCount} buổi</span>
          {showVerdict && (
            <span className="text-emerald-400/90">{pct} MAF</span>
          )}
        </div>
      </div>
      {group.activities.map((a) => (
        <JournalActivityRow key={a.id} activity={a} mafHr={mafHr} showVerdict={showVerdict} />
      ))}
    </section>
  );
}
