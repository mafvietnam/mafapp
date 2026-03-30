import React from 'react';

// Section: MAF là gì + Bắt đầu sử dụng
const GuideGettingStarted: React.FC = () => (
  <section id="getting-started" className="space-y-6">
    {/* MAF là gì */}
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">MAF là gì?</h2>
      <div className="bg-purple-50 border-l-4 border-purple-600 rounded-r-lg p-4 text-gray-800 leading-relaxed">
        <p>
          <strong>MAF</strong> (Maximum Aerobic Function) là phương pháp tập luyện của Dr. Phil
          Maffetone, tập trung xây dựng nền tảng hiếu khí bằng cách chạy ở nhịp tim tối ưu.
          Mục tiêu: chạy nhanh hơn ở cùng nhịp tim (hoặc cùng tốc độ ở nhịp tim thấp hơn) theo
          thời gian.
        </p>
        <p className="mt-3 font-semibold text-purple-700">
          Nguyên tắc cốt lõi: Chạy chậm hôm nay = Chạy nhanh ngày mai.
        </p>
      </div>
    </div>

    <hr className="border-gray-200" />

    {/* Bắt đầu sử dụng */}
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">Bắt đầu sử dụng</h2>
      <p className="text-gray-700 mb-3">
        Khi mở app lần đầu, bạn sẽ thấy <strong>màn hình chào mừng</strong> với lời nhắn từ
        cộng đồng MAF Việt Nam. Đọc kỹ các lưu ý:
      </p>
      <ul className="space-y-2 mb-4">
        {[
          'App chỉ mang tính tham khảo, kết quả mỗi người là khác nhau',
          'Hãy lắng nghe cơ thể và điều chỉnh linh hoạt',
          'Khuyến khích kết nối với cộng đồng MAFers tại địa phương',
          'App đang ở phase 1 — không lưu dữ liệu trên server',
        ].map((item) => (
          <li key={item} className="flex items-start gap-2 text-gray-700">
            <span className="text-purple-600 mt-0.5 flex-shrink-0">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800 text-sm">
        Nhấn <strong>"Tôi đã hiểu &amp; Bắt đầu"</strong> để vào app.
      </div>
    </div>
  </section>
);

export default GuideGettingStarted;
