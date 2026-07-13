import { Link } from 'react-router-dom';
import { ArrowLeft, Upload } from 'lucide-react';
import type { StravaActivity } from '../../services/strava-service';
import { formatActivityDate } from '../../utils/format-strava-activity';
import { StravaLogo, PoweredByStrava } from '../strava-logo';

interface ActivityDetailHeaderProps {
  activity: StravaActivity;
}

/** Name/date/type header + external Strava link + attribution badge. */
export default function ActivityDetailHeader({ activity }: ActivityDetailHeaderProps) {
  return (
    <div className="mb-6">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-white/50 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Về Trang chủ
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-white mb-2">{activity.name}</h1>
          <p className="text-sm text-white/50 font-medium">
            {formatActivityDate(activity.startDate)} &bull; {activity.type}
          </p>
        </div>

        {/* UPLOAD activities didn't come from the Strava API — no valid strava.com link exists for
            "upload_" ids, and showing Strava branding on non-Strava data is a brand/ToS concern (RT-M3). */}
        {activity.source === 'UPLOAD' ? (
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white/70 bg-white/5 border border-white/10 shrink-0">
            <Upload className="w-4 h-4" /> Tệp tải lên
          </span>
        ) : (
          <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
            <a
              href={`https://www.strava.com/activities/${activity.stravaActivityId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-[#FC4C02]/15 border border-[#FC4C02]/30 hover:bg-[#FC4C02]/25 transition-colors"
            >
              <StravaLogo className="w-4 h-4" /> Xem trên Strava
            </a>
            <PoweredByStrava />
          </div>
        )}
      </div>
    </div>
  );
}
