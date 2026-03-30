import React from 'react';

// Section: Trường hợp Đặc biệt + Mẹo + FAQ
const GuideSpecialCases: React.FC = () => (
  <div className="space-y-10">
    {/* Trường hợp Đặc biệt */}
    <section id="special-cases" className="space-y-5">
      <h2 className="text-2xl font-bold text-gray-900">Các trường hợp Đặc biệt</h2>

      {/* Trẻ em */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-blue-50 px-4 py-3 flex items-center gap-2">
          <span className="text-xl">👶</span>
          <h3 className="font-semibold text-blue-800">Trẻ em (dưới 16 tuổi)</h3>
        </div>
        <div className="px-4 py-3 text-sm text-gray-700 space-y-1">
          <p>Nếu nhập tuổi dưới 16, hệ thống <strong>không tạo lịch tập</strong> mà hiển thị hướng dẫn riêng:</p>
          <ul className="mt-2 space-y-1 ml-3">
            <li>• Khuyến khích trẻ <strong>chơi tự nhiên</strong>: Chạy nhảy tự do, thể thao, bơi lội, đạp xe</li>
            <li>• <strong>Không cần đo nhịp tim</strong>, không cần lịch trình cố định</li>
            <li>• Để trẻ tận hưởng niềm vui vận động tự nhiên</li>
          </ul>
        </div>
      </div>

      {/* Người cao tuổi */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-amber-50 px-4 py-3 flex items-center gap-2">
          <span className="text-xl">👴</span>
          <h3 className="font-semibold text-amber-800">Người trên 60 tuổi</h3>
        </div>
        <div className="px-4 py-3 text-sm text-gray-700 space-y-1">
          <ul className="space-y-1 ml-3">
            <li>• Công thức MAF vẫn áp dụng bình thường</li>
            <li>• Long Run giới hạn tối đa <strong>90 phút</strong> (an toàn hơn)</li>
            <li>• Cần tick <strong>"Xác nhận Y tế"</strong> để mở gói Hiệu suất</li>
            <li>• Nhấn mạnh: Lắng nghe cơ thể, nghỉ khi mệt</li>
          </ul>
        </div>
      </div>

      {/* BMI cao */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-orange-50 px-4 py-3 flex items-center gap-2">
          <span className="text-xl">🏋️</span>
          <h3 className="font-semibold text-orange-800">BMI ≥ 30 (Béo phì)</h3>
        </div>
        <div className="px-4 py-3 text-sm text-gray-700 space-y-1">
          <ul className="space-y-1 ml-3">
            <li>• Tất cả bài <strong>chạy tự động chuyển thành đi bộ</strong> (bảo vệ khớp gối)</li>
            <li>• Gói Hiệu suất bị <strong>khóa</strong></li>
            <li>• Vẫn tập ở nhịp tim MAF (zone giữ nguyên)</li>
            <li>• Kiên nhẫn đi bộ 1–2 tháng, cân nặng sẽ giảm dần</li>
          </ul>
        </div>
      </div>

      {/* Hồi phục chấn thương */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-red-50 px-4 py-3 flex items-center gap-2">
          <span className="text-xl">🩹</span>
          <h3 className="font-semibold text-red-800">Chế độ Thử thách (Hồi phục Chấn thương)</h3>
        </div>
        <div className="px-4 py-3 text-sm text-gray-700 space-y-3">
          <p>Nếu bạn đang hồi phục sau chấn thương:</p>
          <ol className="space-y-1 ml-3 list-decimal list-inside">
            <li>Tick <strong>"Đang hồi phục bệnh nặng"</strong> hoặc <strong>"Dùng thuốc / Chấn thương"</strong></li>
            <li>Hệ thống hiện <strong>modal đánh giá</strong> với 5 tiêu chí cần tick:
              <ul className="mt-1 ml-4 space-y-0.5 text-gray-600">
                <li>- Hết đau khi sinh hoạt hàng ngày</li>
                <li>- Vận động nhẹ không tăng đau</li>
                <li>- Cuối ngày không đau âm ỉ hay sưng</li>
                <li>- Đã ngưng thuốc giảm đau &gt; 7 ngày</li>
                <li>- Chấp nhận tham gia Giai đoạn Thử thách 2 tuần</li>
              </ul>
            </li>
            <li>Nhấn <strong>"Xác nhận &amp; Bắt đầu Thử thách"</strong></li>
          </ol>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
            <p className="font-semibold text-red-700">Trong 14 ngày thử thách:</p>
            <ul className="space-y-0.5 ml-3 text-gray-700">
              <li>• Khối lượng tập giảm <strong>30%</strong></li>
              <li>• Nhịp tim trừ thêm <strong>-10 bpm</strong> (an toàn hơn)</li>
              <li>• Long Run bị giới hạn thời lượng</li>
              <li>• Thanh tiến trình: <em>"Ngày X/14 — Y ngày còn lại"</em></li>
              <li>• <strong>Tự động mở khóa</strong> sau 14 ngày</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    {/* Mẹo */}
    <section id="tips" className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Mẹo Tập Luyện Hiệu Quả</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { n: '1', tip: 'Kiên nhẫn với pace chậm.', desc: 'Xây nền tảng hiếu khí cần hàng tháng, không phải hàng tuần.' },
          { n: '2', tip: 'Nhất quán > Cường độ.', desc: '3 buổi chạy nhẹ tốt hơn 1 buổi nặng + 2 buổi nghỉ.' },
          { n: '3', tip: 'Tin tưởng vào Zone.', desc: 'Nhịp tim tăng → chạy chậm lại hoặc đi bộ. Không cần xấu hổ.' },
          { n: '4', tip: 'Test lại mỗi tháng.', desc: 'Dùng Phòng MAF Test để kiểm tra tiến bộ.' },
          { n: '5', tip: 'Ghi lại cảm nhận', desc: 'sau Long Run → giúp hệ thống điều chỉnh thông minh hơn.' },
          { n: '6', tip: 'Không ngày nào bằng 0.', desc: 'Dù chấn thương, 30 phút đi bộ vẫn tốt.' },
          { n: '7', tip: 'Ăn uống & Giấc ngủ.', desc: 'Tập luyện = 50% nỗ lực + 50% hồi phục.' },
          { n: '8', tip: 'Hỏi khi cần.', desc: 'Tham vấn coach hoặc bác sĩ nếu không chắc chắn.' },
        ].map(({ n, tip, desc }) => (
          <div key={n} className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg p-3">
            <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
              {n}
            </span>
            <p className="text-sm text-gray-700">
              <strong>{tip}</strong> {desc}
            </p>
          </div>
        ))}
      </div>
    </section>

    {/* FAQ */}
    <section id="faq" className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Câu Hỏi Thường Gặp</h2>
      <div className="space-y-3">
        {[
          {
            q: 'Tại sao pace MAF của tôi chậm thế?',
            a: 'Hoàn toàn bình thường. MAF là xây nền tảng hiếu khí — cảm giác dễ dàng là đúng. Đa số runner đều bất ngờ với pace chậm ban đầu. Kiên nhẫn!',
          },
          {
            q: 'Tôi có thể chạy nhanh hơn không?',
            a: 'Không trong vùng MAF. Nếu nhịp tim vượt zone → chạy chậm lại hoặc đi bộ. Tốc độ sẽ tự cải thiện sau vài tháng.',
          },
          {
            q: 'Có cần theo lịch tập chính xác không?',
            a: 'Dùng làm hướng dẫn. Điều chỉnh theo lịch cá nhân, nhưng tôn trọng ngày nghỉ và giới hạn Long Run.',
          },
          {
            q: 'Nếu không hoàn thành buổi tập thì sao?',
            a: 'Cắt ngắn hoặc đi bộ phần còn lại. Sự nhất quán quan trọng hơn hoàn hảo.',
          },
          {
            q: 'Làm sao biết Chế độ Thử thách đã xong?',
            a: 'Thanh tiến trình hiển thị ngày còn lại. Sau 14 ngày, hệ thống tự động mở khóa. Test lại trong Phòng MAF Test để kiểm tra.',
          },
          {
            q: 'Dữ liệu có được lưu không?',
            a: 'App lưu dữ liệu trên trình duyệt (localStorage). Nếu xóa cache trình duyệt, dữ liệu sẽ mất. Chưa có tính năng lưu trên server.',
          },
        ].map(({ q, a }) => (
          <details key={q} className="border border-gray-200 rounded-lg overflow-hidden group">
            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-800 list-none">
              <span>{q}</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform text-lg leading-none">▾</span>
            </summary>
            <div className="px-4 py-3 text-sm text-gray-700 bg-white">{a}</div>
          </details>
        ))}
      </div>
    </section>
  </div>
);

export default GuideSpecialCases;
