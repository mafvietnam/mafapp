/**
 * Persistent safety-disclaimer card — always included by select-guidance-cards.ts,
 * regardless of dayType/tier/flags. Shared with Phase 3 (which adds special-population
 * danger-sign cards alongside this one; special-population content itself is Phase 3
 * scope, not Phase 2 — see phase-02 spec Architecture §"Content population").
 */

import type { GuidanceCard } from './guidance-types';

export const SAFETY_DISCLAIMER: GuidanceCard = {
  id: 'safety_general_disclaimer',
  category: 'safety-disclaimer',
  title: 'Lưu ý an toàn',
  body: 'Nội dung mang tính tham khảo theo phương pháp MAF, không thay thế tư vấn y tế. Nếu có bệnh nền hoặc triệu chứng bất thường, hãy tham khảo ý kiến bác sĩ trước khi tập luyện.',
  citation: { label: 'Ghi chú an toàn của ứng dụng' },
  appliesTo: {},
};

// ---------------------------------------------------------------------------
// Phase 3 — pre-run safety card (danger-sign checklist) for health-condition-
// flagged users. Rendered by src/components/today/safety-card.tsx, NOT part of
// the guidance-card library above (a distinct, more urgent, danger-styled
// element — always visible when flagged, not subject to the guidance-card
// selection/cap logic in select-guidance-cards.ts). Screening -> adjustment ->
// gate -> WARN only — no diagnosis/treatment content.
// ---------------------------------------------------------------------------

export const DANGER_SIGNS_TITLE = 'Dấu hiệu cần NGỪNG tập ngay';

export const DANGER_SIGNS: readonly string[] = [
  'Đau hoặc tức ngực',
  'Chóng mặt, choáng váng',
  'Khó thở bất thường',
];

export const DANGER_SIGNS_ACTION =
  'NGỪNG TẬP NGAY và tìm hỗ trợ y tế nếu bạn thấy: đau/tức ngực, chóng mặt, khó thở bất thường.';

/** Persistent disclaimer — shown wherever health flags are active (highest legal-exposure copy, owner-reviewed VN sample). */
export const MEDICAL_DISCLAIMER =
  'Ứng dụng không thay thế bác sĩ. Luôn tham khảo chuyên gia y tế cho tình trạng của bạn.';

/** Screening intro copy — shown at the top of health-screening-form.tsx before the consent step. */
export const SCREENING_INTRO_COPY =
  'Vài câu hỏi sức khỏe giúp chúng tôi gợi ý an toàn hơn. Thông tin này KHÔNG thay thế chẩn đoán y tế.';
