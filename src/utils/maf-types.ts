/**
 * MAF Logic — shared domain interfaces
 * Used by: maf-volume-cap.ts, maf-smart-long-run.ts
 */

import { ScheduleItem } from '../types';

// Volume cap limits per commitment level (Chapter 9 - Commitment Levels)
export interface VolumeCap {
  maxWeeklyMinutes: number;
  maxLongRunMinutes: number;
  description: string;
}

// Result of smart long-run calculation (history-based adjustment)
export interface SmartLongRunResult {
  duration: number;           // New Long Run duration (minutes)
  message: string;            // Explanation for user
  adjustmentType: 'INCREASE' | 'MAINTAIN' | 'DECREASE' | 'CAP';
  isCapped?: boolean;         // Flag: hit commitment-level ceiling
}

// Result of weekly volume cap enforcement
export interface WeeklyVolumeCapResult {
  adjustedSchedule: ScheduleItem[];
  wasReduced: boolean;
  originalTotal: number;
  adjustedTotal: number;
  reductionMessage?: string;
}
