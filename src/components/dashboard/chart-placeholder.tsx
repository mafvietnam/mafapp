import { BarChart3 } from 'lucide-react';

/** Chart placeholder for desktop — shows when no Strava data */
export default function ChartPlaceholder() {
  return (
    <div className="hidden lg:block desktop-card p-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-white">Biểu đồ tiến độ MAF Test</h3>
        <select className="bg-[#1F2937] border border-white/10 text-sm text-white rounded-md px-3 py-1.5 outline-none focus:border-maf-violet">
          <option>3 tháng qua</option>
          <option>6 tháng qua</option>
          <option>Năm nay</option>
        </select>
      </div>
      <div className="h-64 flex flex-col items-center justify-center">
        <BarChart3 className="w-12 h-12 text-white/10 mb-3" />
        <p className="text-slate-500 text-sm">Chưa có dữ liệu MAF Test</p>
        <p className="text-slate-600 text-xs mt-1">Thực hiện bài test MAF đầu tiên để xem tiến độ</p>
      </div>
    </div>
  );
}
