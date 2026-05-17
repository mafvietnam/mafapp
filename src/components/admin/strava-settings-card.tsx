import { useState, useEffect } from 'react';
import { Activity, Save, Loader2, CheckCircle, Copy, AlertCircle } from 'lucide-react';
import {
  getStravaSettings,
  saveStravaSettings,
  type StravaSettingsData,
} from '../../services/admin-service';
import SecretInput from './secret-input';

/** Self-contained Strava OAuth settings card — orange theme */
export default function StravaSettingsCard() {
  const [strava, setStrava] = useState<StravaSettingsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [webhookMsg, setWebhookMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [webhookVerifyToken, setWebhookVerifyToken] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    getStravaSettings().then((data) => {
      if (data) {
        setStrava(data);
        setClientId(data.clientId);
        setClientSecret('');
        setWebhookVerifyToken('');
        setEnabled(data.enabled);
      }
    });
  }, []);

  const handleCopyUrl = async () => {
    if (!strava?.webhookCallbackUrl) return;
    await navigator.clipboard.writeText(strava.webhookCallbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setWebhookMsg(null);

    const payload: Record<string, string | boolean> = { clientId, enabled };
    if (clientSecret) payload.clientSecret = clientSecret;
    if (webhookVerifyToken) payload.webhookVerifyToken = webhookVerifyToken;

    const result = await saveStravaSettings(payload);
    setSaving(false);

    if (result.ok) {
      setSaved(true);
      if (result.webhookResubscribed) {
        setWebhookMsg({ type: 'success', text: 'Webhook re-subscribed successfully.' });
      } else if (result.webhookResubscribeError) {
        setWebhookMsg({ type: 'error', text: result.webhookResubscribeError });
      }
      const updated = await getStravaSettings();
      if (updated) setStrava(updated);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const isOperational = enabled && strava?.hasClientSecret && strava?.hasWebhookVerifyToken;

  return (
    <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
      {/* Header + enable toggle */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-bold text-white">Strava API</h3>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : ''}`} />
        </button>
      </div>

      <p className="text-sm text-slate-400 mb-6">
        Cấu hình OAuth2 từ Strava API. Nhập Client ID, Secret và Webhook Verify Token, sau đó bật tính năng.
      </p>

      <div className="space-y-4">
        {/* Client ID */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Client ID</label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Nhập Strava Client ID"
            className="w-full bg-[#0B1121] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500/50 placeholder-slate-600 font-mono"
          />
        </div>

        {/* Client Secret */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Client Secret</label>
          <SecretInput
            value={clientSecret}
            onChange={setClientSecret}
            placeholder={strava?.hasClientSecret ? 'Đã lưu (nhập mới để thay đổi)' : 'Nhập Strava Client Secret'}
            focusBorderColor="focus:border-orange-500/50"
          />
          {strava?.hasClientSecret && (
            <p className="text-xs text-slate-500 mt-1">Secret đã được mã hóa AES-256: {strava.clientSecret}</p>
          )}
        </div>

        {/* Webhook Verify Token */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Webhook Verify Token</label>
          <SecretInput
            value={webhookVerifyToken}
            onChange={setWebhookVerifyToken}
            placeholder={strava?.hasWebhookVerifyToken ? 'Đã lưu (nhập mới để thay đổi)' : 'Nhập Webhook Verify Token'}
            focusBorderColor="focus:border-orange-500/50"
          />
          <p className="text-xs text-slate-500 mt-1">Token dùng để xác thực Strava webhook subscription.</p>
        </div>

        {/* Webhook Callback URL (read-only + copy) */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Webhook Callback URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={strava?.webhookCallbackUrl ?? ''}
              readOnly
              className="flex-1 bg-[#0B1121] border border-white/10 rounded-lg px-4 py-2.5 text-slate-400 text-sm outline-none font-mono cursor-default"
            />
            <button
              onClick={handleCopyUrl}
              className="px-3 py-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-orange-500/30 transition-colors"
              title="Copy URL"
            >
              {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Đăng ký URL này trong Strava API settings để nhận webhook events.
          </p>
        </div>
      </div>

      {/* Webhook resubscribe feedback banner */}
      {webhookMsg && (
        <div className={`mt-4 flex items-start gap-2 px-4 py-3 rounded-lg text-sm ${
          webhookMsg.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {webhookMsg.type === 'success'
            ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
            : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
          {webhookMsg.text}
        </div>
      )}

      {/* Status + Save */}
      <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOperational ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-400">
            {isOperational
              ? 'Strava OAuth đang hoạt động'
              : !enabled
              ? 'Strava đang tắt'
              : 'Thiếu Secret hoặc Verify Token — chưa hoạt động'}
          </span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-sm text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Đang lưu...' : saved ? 'Đã lưu!' : 'Lưu cài đặt'}
        </button>
      </div>
    </div>
  );
}
