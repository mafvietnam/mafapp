import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { getAdminAiSettings, getAdminAiUsage, type AdminAiUsage } from '../../services/admin-ai-service';
import AiSettingsCard from '../../components/admin/ai-settings-card';
import AiUsageTable from '../../components/admin/ai-usage-table';

/** Admin AI coaching page (Phase 5) — mirrors AdminStravaPage layout: header + settings card + usage table. */
export default function AdminAiPage() {
  const [usage, setUsage] = useState<AdminAiUsage | null>(null);
  const [quota, setQuota] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAdminAiSettings(), getAdminAiUsage()]).then(([settings, usageData]) => {
      if (settings) setQuota(settings.defaultMonthlyQuota);
      if (usageData) setUsage(usageData);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-maf-violet" />
          AI Coaching
        </h2>
        <p className="text-sm text-slate-400">Cấu hình khóa OpenRouter, model mặc định và hạn mức AI.</p>
      </div>

      {/* Settings */}
      <AiSettingsCard />

      {/* Usage table */}
      <AiUsageTable usage={usage} loading={loading} quota={quota} />
    </div>
  );
}
