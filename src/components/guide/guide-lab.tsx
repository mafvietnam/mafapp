import React from 'react';

// Section: Phòng MAF Test — 3-step wizard explanation
const GuideLab: React.FC = () => (
  <section id="lab" className="space-y-6">
    <h2 className="text-2xl font-bold text-gray-900">Tab "Phòng MAF Test" (LAB)</h2>
    <p className="text-gray-700">
      Nhấn tab <strong>"Phòng MAF Test"</strong> ở đầu trang để vào phòng test.
    </p>

    {/* Giới thiệu */}
    <div className="bg-purple-50 border-l-4 border-purple-600 rounded-r-lg p-4 text-gray-800 text-sm">
      <strong>Phòng MAF Test là gì?</strong>
      <p className="mt-1">
        Đây là nơi bạn <strong>xác minh pace MAF thực tế</strong> — tốc độ chạy mà nhịp tim
        đạt đúng vùng MAF. Pace này sẽ được dùng để tối ưu hóa lịch tập.
      </p>
    </div>

    {/* Bước 1 */}
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
          1
        </span>
        <h3 className="text-xl font-semibold text-gray-800">Bước 1: Quy Chuẩn</h3>
      </div>
      <p className="text-sm text-gray-700 mb-3">
        Trước khi nhập dữ liệu, xác nhận 4 điều kiện:
      </p>
      <div className="space-y-2">
        {[
          'Đã đeo thiết bị đo nhịp tim (Heart Rate Monitor / Chest Strap)',
          'Đã test trên đường phẳng hoặc sân vận động',
          'Đã cố gắng giữ nhịp tim DƯỚI nhịp tim MAF mục tiêu',
          'Đã hoàn thành 15 phút khởi động trước khi bấm giờ',
        ].map((cond) => (
          <div key={cond} className="flex items-start gap-2 text-sm text-gray-700">
            <span className="text-green-500 mt-0.5 flex-shrink-0 font-bold">☑</span>
            <span>{cond}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-gray-600">
        Tick đủ 4 điều kiện → Nhấn <strong>"BẮT ĐẦU GHI NHẬN →"</strong>
      </p>
    </div>

    {/* Bước 2 */}
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
          2
        </span>
        <h3 className="text-xl font-semibold text-gray-800">Bước 2: Nhập Dữ Liệu Thô</h3>
      </div>
      <p className="text-sm text-gray-700 mb-3">Nhập 3 thông tin từ bài test:</p>
      <div className="overflow-x-auto rounded-lg border border-gray-200 mb-3">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Trường</th>
              <th className="text-left px-4 py-2 font-semibold">Mô tả</th>
              <th className="text-left px-4 py-2 font-semibold">Ví dụ</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Tổng Cự ly (Km)', 'Quãng đường đã chạy', '5'],
              ['Tổng Thời gian', 'Giờ : Phút : Giây', '00:30:00'],
              ['Nhịp tim trung bình (Avg HR)', 'Lấy từ đồng hồ/app chạy bộ', '142'],
            ].map(([field, desc, ex], i) => (
              <tr key={field} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-2 font-medium text-gray-900">{field}</td>
                <td className="px-4 py-2 text-gray-700">{desc}</td>
                <td className="px-4 py-2 text-gray-500">{ex}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-600">
        Nhấn <strong>"TÍNH TOÁN &amp; THẨM ĐỊNH ⏱️"</strong>
      </p>
    </div>

    {/* Bước 3 */}
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
          3
        </span>
        <h3 className="text-xl font-semibold text-gray-800">Bước 3: Thẩm Định Kết quả</h3>
      </div>
      <p className="text-sm text-gray-700 mb-3">
        Hệ thống kiểm tra nhịp tim trung bình so với nhịp tim MAF mục tiêu:
      </p>
      <div className="space-y-3">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 font-semibold text-green-700 mb-1">
            <span>✅</span> Nếu nhịp tim hợp lệ (≤ MAF):
          </div>
          <ul className="text-sm text-gray-700 space-y-1 ml-5">
            <li>Hiển thị: <strong>"Dữ Liệu Hợp Lệ"</strong></li>
            <li>Pace thực tế của bạn (VD: <code className="bg-gray-100 px-1 rounded">6:00 /km</code>)</li>
            <li><em>"Tuyệt vời! Bạn đã tuân thủ đúng kỷ luật nhịp tim."</em></li>
            <li>Nhấn <strong>"SỬ DỤNG PACE NÀY"</strong> để lưu</li>
          </ul>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 font-semibold text-yellow-700 mb-1">
            <span>⚠️</span> Nếu nhịp tim cao hơn MAF:
          </div>
          <ul className="text-sm text-gray-700 space-y-1 ml-5">
            <li>Hiển thị: <strong>"Cảnh Báo Nhịp Tim Cao"</strong></li>
            <li><em>"Bài chạy này có nhịp tim trung bình cao hơn ngưỡng MAF..."</em></li>
            <li>Hệ thống tự động <strong>cộng thêm 1 phút 30 giây</strong> vào pace để điều chỉnh</li>
            <li>Nhấn <strong>"CHẤP NHẬN PACE ĐIỀU CHỈNH"</strong> để lưu</li>
          </ul>
        </div>
      </div>
      <div className="mt-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-3 text-sm text-blue-800">
        Sau khi lưu pace, hệ thống tự động quay về tab <strong>Kế Hoạch Tập Luyện</strong> và
        dùng pace này để tối ưu lịch tập.
      </div>
    </div>
  </section>
);

export default GuideLab;
