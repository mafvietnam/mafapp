import { Bot, CalendarCheck, Sparkles, ChevronRight } from 'lucide-react';

/** MAF AI Assistant card — glass on mobile, solid on desktop */
export default function MafAssistantCard() {
  return (
    <>
      {/* Mobile version (glass) */}
      <div className="lg:hidden glass-card rounded-[20px] p-4 relative overflow-hidden">
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <h3 className="text-white font-bold text-[15px] mb-2 flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-maf-red" /> Trợ lý MAF
            </h3>
            <ul className="space-y-1.5">
              <li className="text-[10px] font-medium text-slate-200 flex items-center gap-2">
                <CalendarCheck className="w-3 h-3 text-maf-red" />
                Lên lịch tập theo chuẩn MAF
              </li>
              <li className="text-[10px] font-medium text-slate-200 flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-maf-violet" />
                Gợi ý giáo án cá nhân hóa
              </li>
            </ul>
          </div>
          <button className="bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-full pl-3 pr-2.5 py-2 text-[11px] font-bold flex items-center gap-1 transition-all backdrop-blur-sm">
            Lên Lịch Tập <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Desktop version (solid card) */}
      <div className="hidden lg:block desktop-card p-6 relative overflow-hidden border-maf-violet/30">
        <div className="absolute top-0 right-0 w-32 h-32 bg-maf-violet/10 rounded-full blur-2xl" />
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-maf-violet/20 flex items-center justify-center border border-maf-violet/30">
            <Bot className="w-5 h-5 text-maf-violet" />
          </div>
          <h3 className="text-lg font-bold text-white">Trợ lý cá nhân MAF</h3>
        </div>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Hệ thống đã phân tích dữ liệu tuần này. Bạn nên thực hiện một bài chạy{' '}
          <strong className="text-white">Recovery 45 phút</strong> vào ngày mai để duy trì nhịp tim chuẩn.
        </p>
        <button className="w-full bg-maf-violet/10 hover:bg-maf-violet/20 text-maf-violet border border-maf-violet/30 rounded-lg py-3 text-sm font-bold transition-all">
          Xem Giáo Án Đề Xuất
        </button>
      </div>
    </>
  );
}
