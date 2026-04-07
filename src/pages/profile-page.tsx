import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/auth-context';
import { useUserProfile } from '../hooks/use-user-profile';
import { useMafCalculator } from '../hooks/use-maf-calculator';
import { getProfile, updateProfile } from '../services/profile-service';
import { ExperienceLevel, CommitmentLevel } from '../types';
import { Activity, Heart, Flame, Zap } from 'lucide-react';
import GarminConnectCard from '../components/garmin-connect-card';
import StravaConnectCard from '../components/strava-connect-card';

const EXPERIENCE_OPTIONS = [
  { value: ExperienceLevel.NONE, label: 'Chưa từng chạy' },
  { value: ExperienceLevel.INCONSISTENT, label: 'Chạy không đều đặn' },
  { value: ExperienceLevel.REGULAR_NEW, label: 'Chạy đều < 2 năm' },
  { value: ExperienceLevel.ADVANCED, label: 'Chạy đều > 2 năm' },
];

const COMMITMENT_OPTIONS = [
  { value: CommitmentLevel.HEALTH, label: 'Sức khỏe', sub: '3-4 giờ/tuần', icon: Heart, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  { value: CommitmentLevel.BASE, label: 'Xây dựng nền tảng', sub: '5-6 giờ/tuần', icon: Flame, color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
  { value: CommitmentLevel.PERFORMANCE, label: 'Thi đấu', sub: '7-12 giờ/tuần', icon: Zap, color: 'text-maf-violet border-maf-violet/30 bg-maf-violet/10' },
];

export default function ProfilePage() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const { userProfile, setUserProfile } = useUserProfile();
  const { calculateRawMaf } = useMafCalculator();
  const mafHr = calculateRawMaf(userProfile);

  // Fetch saved profile from server on mount
  useEffect(() => {
    getProfile().then((saved) => {
      if (saved) {
        setUserProfile((prev) => ({
          ...prev,
          age: String(saved.age),
          height: String(saved.height),
          weight: String(saved.weight),
          experience: saved.experience as ExperienceLevel,
          commitment: saved.commitment as CommitmentLevel,
          isRecovering: saved.isRecovering,
          isMedicatedOrInjured: saved.isMedicatedOrInjured,
          isMedicalClearanceConfirmed: saved.isMedicalClearanceConfirmed,
          previousMonthPace: saved.previousMonthPace ?? '',
          isProbation: saved.isProbation,
          probationStartDate: saved.probationStartDate ?? undefined,
          lastLongRunDuration: saved.lastLongRunDuration ?? undefined,
          lastLongRunHeartRate: saved.lastLongRunHeartRate ?? undefined,
          lastLongRunFeeling: (saved.lastLongRunFeeling as 'GOOD' | 'TIRED' | 'VERY_TIRED') ?? undefined,
        }));
      }
      setLoading(false);
    });
  }, [setUserProfile]);

  const handleChange = (field: string, value: string | boolean) => {
    setUserProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    const ok = await updateProfile(userProfile);
    setSaving(false);
    setSaveMsg(ok ? 'Đã lưu thành công!' : 'Lưu thất bại, vui lòng thử lại.');
    if (ok) setTimeout(() => setSaveMsg(''), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-white/30 border-t-white rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* User header */}
      {user && (
        <div className="flex items-center gap-4 mb-8">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-full border-2 border-white/20" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-maf-violet/20 border-2 border-white/20 flex items-center justify-center text-2xl font-bold text-white">
              {user.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-white">{user.name}</h1>
            <p className="text-white/60 text-sm">{user.email}</p>
          </div>
        </div>
      )}

      {/* MAF zone */}
      {mafHr > 0 && (
        <div className="desktop-card p-4 mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-maf-red to-maf-violet flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white/60 text-xs uppercase tracking-wider font-bold">Vùng nhịp tim MAF</p>
            <p className="text-2xl font-black text-white">
              {mafHr - 10} – {mafHr} <span className="text-sm font-normal text-white/60">BPM</span>
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Personal info */}
        <div className="desktop-card p-6">
          <h2 className="text-base font-bold text-white mb-4">Thông tin cá nhân</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Tuổi</label>
              <input
                type="number"
                value={userProfile.age}
                onChange={(e) => handleChange('age', e.target.value)}
                className="mt-1 w-full bg-[#1F2937] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-maf-violet"
                placeholder="30"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Cao (cm)</label>
              <input
                type="number"
                value={userProfile.height}
                onChange={(e) => handleChange('height', e.target.value)}
                className="mt-1 w-full bg-[#1F2937] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-maf-violet"
                placeholder="170"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Nặng (kg)</label>
              <input
                type="number"
                value={userProfile.weight}
                onChange={(e) => handleChange('weight', e.target.value)}
                className="mt-1 w-full bg-[#1F2937] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-maf-violet"
                placeholder="65"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Kinh nghiệm</label>
            <select
              value={userProfile.experience}
              onChange={(e) => handleChange('experience', e.target.value)}
              className="mt-1 w-full bg-[#1F2937] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-maf-violet appearance-none cursor-pointer"
            >
              {EXPERIENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Health */}
        <div className="desktop-card p-6">
          <h2 className="text-base font-bold text-white mb-4">Sức khỏe</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={userProfile.isRecovering}
                onChange={(e) => handleChange('isRecovering', e.target.checked)}
                className="w-5 h-5 rounded border-white/20 bg-[#1F2937] accent-maf-red"
              />
              <span className="text-white text-sm">Đang hồi phục bệnh nặng (-10 nhịp)</span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={userProfile.isMedicatedOrInjured}
                onChange={(e) => handleChange('isMedicatedOrInjured', e.target.checked)}
                className="w-5 h-5 rounded border-white/20 bg-[#1F2937] accent-maf-red"
              />
              <span className="text-white text-sm">Dùng thuốc / Chấn thương (-5 nhịp)</span>
            </label>
          </div>
        </div>

        {/* Connected Devices */}
        <GarminConnectCard />
        <StravaConnectCard />

        {/* Commitment */}
        <div className="desktop-card p-6">
          <h2 className="text-base font-bold text-white mb-4">Mức độ cam kết</h2>
          <div className="grid grid-cols-3 gap-3">
            {COMMITMENT_OPTIONS.map(({ value, label, sub, icon: Icon, color }) => (
              <button
                key={value}
                onClick={() => handleChange('commitment', value)}
                className={`p-4 rounded-xl border text-center transition-all ${
                  userProfile.commitment === value
                    ? `${color} border-2`
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <Icon className={`w-6 h-6 mx-auto mb-2 ${userProfile.commitment === value ? '' : 'text-white/40'}`} />
                <p className="font-bold text-white text-sm">{label}</p>
                <p className="text-white/60 text-xs mt-1">{sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-maf-red to-maf-violet hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
        </button>

        {saveMsg && (
          <p className={`text-center text-sm ${saveMsg.includes('thành công') ? 'text-green-400' : 'text-red-400'}`}>
            {saveMsg}
          </p>
        )}
      </div>
    </div>
  );
}
