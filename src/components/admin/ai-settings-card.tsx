import { useState, useEffect } from 'react';
import { Sparkles, Save, Loader2, CheckCircle } from 'lucide-react';
import {
  getAdminAiSettings,
  saveAdminAiSettings,
  type AdminAiSettingsData,
} from '../../services/admin-ai-service';
import SecretInput from './secret-input';

/** Self-contained AI coaching settings card (Phase 5) — mirrors StravaSettingsCard, violet theme. */
export default function AiSettingsCard() {
  const [ai, setAi] = useState<AdminAiSettingsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [defaultMonthlyQuota, setDefaultMonthlyQuota] = useState(30);

  useEffect(() => {
    getAdminAiSettings().then((data) => {
      if (data) {
        setAi(data);
        setEnabled(data.enabled);
        setOpenRouterKey('');
        setDefaultModel(data.defaultModel);
        setDefaultMonthlyQuota(data.defaultMonthlyQuota);
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    const payload: Record<string, string | boolean | number> = {
      enabled,
      defaultModel,
      defaultMonthlyQuota,
    };
    if (openRouterKey) payload.openRouterKey = openRouterKey;

    const ok = await saveAdminAiSettings(payload);
    setSaving(false);

    if (ok) {
      setSaved(true);
      setOpenRouterKey('');
      const updated = await getAdminAiSettings();
      if (updated) setAi(updated);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const isOperational = enabled && ai?.hasOpenRouterKey;

  return (
    <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
      {/* Header + enable toggle */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-maf-violet" />
          <h3 className="text-lg font-bold text-white">Cấu hình AI Coaching</h3>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : ''}`} />
        </button>
      </div>

      <p className="text-sm text-slate-400 mb-6">
        Cấu hình lượt AI dùng chung cho toàn hệ thống (qua OpenRouter). Người dùng có khóa
        API riêng (BYOK) không bị tính vào hạn mức này.
      </p>

      <div className="space-y-4">
        {/* Bật AI (mirrored via toggle above; label kept for scan-ability) */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Bật AI</label>
          <p className="text-xs text-slate-500">
            {enabled ? 'AI coaching đang bật cho toàn hệ thống.' : 'AI coaching đang tắt — chỉ dùng gợi ý mẫu (template).'}
          </p>
        </div>

        {/* OpenRouter key */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Khóa OpenRouter</label>
          <SecretInput
            value={openRouterKey}
            onChange={setOpenRouterKey}
            placeholder={ai?.hasOpenRouterKey ? 'Đã lưu (nhập mới để thay đổi)' : 'Nhập khóa OpenRouter'}
            focusBorderColor="focus:border-maf-violet"
          />
          {ai?.hasOpenRouterKey && (
            <p className="text-xs text-slate-500 mt-1">Khóa đã được mã hóa AES-256: {ai.openRouterKey}</p>
          )}
        </div>

        {/* Default model */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Model mặc định</label>
          <input
            type="text"
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            placeholder="vd: google/gemini-2.0-flash-001"
            className="w-full bg-[#0B1121] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-maf-violet placeholder-slate-600 font-mono"
          />
          <p className="text-xs text-slate-500 mt-1">Model OpenRouter dùng cho lượt AI hệ thống.</p>
        </div>

        {/* Quota per user per month */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Hạn mức/người/tháng</label>
          <input
            type="number"
            min={0}
            max={10000}
            value={defaultMonthlyQuota}
            onChange={(e) => setDefaultMonthlyQuota(Number(e.target.value))}
            className="w-full bg-[#0B1121] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-maf-violet"
          />
          <p className="text-xs text-slate-500 mt-1">Số lượt AI miễn phí mỗi người dùng được dùng mỗi tháng (khóa hệ thống).</p>
        </div>
      </div>

      {/* Status + Save */}
      <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOperational ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-400">
            {isOperational
              ? 'AI coaching đang hoạt động'
              : !enabled
              ? 'AI coaching đang tắt'
              : 'Thiếu khóa OpenRouter — chưa hoạt động'}
          </span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-sm text-white bg-gradient-to-r from-maf-red to-maf-violet hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Đang lưu...' : saved ? 'Đã lưu!' : 'Lưu cài đặt'}
        </button>
      </div>
    </div>
  );
}
