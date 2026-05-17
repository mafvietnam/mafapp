import { Settings } from 'lucide-react';
import GarminSettingsCard from '../../components/admin/garmin-settings-card';
import StravaSettingsCard from '../../components/admin/strava-settings-card';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
          <Settings className="w-6 h-6 text-slate-400" />
          Cài đặt chung
        </h2>
        <p className="text-sm text-slate-400">Cấu hình tích hợp và tùy chọn hệ thống.</p>
      </div>

      {/* Garmin OAuth Settings */}
      <GarminSettingsCard />

      {/* Strava OAuth Settings */}
      <StravaSettingsCard />
    </div>
  );
}
