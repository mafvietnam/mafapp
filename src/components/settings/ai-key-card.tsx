import { useEffect, useState } from 'react';
import { KeyRound, Save, Trash2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import {
  getAiKeyStatus,
  setAiKey,
  deleteAiKey,
  type AiKeyStatus,
} from '../../services/ai-key-service';
import {
  AI_PROVIDER_OPTIONS,
  AI_PROVIDER_LABELS,
  AI_PROVIDER_KEY_PREFIX,
  validateAiKeyInput,
  type AiProvider,
} from '../../utils/ai-provider-validation';
import SecretInput from '../admin/secret-input';

/**
 * User BYOK (bring-your-own-key) settings card — Phase 5. Mounted on ProfilePage
 * (mirrors GarminConnectCard/StravaConnectCard placement + "desktop-card" styling).
 * The raw key is NEVER pre-filled/echoed back (backend never returns it) — only
 * masked status (provider + hasKey + source + usage/quota) is shown after save.
 */
export default function AiKeyCard() {
  const [status, setStatus] = useState<AiKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<AiProvider>('OPENROUTER');
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Reusable status loader, called after save/delete mutations (effect below has its own inline fetch).
  const loadStatus = async () => {
    const data = await getAiKeyStatus();
    setStatus(data);
    if (data?.provider) setProvider(data.provider);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getAiKeyStatus();
      if (cancelled) return;
      setStatus(data);
      if (data?.provider) setProvider(data.provider);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setError('');
    setNotice('');
    const validation = validateAiKeyInput(provider, key);
    if (!validation.valid) {
      setError(validation.error ?? 'Khóa API không hợp lệ.');
      return;
    }
    setSaving(true);
    const result = await setAiKey(provider, key.trim());
    setSaving(false);
    if (result.ok) {
      setKey('');
      setNotice('Đã lưu khóa API!');
      await loadStatus();
      setTimeout(() => setNotice(''), 3000);
    } else {
      setError(result.error ?? 'Lưu khóa API thất bại.');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    setNotice('');
    const ok = await deleteAiKey();
    setDeleting(false);
    if (ok) {
      setKey('');
      setNotice('Đã xóa khóa API. Bạn sẽ dùng lượt miễn phí của hệ thống.');
      await loadStatus();
      setTimeout(() => setNotice(''), 3000);
    } else {
      setError('Xóa khóa API thất bại. Vui lòng thử lại.');
    }
  };

  if (loading) {
    return (
      <div className="desktop-card p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-white/40" />
          <span className="text-white/40 text-sm">Đang tải...</span>
        </div>
      </div>
    );
  }

  const hasByokKey = status?.source === 'byok' && status.hasKey;

  return (
    <div className="desktop-card p-6">
      <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-maf-violet" />
        Khóa API cá nhân (dùng AI không giới hạn)
      </h2>
      <p className="text-white/50 text-sm mb-4">
        Tự thêm khóa API của bạn để dùng gợi ý AI không giới hạn (chi phí do bạn trả). Để trống
        nếu muốn dùng lượt miễn phí của hệ thống.
      </p>

      {/* Status / free allowance */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        {hasByokKey ? (
          <>
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-emerald-400 font-bold">
              Đang dùng khóa riêng ({AI_PROVIDER_LABELS[status.provider as AiProvider]})
            </span>
          </>
        ) : (
          <span className="text-white/60">
            Lượt AI miễn phí tháng này: {status?.usageThisMonth ?? 0}/{status?.quota ?? 0}
          </span>
        )}
      </div>

      {notice && (
        <p className="text-emerald-400 text-xs mb-3 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> {notice}
        </p>
      )}
      {error && (
        <p className="text-red-400 text-xs mb-3 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nhà cung cấp</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as AiProvider)}
            className="w-full bg-[#1F2937] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-maf-violet appearance-none cursor-pointer"
          >
            {AI_PROVIDER_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {AI_PROVIDER_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Khóa API</label>
          <SecretInput
            value={key}
            onChange={setKey}
            placeholder={
              hasByokKey
                ? 'Đã lưu (nhập mới để thay đổi)'
                : `Ví dụ: ${AI_PROVIDER_KEY_PREFIX[provider]}...`
            }
            focusBorderColor="focus:border-maf-violet"
          />
          <p className="text-xs text-slate-500 mt-1">Khóa được mã hóa và không bao giờ hiển thị lại.</p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSave}
          disabled={saving || !key.trim()}
          className="flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-sm text-white bg-gradient-to-r from-maf-red to-maf-violet hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Đang lưu...' : 'Lưu khóa'}
        </button>
        {hasByokKey && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Xóa khóa
          </button>
        )}
      </div>
    </div>
  );
}
