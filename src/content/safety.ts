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
