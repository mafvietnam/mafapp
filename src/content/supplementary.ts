/**
 * Bài bổ trợ (supplementary) cards — strength/stability (Maffetone frames this as
 * slow/heavy LOW-REP neural strength + bodyweight + stability, explicitly NOT
 * hypertrophy circuits, research §1) PLUS running-progression/form education added
 * 260714 from the PDF (docs/the-big-book-of-endurance-training-and-racing.pdf,
 * local pypdf extraction, no paid API). Only offered on GREEN-tier active-training
 * days (select-guidance-cards.ts) — AMBER stays recovery-leaning, no strength ask.
 *
 * Simplification (YAGNI): the phase-02 spec mentions a "72h rule" (non-consecutive
 * strength days), but `selectGuidanceCards` only receives today's `DailyRecommendation`
 * + profile flags — no strength-session history is available as input yet. Rather
 * than fabricate untracked state, the selector shows at most SUPPLEMENTARY_LIMIT (2)
 * cards (first array matches) as standing suggestions; day-to-day spacing enforcement
 * is a follow-up if a future phase adds strength-session tracking.
 *
 * Array order matters: `progression_beginner_maf` is first and flag-gated
 * (appliesTo.flags: ['beginner']) so it only matches — and only claims a slot —
 * for isBeginner profiles; pushing deadlift/strength suggestions on someone who
 * can't yet run without exceeding MAF HR would contradict CH3's "start very slow"
 * guidance. `running_form_brain_led` is second and unconditional (any GREEN active
 * day), so with SUPPLEMENTARY_LIMIT=2 a non-beginner sees [running_form_brain_led,
 * strength_bodyweight] and a beginner sees [progression_beginner_maf,
 * running_form_brain_led] — strength cards never surface for a flagged beginner.
 */

import type { GuidanceCard } from './guidance-types';

const ACTIVE_DAY_TYPES: GuidanceCard['appliesTo']['dayTypes'] = ['RUN', 'LONG_RUN', 'WALK', 'RECOVERY'];

