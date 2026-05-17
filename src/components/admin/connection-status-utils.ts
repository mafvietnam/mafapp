import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

/** Shared status badge config for Garmin and Strava admin pages */
export const connectionStatusConfig: Record<
  string,
  { bg: string; text: string; label: string; icon: typeof CheckCircle }
> = {
  CONNECTED: {
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    text: 'text-emerald-400',
    label: 'Đã kết nối',
    icon: CheckCircle,
  },
  DISCONNECTED: {
    bg: 'bg-slate-800 border-white/10',
    text: 'text-slate-400',
    label: 'Đã ngắt',
    icon: XCircle,
  },
  TOKEN_EXPIRED: {
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    text: 'text-yellow-400',
    label: 'Token hết hạn',
    icon: AlertTriangle,
  },
  ERROR: {
    bg: 'bg-red-500/10 border-red-500/20',
    text: 'text-red-400',
    label: 'Lỗi',
    icon: XCircle,
  },
};

/** Human-readable relative time in Vietnamese (e.g. "5 phút trước") */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

/** Truncate string to maxLen chars with ellipsis */
export function truncate(str: string, maxLen: number): string {
  return str.length <= maxLen ? str : str.slice(0, maxLen) + '…';
}
