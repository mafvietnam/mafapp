import { AlertOctagon, ShieldAlert } from 'lucide-react';
import type { HealthAdjustment } from '../../utils/health-condition-rules';
import { DANGER_SIGNS_TITLE, DANGER_SIGNS, MEDICAL_DISCLAIMER } from '../../content/safety';

interface SafetyCardProps {
  adjustment: HealthAdjustment;
}

/**
 * Pre-run safety card for health-condition-flagged users (Phase 3). Danger-
 * sign checklist (chest pain / dizziness / unusual breathlessness -> STOP +
 * seek help) + persistent "app không thay thế bác sĩ" disclaimer, plus an
 * advisory clearance-gate notice when `requiresClearanceGate` is set (the
 * server is the enforcement source of truth — api/src/profile/profile.service.ts,
 * RED TEAM FIX #10; this banner is informational only).
 *
 * NO diagnosis/treatment content — screening -> adjustment -> gate -> WARN
 * only. Danger styling (maf-red) — visually distinct from the guidance-card
 * library so it can't be missed or mistaken for a routine tip.
 */
export default function SafetyCard({ adjustment }: SafetyCardProps) {
  if (!adjustment.needsSafetyCard) return null;

  return (
    <div className="space-y-2 bg-maf-red/10 border border-maf-red/30 rounded-xl p-3">
      <h4 className="text-[12px] font-bold text-maf-red uppercase tracking-wider flex items-center gap-1.5">
        <AlertOctagon className="w-4 h-4 shrink-0" />
        {DANGER_SIGNS_TITLE}
      </h4>
      <ul className="space-y-1">
        {DANGER_SIGNS.map((sign) => (
          <li key={sign} className="text-[12px] text-slate-200 flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-maf-red mt-1.5 shrink-0" />
            {sign}
          </li>
        ))}
      </ul>
      <p className="text-[11px] font-semibold text-maf-red">
        NGỪNG TẬP NGAY và tìm hỗ trợ y tế nếu xuất hiện bất kỳ dấu hiệu nào ở trên.
      </p>

      {adjustment.requiresClearanceGate && (
        <p className="text-[11px] text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Bạn có tình trạng sức khỏe cần lưu ý. Hãy tham khảo bác sĩ trước khi tăng khối lượng tập vượt mức Sức khỏe
          (HEALTH). (Chương 6)
        </p>
      )}

      <p className="text-[10px] text-slate-500 italic pt-1 border-t border-white/10">{MEDICAL_DISCLAIMER}</p>
    </div>
  );
}