export const SUPPLEMENTARY_CARDS: GuidanceCard[] = [
  {
    // PDF gap fill (260714): the book has no numeric "10% rule" / week-by-week
    // volume ramp for absolute beginners — Maffetone writes mainly for athletes
    // already training, not couch-to-5k starters. The book's REAL beginner
    // mechanism is the 180 Formula category (b) HR-ceiling adjustment (CH3, p.120)
    // + "walk immediately if HR exceeds MAF, don't chase pace" (same chapter) —
    // this mirrors maf-calculator-orchestrator.ts's existing NONE/REGULAR_NEW
    // mindset copy, so this card cites the same real mechanism instead of
    // inventing an unsourced mileage-ramp percentage.
    id: 'progression_beginner_maf',
    category: 'supplementary',
    title: 'Người mới: đi bộ nếu vượt nhịp tim MAF, đừng lo tốc độ',
    body: 'Nếu mới bắt đầu hoặc vừa quay lại sau gián đoạn, ngưỡng nhịp tim MAF của bạn được tính thận trọng hơn (trừ thêm nhịp — có chủ đích, không phải giới hạn tạm thời). Nếu đi bộ nhanh cũng khiến nhịp tim vượt ngưỡng, hãy đi bộ chậm lại — đừng cố chạy. Tiến bộ đúng nghĩa là pace nhanh dần ở CÙNG một nhịp tim qua vài tháng (theo dõi bằng MAF Test), không phải tăng quãng đường thật nhanh.',
    citation: { label: 'The Big Book of Endurance Training and Racing — Chương 3 (180 Formula)', bookRef: 'CH3' },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES, tiers: ['GREEN'], flags: ['beginner'] },
  },
  {
    // PDF gap fill (260714): the book has NO structured "running-form drills"
    // (A-skips, high-knees, etc.) — searched full text for drill/gait/stride/
    // economy, found none. Its actual, explicit stance is CONTRARIAN: forcing/
    // exaggerating form causes injury (CH2's "Kim" case study, a runner injured
    // by being told to lengthen stride + lift knees) and stride length should be
    // "governed by your brain and the body's energy levels" rather than an
    // imitated image (CH10, overstriding-under-fatigue passage). Sourced as the
    // real, honest answer to "form drills" rather than inventing a drill routine
    // the book doesn't contain.
    id: 'running_form_brain_led',
    category: 'supplementary',
    title: 'Đừng cố sửa dáng chạy — để não bộ tự điều chỉnh',
    body: 'Cố tình sải bước dài hơn, nâng cao gối, hay bắt chước dáng chạy của người khác dễ dẫn đến chấn thương. Sải bước lý tưởng do não bộ điều chỉnh tự nhiên theo mức năng lượng và nhịp tim hiện tại — không phải theo hình ảnh bạn muốn có. Hãy chạy thư giãn trong vùng nhịp tim MAF; dáng chạy hiệu quả sẽ tự hình thành khi nền hiếu khí tốt lên, không cần ép buộc bằng các bài tập kỹ thuật.',
    citation: {
      label: 'The Big Book of Endurance Training and Racing — Chương 2 & 10 (kiểm soát não-cơ; overstriding khi thi đấu)',
    },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES, tiers: ['GREEN'] },
  },
  {
    id: 'strength_bodyweight',
    category: 'supplementary',
    title: 'Chống đẩy & kéo xà — bài bổ trợ nhẹ nhàng',
    body: 'Chống đẩy, kéo xà với tải trọng nhẹ, kiểm soát tốt là bài bổ trợ tương thích với nền hiếu khí — không cần phòng gym, tập vài hiệp chất lượng thay vì nhiều hiệp mệt mỏi.',
    citation: { label: 'Method — Dr. Phil Maffetone', url: 'https://philmaffetone.com/method/' },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES, tiers: ['GREEN'] },
  },
  {
    id: 'stability_training',
    category: 'supplementary',
    title: 'Bài tập thăng bằng & ổn định',
    body: 'Bài tập thăng bằng, ổn định khớp là phần bổ trợ tốt cho nền hiếu khí — tăng cường cảm nhận cơ thể (proprioception) và giảm nguy cơ chấn thương khi chạy.',
    citation: { label: 'Method — Dr. Phil Maffetone', url: 'https://philmaffetone.com/method/' },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES, tiers: ['GREEN'] },
  },
  {
    id: 'strength_deadlift',
    category: 'supplementary',
    title: 'Deadlift — bài tập sức mạnh nền tảng',
    body: 'Deadlift là một trong những bài tập toàn thân hiệu quả nhất: tải ~80% 1RM, 1–6 lần lặp, nghỉ tối thiểu 3 phút giữa các hiệp — tập trung vào sức mạnh thần kinh-cơ chứ không phải phì đại cơ. Cần học đúng kỹ thuật hoặc nhờ huấn luyện viên hướng dẫn nếu chưa quen.',
    citation: {
      label: 'Six Tips for Improving Strength',
      url: 'https://philmaffetone.com/six-tips-for-improving-strength/',
    },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES, tiers: ['GREEN'] },
  },
  {
    id: 'strength_nutrition',
    category: 'supplementary',
    title: 'Dinh dưỡng quanh buổi tập sức mạnh',
    body: 'Ăn thực phẩm thật quanh buổi tập tạ: protein chất lượng, chất béo lành mạnh, tinh bột tự nhiên nếu cơ thể dung nạp tốt — nền tảng dinh dưỡng cho sức mạnh bền vững.',
    citation: {
      label: 'Six Tips for Improving Strength',
      url: 'https://philmaffetone.com/six-tips-for-improving-strength/',
    },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES, tiers: ['GREEN'] },
  },
  {
    id: 'avoid_junk_food_strength_training',
    category: 'supplementary',
    title: 'Tránh đồ ăn vặt quanh buổi tập tạ',
    body: 'Đồ ăn vặt/chế biến sẵn quanh buổi tập sức mạnh sẽ làm giảm hiệu quả tập luyện — ưu tiên thực phẩm thật để cơ thể phục hồi và thích nghi tốt hơn.',
    citation: {
      label: 'Six Tips for Improving Strength',
      url: 'https://philmaffetone.com/six-tips-for-improving-strength/',
    },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES, tiers: ['GREEN'] },
  },
];
