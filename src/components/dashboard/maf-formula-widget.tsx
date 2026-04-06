/** MAF Formula configuration widget — desktop sidebar */
export default function MafFormulaWidget() {
  return (
    <div className="hidden lg:block desktop-card p-6">
      <h3 className="text-base font-bold text-white mb-4">Công thức tính MAF</h3>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">Tuổi của bạn</label>
          <div className="mt-1 flex items-center bg-[#1F2937] rounded-lg border border-white/5 overflow-hidden">
            <input
              type="number"
              defaultValue={35}
              className="bg-transparent w-full px-4 py-2.5 text-white outline-none"
            />
            <span className="px-4 text-slate-500 text-sm">Tuổi</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">Yếu tố điều chỉnh</label>
          <select className="mt-1 w-full bg-[#1F2937] rounded-lg border border-white/5 px-4 py-2.5 text-white text-sm outline-none appearance-none cursor-pointer">
            <option>Không có vấn đề sức khỏe (+0)</option>
            <option>Mới ốm dậy / Dùng thuốc (-10)</option>
            <option>Chưa tập luyện thường xuyên (-5)</option>
            <option>Tập luyện đều đặn &gt; 2 năm (+5)</option>
          </select>
        </div>

        <div className="pt-2">
          <button className="w-full bg-white/5 hover:bg-white/10 text-white rounded-lg py-2.5 text-sm font-bold transition-all border border-white/10">
            Cập nhật Vùng Nhịp Tim
          </button>
        </div>
      </div>
    </div>
  );
}
