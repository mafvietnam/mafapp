/** Strava's app-capacity rejection message maps to the same "full" error code as the slot-cap guard (H6d). */
const CAPACITY_ERROR_PATTERN = /rate limit|athlete limit|over.*limit|capacity/i;

/** Maps a Strava OAuth callback failure message to the frontend-facing `?strava_error=` code. */
export function mapStravaCallbackError(message: string): 'full' | '1' {
  return CAPACITY_ERROR_PATTERN.test(message) ? 'full' : '1';
}
