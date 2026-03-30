/**
 * Tests for MAF Session Formatter
 * Validates warm-up/cool-down structure and session details formatting
 */

import { describe, it, expect } from 'vitest';
import { formatSessionDetails } from '../maf-session-formatter';

describe('formatSessionDetails', () => {
  const mafHr = 150;

  describe('Rest days', () => {
    it('should return empty string for duration=0 (rest day)', () => {
      const result = formatSessionDetails(0, mafHr);
      expect(result).toBe('');
    });
  });

  describe('Recovery sessions', () => {
    it('should format recovery session with reduced HR zone', () => {
      const result = formatSessionDetails(45, mafHr, 'RECOVERY');
      expect(result).toContain('Chạy phục hồi chủ động');
      expect(result).toContain('RẤT THƯ GIÃN');
      expect(result).toContain('135'); // mafHr - 15
      expect(result).toContain('DƯỚI');
    });

    it('should include recovery-specific messaging', () => {
      const result = formatSessionDetails(60, 160, 'RECOVERY');
      expect(result).toContain('Thúc đẩy tuần hoàn máu');
      expect(result).toContain('không gây mệt');
    });
  });

  describe('Short sessions (≤30 mins)', () => {
    it('should format short duration <= 30 mins without warm-up/cool-down breakdown', () => {
      const result = formatSessionDetails(30, mafHr);
      expect(result).toContain('Đi bộ / Chạy rất nhẹ nhàng thư giãn');
      expect(result).not.toContain('Khởi động');
    });

    it('should recommend HR well below MAF for easy recovery pace', () => {
      const result = formatSessionDetails(25, 150);
      expect(result).toContain('130'); // mafHr - 20
    });

    it('should handle very short duration (5 mins)', () => {
      const result = formatSessionDetails(5, 140);
      expect(result).toContain('Đi bộ / Chạy rất nhẹ nhàng thư giãn');
    });
  });

  describe('Standard sessions (>30 mins) - warm-up/cool-down structure', () => {
    it('should structure 45-min session: 15 warm-up + 15 main + 15 cool-down', () => {
      const result = formatSessionDetails(45, mafHr);
      expect(result).toContain('15p Khởi động');
      expect(result).toContain('15p Chạy MAF');
      expect(result).toContain('15p Thả lỏng');
    });

    it('should structure 60-min session: 15 warm-up + 30 main + 15 cool-down', () => {
      const result = formatSessionDetails(60, mafHr);
      expect(result).toContain('15p Khởi động');
      expect(result).toContain('30p Chạy MAF');
      expect(result).toContain('15p Thả lỏng');
    });

    it('should structure 90-min session: 15 warm-up + 60 main + 15 cool-down', () => {
      const result = formatSessionDetails(90, mafHr);
      expect(result).toContain('15p Khởi động');
      expect(result).toContain('60p Chạy MAF');
      expect(result).toContain('15p Thả lỏng');
    });

    it('should structure long run 120-min session correctly', () => {
      const result = formatSessionDetails(120, mafHr);
      expect(result).toContain('15p Khởi động');
      expect(result).toContain('90p Chạy MAF');
      expect(result).toContain('15p Thả lỏng');
    });
  });

  describe('Heart rate zones in session details', () => {
    it('should set warm-up HR 20 bpm below MAF', () => {
      const result = formatSessionDetails(45, 160);
      expect(result).toContain('140'); // 160 - 20
    });

    it('should set main set HR at MAF lower zone', () => {
      const result = formatSessionDetails(45, 160);
      expect(result).toContain('150'); // 160 - 10 (lower zone)
      expect(result).toContain('160'); // upper zone
    });

    it('should calculate zones correctly for different MAF values', () => {
      const result = formatSessionDetails(60, 140);
      expect(result).toContain('120'); // 140 - 20 warm-up
      expect(result).toContain('130'); // 140 - 10 lower zone
      expect(result).toContain('140'); // upper zone
    });
  });

  describe('Edge cases', () => {
    it('should handle very low MAF (under 100)', () => {
      const result = formatSessionDetails(45, 90);
      expect(result).toContain('70'); // 90 - 20
      expect(result).toContain('80'); // 90 - 10
    });

    it('should handle high MAF (over 180)', () => {
      const result = formatSessionDetails(60, 190);
      expect(result).toContain('170'); // 190 - 20
      expect(result).toContain('180'); // 190 - 10
      expect(result).toContain('190');
    });

    it('should handle boundary at 31 mins (still shows warm-up/cool-down)', () => {
      const result = formatSessionDetails(31, mafHr);
      expect(result).toContain('Khởi động');
      expect(result).toContain('1p Chạy MAF'); // 31 - 30
    });
  });

  describe('Session type parameter', () => {
    it('should differentiate RECOVERY type from normal RUN', () => {
      const runResult = formatSessionDetails(45, mafHr, 'RUN');
      const recoveryResult = formatSessionDetails(45, mafHr, 'RECOVERY');
      expect(runResult).not.toEqual(recoveryResult);
    });

    it('should apply RECOVERY type formatting even for short sessions (type checked first)', () => {
      const result = formatSessionDetails(20, mafHr, 'RECOVERY');
      // Type check happens before duration check, so RECOVERY format is applied
      expect(result).toContain('Chạy phục hồi chủ động');
      expect(result).toContain('RẤT THƯ GIÃN');
    });

    it('should use short session format when type is not RECOVERY', () => {
      const result = formatSessionDetails(20, mafHr, 'RUN');
      expect(result).toContain('Đi bộ / Chạy rất nhẹ nhàng thư giãn');
    });
  });
});
