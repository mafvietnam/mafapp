/**
 * Structured LLM input serializer + system prompt. RED TEAM FIX #1 (trust boundary):
 * the serializer reads ONLY typed fields off the server-recomputed `DailyRecommendation`
 * (numbers, enum `dayType`/`tier`, reason CODES, citation ids) — it never touches
 * `reasons[].text`, `title`, `restCopy`, or `adjustmentNote` (all VN prose, some of which
 * can embed a user-entered check-in tag, e.g. the soreness free-tag). No user free text
 * ever reaches the model, closing prompt-injection via check-in fields.
 */

import type {
  BookRef,
  DailyRecommendation,
} from './recompute/recompute-types.js';

export interface StructuredCoachingInput {
  tier: DailyRecommendation['tier'];
  dayType: DailyRecommendation['dayType'];
  totalMinutes: number;
  warmupMin: number;
  mainMinutes: number;
  cooldownMin: number;
  hrZone: { lower: number; upper: number } | null;
  /** Enum reason codes ONLY (e.g. 'sleep_warn') — never the VN reason text. */
  reasonCodes: string[];
  citations: BookRef[];
}

/** Builds the ONLY object ever serialized into the Claude user message — see file header. */
export function buildStructuredInput(
  rec: DailyRecommendation,
): StructuredCoachingInput {
  return {
    tier: rec.tier,
    dayType: rec.dayType,
    totalMinutes: rec.totalMinutes,
    warmupMin: rec.warmupMin,
    mainMinutes: rec.mainMinutes,
    cooldownMin: rec.cooldownMin,
    hrZone: rec.hrZone
      ? { lower: rec.hrZone.lower, upper: rec.hrZone.upper }
      : null,
    reasonCodes: rec.reasons.map((r) => r.code),
    citations: rec.citations,
  };
}

export const COACHING_SYSTEM_PROMPT = `Bạn là huấn luyện viên MAF (Maximum Aerobic Function) ấm áp, viết bằng tiếng Việt.
Bạn nhận một đối tượng JSON mô tả gợi ý tập luyện HÔM NAY đã được hệ thống tính toán sẵn (tier, loại buổi tập, số phút, vùng nhịp tim, các mã lý do, mã chương sách).

QUY TẮC BẮT BUỘC:
1. KHÔNG được thay đổi bất kỳ con số nào (số phút, nhịp tim, tier, loại buổi tập) — chỉ diễn đạt lại bằng lời văn ấm áp, khích lệ.
2. Chỉ được trích dẫn các chương sách (citations) đã cho trong JSON — không được bịa thêm chương nào khác.
3. KHÔNG đưa ra chẩn đoán hay lời khuyên y tế nào ngoài các cờ (reasonCodes) đã cho.
4. KHÔNG được mâu thuẫn với quyết định nghỉ/giảm khối lượng đã có trong dữ liệu (nếu tier là RED hoặc dayType là REST, phải khuyến khích nghỉ ngơi).
5. Viết bằng tiếng Việt, tối đa khoảng 120 từ, giọng văn ấm áp và khích lệ.
6. Chỉ trả về đoạn văn bản thuần (không JSON, không markdown, không tiêu đề).`;
