import React from 'react';

// Section: Tab Kế Hoạch Tập Luyện — form fields, experience levels, commitment cards
const GuidePlanTab: React.FC = () => (
  <section id="plan-tab" className="space-y-6">
    <h2 className="text-2xl font-bold text-gray-900">Tab "Kế Hoạch Tập Luyện" (PLAN)</h2>
    <p className="text-gray-700">
      Đây là tab chính, gồm 3 phần: <strong>Thông tin cá nhân</strong>,{' '}
      <strong>Sức khỏe</strong>, và <strong>Mức độ cam kết</strong>.
    </p>

    {/* 1. Thông tin cá nhân */}
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-3">1. Nhập Thông tin Cá nhân</h3>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
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
              ['Tuổi', 'Tuổi hiện tại', '35'],
              ['Cao (cm)', 'Chiều cao tính bằng cm', '170'],
              ['Nặng (kg)', 'Cân nặng tính bằng kg', '65'],
              ['Kinh nghiệm', 'Chọn mức phù hợp (xem bảng dưới)', '—'],
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

      <h4 className="text-base font-semibold text-gray-800 mt-4 mb-2">Các mức kinh nghiệm:</h4>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Lựa chọn</th>
              <th className="text-left px-4 py-2 font-semibold">Ý nghĩa</th>
              <th className="text-left px-4 py-2 font-semibold">Ảnh hưởng</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Chưa từng chạy', 'Chưa có kinh nghiệm chạy bộ', 'Nhịp tim MAF không thay đổi'],
              ['Chạy lâu nhưng ngắt quãng / Tim cao', 'Đã chạy nhưng không đều, hoặc nhịp tim nghỉ cao', 'MAF trừ 5 nhịp (an toàn hơn)'],
              ['Đang tập đều < 2 năm', 'Tập đều đặn nhưng chưa đủ 2 năm', 'Nhịp tim MAF không thay đổi'],
              ['Tập liên tục > 2 năm, thành tích tốt', 'Runner kỳ cựu, thể lực tốt', 'MAF cộng 5 nhịp (thử thách hơn)'],
            ].map(([choice, meaning, effect], i) => (
              <tr key={choice} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">{choice}</td>
                <td className="px-4 py-2 text-gray-700">{meaning}</td>
                <td className="px-4 py-2 text-gray-600">{effect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* 2. Sức khỏe */}
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-3">2. Đánh giá Sức khỏe</h3>
      <p className="text-gray-700 mb-3">Tick vào các ô nếu áp dụng:</p>
      <ul className="space-y-2 mb-3">
        {[
          '"Đang hồi phục bệnh nặng" → MAF trừ thêm 10 nhịp',
          '"Dùng thuốc / Chấn thương" → MAF trừ thêm 5 nhịp',
          '"Xác nhận Y tế" → Chỉ hiện khi bạn trên 60 tuổi, cần xác nhận bác sĩ đồng ý',
        ].map((item) => (
          <li key={item} className="flex items-start gap-2 text-gray-700 text-sm">
            <span className="text-red-500 mt-0.5 flex-shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-3 text-sm text-yellow-800">
        <strong>Lưu ý cho người mới:</strong> Nếu bạn chọn "Chưa từng chạy", hệ thống sẽ hiện
        thông báo: <em>"Giai đoạn này chỉ cần quan tâm đến Thời gian và Nhịp tim. Chạy thật chậm!"</em>
      </div>
    </div>

    {/* 3. Cam kết */}
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-3">3. Chọn Mức độ Cam kết</h3>
      <p className="text-gray-700 mb-4">Bạn sẽ thấy <strong>3 thẻ</strong> để chọn:</p>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="border-2 border-green-500 rounded-xl p-4 bg-green-50">
          <div className="text-lg font-bold text-green-700 mb-1">💚 SỨC KHỎE &amp; ĐỐT MỠ</div>
          <div className="text-sm text-green-600 font-medium mb-2">3-4 giờ/tuần</div>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>Phù hợp: Người bận, người mới, muốn giảm cân</li>
            <li>3 buổi chạy/tuần + 1 Long Run (tối đa 60 phút)</li>
            <li>Trần khối lượng: 240 phút/tuần</li>
          </ul>
        </div>
        <div className="border-2 border-orange-500 rounded-xl p-4 bg-orange-50 relative">
          <div className="absolute -top-3 right-3 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            KHUYÊN DÙNG
          </div>
          <div className="text-lg font-bold text-orange-700 mb-1">🔥 XÂY DỰNG NỀN TẢNG</div>
          <div className="text-sm text-orange-600 font-medium mb-2">5-6 giờ/tuần</div>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>Phù hợp: Đa số runner, muốn xây nền tảng hiếu khí vững</li>
            <li>4-5 buổi/tuần + 1 Long Run (90 phút)</li>
            <li>Trần khối lượng: 420 phút/tuần</li>
          </ul>
        </div>
        <div className="border-2 border-purple-500 rounded-xl p-4 bg-purple-50">
          <div className="text-lg font-bold text-purple-700 mb-1">⚡ THI ĐẤU &amp; CẠNH TRANH</div>
          <div className="text-sm text-purple-600 font-medium mb-2">7-12 giờ/tuần</div>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>Phù hợp: Runner muốn thi đấu, có thời gian tập nhiều</li>
            <li>6 buổi/tuần + 1 Long Run (120 phút)</li>
            <li>Trần khối lượng: 720 phút/tuần</li>
            <li className="text-orange-600 font-medium">⚠️ Yêu cầu nghiêm ngặt về hồi phục</li>
          </ul>
        </div>
      </div>

      <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-gray-700 mb-2">Khi nào gói bị khóa?</p>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• BMI &gt; 30: Gói Hiệu suất bị khóa để bảo vệ khớp gối</li>
          <li>• Đang dùng thuốc/chấn thương: Gói Hiệu suất bị khóa</li>
          <li>• Tuổi &gt; 60 chưa xác nhận y tế: Gói Hiệu suất bị khóa</li>
          <li>• Người mới/ngắt quãng: Cần kinh nghiệm đều đặn mới mở gói Hiệu suất</li>
        </ul>
      </div>
    </div>

    {/* 4. So sánh Pace */}
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-2">4. So sánh Pace (Tùy chọn)</h3>
      <p className="text-gray-700 text-sm mb-2">Nếu bạn đã có pace MAF từ tháng trước:</p>
      <ul className="text-sm text-gray-700 space-y-1 mb-3">
        <li>• <strong>Pace MAF Hiện tại</strong>: Hiển thị nếu đã test trong Phòng MAF Test</li>
        <li>• <strong>Pace MAF Tháng Trước</strong>: Nhập pace cũ (VD: <code className="bg-gray-100 px-1 rounded">6:30</code>) để so sánh</li>
      </ul>
      <div className="grid gap-2 sm:grid-cols-3 text-sm">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800">
          <strong>Nhanh hơn tháng trước</strong><br />Tăng 10% khối lượng
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800">
          <strong>Chậm hơn tháng trước</strong><br />Giảm 30% khối lượng
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-700">
          <strong>Giữ nguyên</strong><br />Lịch tập ổn định
        </div>
      </div>
    </div>

    {/* 5. Long Run data */}
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-2">5. Dữ liệu Long Run (Tùy chọn)</h3>
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
              ['Thời gian (phút)', 'Thời gian chạy Long Run gần nhất', '90'],
              ['Nhịp tim TB (bpm)', 'Nhịp tim trung bình trong bài Long Run', '145'],
              ['Cảm nhận', 'Chọn: 😊 Tốt / 😰 Hơi mệt / 😫 Rất mệt', '—'],
            ].map(([f, d, e], i) => (
              <tr key={f} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-2 font-medium text-gray-900">{f}</td>
                <td className="px-4 py-2 text-gray-700">{d}</td>
                <td className="px-4 py-2 text-gray-500">{e}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-3 text-sm text-blue-800">
        <strong>Nhấn "PHÂN TÍCH &amp; LẬP KẾ HOẠCH"</strong> để hệ thống tính toán và hiển thị
        kết quả bên dưới.
      </div>
    </div>
  </section>
);

export default GuidePlanTab;
