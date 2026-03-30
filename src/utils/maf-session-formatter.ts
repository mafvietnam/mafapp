/**
 * MAF Session Formatter — Chapter 5: Warming Up and Cooling Down
 * Rule: 15p Warm-up + Main Set + 15p Cool-down
 */

import { ScheduleItem } from '../types';

// Format session breakdown details for display to user
export const formatSessionDetails = (totalDuration: number, mafHr: number, type?: ScheduleItem['type']): string => {
  // Rest day — no details needed
  if (totalDuration === 0) return "";

  // Active recovery: very easy effort, HR well below MAF
  if (type === 'RECOVERY') {
    const recoveryHr = mafHr - 15;
    return [
      `• Chạy phục hồi chủ động`,
      `• Tốc độ RẤT THƯ GIÃN (hơi nhanh hơn đi bộ)`,
      `• Giữ tim DƯỚI ${recoveryHr} bpm (MAF - 15)`,
      `• Mục đích: Thúc đẩy tuần hoàn máu, không gây mệt`
    ].join('\n');
  }

  // Sessions <= 30 mins are too short for 15/15 warm-up/cool-down structure
  if (totalDuration <= 30) {
    return `Đi bộ / Chạy rất nhẹ nhàng thư giãn (Giữ tim < ${mafHr - 20} bpm)`;
  }

  const warmUp = 15;
  const coolDown = 15;
  const mainSet = totalDuration - (warmUp + coolDown);
  const lowerZone = mafHr - 10;
  const warmUpHr = mafHr - 20;

  return [
    `• ${warmUp}p Khởi động: Đi bộ -> Chạy chậm (HR < ${warmUpHr})`,
    `• ${mainSet}p Chạy MAF: Duy trì nhịp tim ${lowerZone} - ${mafHr} bpm`,
    `• ${coolDown}p Thả lỏng: Chạy chậm dần -> Đi bộ để hồi phục`
  ].join('\n');
};
