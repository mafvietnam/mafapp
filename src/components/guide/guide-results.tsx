import React from 'react';

// Section: Đọc hiểu Kết quả — MAF zone, schedule, alerts, golden rules
const GuideResults: React.FC = () => (
  <section id="results" className="space-y-6">
    <h2 className="text-2xl font-bold text-gray-900">Đọc hiểu Kết quả</h2>

    {/* Nhịp Tim Mục Tiêu */}
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-3">Nhịp Tim Mục Tiêu (MAF)</h3>
      <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 mb-3">
        <div>Nhịp Tim Mục Tiêu (MAF): 140 BPM</div>
        <div>Zone: 130 - 140 bpm</div>
      </div>
      <ul className="text-sm text-gray-700 space-y-1 mb-3">
        <li>• Khi chạy, giữ nhịp tim <strong>trong vùng Zone</strong> (VD: 130–140)</li>
        <li>• Nếu nhịp tim vượt quá → <strong>chạy chậm lại hoặc đi bộ</strong></li>
        <li>• Dùng đồng hồ thể thao hoặc dây đeo ngực để theo dõi nhịp tim</li>
      </ul>
      <p className="text-sm text-gray-600">
        <strong>BMI:</strong> Hiển thị chỉ số BMI và phân loại (Bình thường, Thừa cân, Béo phì...).
      </p>
    </div>

    {/* Giải thích & Cảnh báo */}
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-2">Giải thích &amp; Cảnh báo</h3>
      <ul className="text-sm text-gray-700 space-y-2">
        <li className="flex items-start gap-2">
          <span className="text-blue-500 flex-shrink-0">ℹ</span>
          <span><strong>Giải thích</strong>: Giải thích cách tính nhịp tim MAF của bạn</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-yellow-500 flex-shrink-0">⚠️</span>
          <span><strong>Cảnh báo</strong>: Các lưu ý quan trọng dựa trên tình trạng sức khỏe</span>
        </li>
      </ul>
    </div>

    {/* Quy Tắc Vàng */}
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-3">Tư duy Cốt lõi &amp; Quy Tắc Vàng</h3>
      <p className="text-sm text-gray-700 mb-3">
        Hiển thị mindset phù hợp với trình độ của bạn, kèm 3 quy tắc vàng:
      </p>
      <div className="space-y-2">
        {[
          { num: '1', title: 'Chạy MAF', desc: 'Tuyệt đối không để tim vượt quá nhịp tim MAF' },
          { num: '2', title: 'Hồi phục', desc: 'Chạy chậm, thoải mái, giữ tim dưới ngưỡng dưới của Zone' },
          { num: '3', title: 'Luật 15/15', desc: 'Luôn dành 15 phút đầu/cuối để khởi động/thả lỏng' },
        ].map(({ num, title, desc }) => (
          <div key={num} className="flex items-start gap-3 bg-purple-50 border border-purple-100 rounded-lg p-3">
            <span className="w-7 h-7 rounded-full bg-purple-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
              {num}
            </span>
            <div className="text-sm text-gray-800">
              <strong className="text-purple-800">{title}:</strong> {desc}
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Điều chỉnh Khối lượng */}
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-2">Điều chỉnh Khối lượng Tập</h3>
      <p className="text-sm text-gray-700 mb-2">Nếu bạn nhập pace tháng trước, hệ thống hiển thị:</p>
      <div className="space-y-2 text-sm">
        <div className="bg-green-50 border-l-4 border-green-500 rounded-r-lg p-3 text-green-800">
          <strong>TẬP TIẾN ĐỘ</strong> (màu xanh): Bạn đang tiến bộ, khối lượng được tăng
        </div>
        <div className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-3 text-red-800">
          <strong>TẬP HỒI QUY</strong> (màu đỏ): Cần giảm tải để hồi phục
        </div>
        <div className="bg-gray-50 border-l-4 border-gray-400 rounded-r-lg p-3 text-gray-700">
          <strong>TẬP ỔN ĐỊNH</strong>: Giữ nguyên khối lượng hiện tại
        </div>
      </div>
    </div>

    {/* Lịch Trình */}
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-3">Lịch Trình Chi Tiết (7 ngày)</h3>
      <div className="overflow-x-auto rounded-lg border border-gray-200 mb-3">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Cột</th>
              <th className="text-left px-4 py-2 font-semibold">Ý nghĩa</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Ngày', 'Thứ 2 → Chủ Nhật'],
              ['Nội dung bài tập', 'Loại bài tập (Chạy MAF, Long Run, Nghỉ ngơi...)'],
              ['Thời lượng', 'Số phút tập'],
            ].map(([col, meaning], i) => (
              <tr key={col} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-2 font-medium text-gray-900">{col}</td>
                <td className="px-4 py-2 text-gray-700">{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm font-semibold text-gray-700 mb-2">Các loại bài tập:</p>
      <ul className="text-sm text-gray-700 space-y-1 mb-3">
        {[
          '🏃 Chạy MAF — Chạy ở nhịp tim MAF',
          '🏃 Chạy dài (Long Run) — Chạy dài ở nhịp tim MAF',
          '🚶 Đi bộ nhanh — Đi bộ (nếu BMI cao, tất cả bài chạy chuyển thành đi bộ)',
          '😌 Nghỉ ngơi — Nghỉ hoàn toàn hoặc hoạt động nhẹ',
          '🧘 Yoga — Bài tập linh hoạt, thư giãn',
          '🔄 Chạy nhẹ hồi phục — Chạy rất chậm để phục hồi',
        ].map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="text-sm text-gray-600">
        Mỗi bài chạy đều có <strong>hướng dẫn chi tiết</strong> (nhấn vào để xem):
        Khởi động → Bài chính → Thả lỏng.
      </p>
      <div className="mt-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-3 text-sm text-blue-800">
        Luôn lắng nghe cơ thể. Nếu cảm thấy mệt mỏi bất thường, hãy nghỉ ngơi thêm.
      </div>
    </div>
  </section>
);

export default GuideResults;
