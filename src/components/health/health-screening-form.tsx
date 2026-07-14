import { ShieldCheck } from 'lucide-react';
import { HealthCondition, type UserProfile } from '../../types';
import { conditionLabelsVn } from '../../utils/health-condition-rules';
import { SCREENING_INTRO_COPY, MEDICAL_DISCLAIMER } from '../../content/safety';

interface HealthScreeningFormProps {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
}

const CONDITION_OPTIONS: { value: HealthCondition; label: string }[] = [
  { value: HealthCondition.CARDIOVASCULAR, label: 'Tim mạch' },
  { value: HealthCondition.HYPERTENSION, label: 'Huyết áp' },
  { value: HealthCondition.JOINT_ISSUES, label: 'Xương khớp' },
];

/**
 * Screening questionnaire (Ch6 medical-clearance + Ch29 special-populations
 * model — Phase 3). Explicit CONSENT step FIRST (RED TEAM FIX #11: no
 * consent, no store — withdrawing consent also clears any selected
 * conditions locally, mirroring the server's erasure-on-revoke behavior in
 * profile.service.ts) then the whitelisted condition checkboxes, then an
 * optional clearance confirmation (RED TEAM FIX #10 — server is the
 * enforcement authority; this checkbox only expresses INTENT for the next
 * save). Persists via the shared "Lưu hồ sơ" button on ProfilePage — same
 * save flow as every other profile field (no separate save mechanism).
 *
 * NO diagnosis/treatment content — screening -> adjustment -> gate -> warn ONLY.
 */
export default function HealthScreeningForm({ userProfile, setUserProfile }: HealthScreeningFormProps) {
  const conditions = userProfile.healthConditions ?? [];
  const consentGiven = userProfile.healthConsentGiven ?? false;
  const clearanceConfirmed = userProfile.healthClearanceConfirmed ?? false;

  const handleConsentChange = (checked: boolean) => {
    setUserProfile((prev) => ({
      ...prev,
      healthConsentGiven: checked,
      // FIX #11: withdrawing consent clears selections locally too — a user who
      // un-checks consent should see an empty screening state, not stale conditions.
      healthConditions: checked ? prev.healthConditions : [],
      healthClearanceConfirmed: checked ? prev.healthClearanceConfirmed : false,
    }));
  };

  const toggleCondition = (value: HealthCondition) => {
    setUserProfile((prev) => {
      const current = prev.healthConditions ?? [];
      const next = current.includes(value) ? current.filter((c) => c !== value) : [...current, value];
      return { ...prev, healthConditions: next };
    });
  };

  const handleClearanceChange = (checked: boolean) => {
    setUserProfile((prev) => ({ ...prev, healthClearanceConfirmed: checked }));
  };

  return (
    <div className="desktop-card p-6 space-y-4">
      <h2 className="text-base font-bold text-white flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-amber-400" />
        Sàng lọc sức khỏe
      </h2>
      <p className="text-white/60 text-sm">{SCREENING_INTRO_COPY}</p>

      <label className="flex items-start gap-3 p-3 min-h-[44px] bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition cursor-pointer">
        <input
          type="checkbox"
          checked={consentGiven}
          onChange={(e) => handleConsentChange(e.target.checked)}
          className="w-6 h-6 min-w-[24px] mt-0.5 rounded accent-amber-500 bg-[#1F2937] border-white/20"
        />
        <span className="text-sm text-white">
          Tôi đồng ý cung cấp thông tin sức khỏe để nhận gợi ý tập luyện an toàn hơn.
        </span>
      </label>

      {consentGiven && (
        <>
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Bạn có tình trạng sức khỏe nào dưới đây? (nếu có)
            </p>
            {CONDITION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-3 p-3 min-h-[44px] bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={conditions.includes(opt.value)}
                  onChange={() => toggleCondition(opt.value)}
                  className="w-6 h-6 min-w-[24px] rounded accent-maf-red bg-[#1F2937] border-white/20"
                />
                <span className="text-sm text-white">{opt.label}</span>
              </label>
            ))}
          </div>

          {conditions.length > 0 && (
            <>
              <p className="text-[12px] text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                Bạn có tình trạng sức khỏe cần lưu ý: {conditionLabelsVn(conditions).join(', ')}. Hãy tham khảo bác sĩ
                trước khi tăng khối lượng tập vượt mức Sức khỏe (HEALTH). (Chương 6)
              </p>

              <label className="flex items-start gap-3 p-3 min-h-[44px] bg-emerald-500/10 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/20 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearanceConfirmed}
                  onChange={(e) => handleClearanceChange(e.target.checked)}
                  className="w-6 h-6 min-w-[24px] mt-0.5 rounded accent-emerald-500 bg-[#1F2937] border-white/20"
                />
                <span className="text-sm text-emerald-300 font-semibold">
                  Tôi đã được bác sĩ cho phép tập luyện với tình trạng sức khỏe hiện tại.
                </span>
              </label>
            </>
          )}
        </>
      )}

      <p className="text-white/30 text-xs pt-2 border-t border-white/10">{MEDICAL_DISCLAIMER}</p>
    </div>
  );
}
