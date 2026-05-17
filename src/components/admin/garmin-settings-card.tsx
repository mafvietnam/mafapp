import { useState, useEffect } from 'react';
import { Watch, Save, Loader2, CheckCircle } from 'lucide-react';
import {
  getGarminSettings,
  saveGarminSettings,
  type GarminSettingsData,
} from '../../services/admin-service';
import SecretInput from './secret-input';

/** Self-contained Garmin OAuth settings card — no external props needed */
export default function GarminSettingsCard() {
  const [garmin, setGarmin] = useState<GarminSettingsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    getGarminSettings().then((data) => {
      if (data) {
        setGarmin(data);
        setClientId(data.clientId);
        setClientSecret('');
        setCallbackUrl(data.callbackUrl);
        setEnabled(data.enabled);
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const payload: Record<string, string | boolean> = { clientId, callbackUrl, enabled };
    if (clientSecret) payload.clientSecret = clientSecret;

    const ok = await saveGarminSettings(payload);
    setSaving(false);
    if (ok) {
      setSaved(true);
      const updated = await getGarminSettings();
      if (updated) setGarmin(updated);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  return (
    <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Watch className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-bold text-white">Garmin Connect API</h3>
        </div>
        {/* Enable toggle */}
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            enabled ? 'bg-emerald-500' : 'bg-slate-700'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : ''
            }`}
          />
        </button>
      </div>

      <p className="text-sm text-slate-400 mb-6">
        Cấu hình OAuth2 từ Garmin Developer Program. Khi có Client ID và Secret, nhập vào đây và bật tính năng.
      </p>

      <div className="space-y-4">
        {/* Client ID */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Client ID</label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Nhập Garmin OAuth Client ID"
            className="w-full bg-[#0B1121] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500/50 placeholder-slate-600 font-mono"
          />
        </div>

        {/* Client Secret */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Client Secret</label>
          <SecretInput
            value={clientSecret}
            onChange={setClientSecret}
            placeholder={garmin?.hasClientSecret ? 'Đã lưu (nhập mới để thay đổi)' : 'Nhập Garmin OAuth Client Secret'}
            focusBorderColor="focus:border-blue-500/50"
          />
          {garmin?.hasClientSecret && (
            <p className="text-xs text-slate-500 mt-1">
              Secret đã được mã hóa AES-256: {garmin.clientSecret}
            </p>
          )}
        </div>

        {/* Callback URL */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Callback URL</label>
          <input
            type="text"
            value={callbackUrl}
            onChange={(e) => setCallbackUrl(e.target.value)}
            className="w-full bg-[#0B1121] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500/50 placeholder-slate-600 font-mono"
          />
          <p className="text-xs text-slate-500 mt-1">Đăng ký URL này trong Garmin Developer Portal.</p>
        </div>
      </div>

      {/* Status + Save */}
      <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${enabled && garmin?.hasClientSecret ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-400">
            {enabled && garmin?.hasClientSecret
              ? 'Garmin OAuth đang hoạt động'
              : !enabled
              ? 'Garmin đang tắt'
              : 'Thiếu Client Secret — chưa hoạt động'}
          </span>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-sm text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Đang lưu...' : saved ? 'Đã lưu!' : 'Lưu cài đặt'}
        </button>
      </div>
    </div>
  );
}
