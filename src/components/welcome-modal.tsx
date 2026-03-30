import React, { useState, useEffect } from 'react';
import { AlertTriangle, Shield } from 'lucide-react';

const WelcomeModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Kiểm tra localStorage khi component mount
    const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
    if (!hasSeenWelcome) {
      setIsOpen(true);
    }
  }, []);

  const handleAccept = () => {
    // Lưu vào localStorage
    localStorage.setItem('hasSeenWelcome', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-fade-in-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 p-8 text-center rounded-t-3xl">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-12 h-12 text-white mr-3" />
            <AlertTriangle className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight leading-tight">
            LỜI NHẮN TỪ CỘNG ĐỒNG<br />MAF VIỆT NAM
          </h2>
        </div>

        {/* Body Content */}
        <div className="p-8 md:p-10 space-y-6">
          <p className="text-xl text-gray-800 font-medium leading-relaxed">
            Chào mừng bạn đến với MAF Run. Trước khi bắt đầu, hãy nhớ rằng:
          </p>

          <ul className="space-y-5 text-lg text-gray-700 leading-relaxed">
            <li className="flex items-start">
              <span className="text-2xl mr-4 flex-shrink-0">•</span>
              <div>
                <strong className="text-gray-900">App Chỉ mang tính tham khảo:</strong> Mọi con số và giáo án ở đây là gợi ý dựa trên thuật toán. Cơ thể bạn là duy nhất (với tình trạng sức khỏe, mức độ stress, và bệnh lý riêng biệt).
              </div>
            </li>
            <li className="flex items-start">
              <span className="text-2xl mr-4 flex-shrink-0">•</span>
              <div>
                <strong className="text-gray-900">Lắng nghe cơ thể:</strong> Đừng áp dụng máy móc. Hãy linh hoạt điều chỉnh để tìm ra ngưỡng phù hợp nhất với chính mình.
              </div>
            </li>
            <li className="flex items-start">
              <span className="text-2xl mr-4 flex-shrink-0">•</span>
              <div>
                <strong className="text-gray-900">Kết nối thực tế:</strong> Chúng tôi khuyến khích bạn kết nối Offline với cộng đồng MAFers tại địa phương hoặc tham vấn các Runners kỳ cựu/Coach chuyên nghiệp để có sự điều chỉnh chính xác nhất.
              </div>
            </li>
            <li className="flex items-start">
              <span className="text-2xl mr-4 flex-shrink-0">•</span>
              <div>
                <strong className="text-gray-900">App đang ở phase 1 - Không lưu dữ liệu của bạn trên MAF Server.</strong> Toàn bộ dữ liệu của bạn sẽ lưu trong trình duyệt của bạn dưới dạng cookie. Nên sử dụng 1 thiết bị cố định và tránh dùng trình duyệt ẩn danh để truy sẽ giúp bạn tăng trãi nghiệm sử dụng.
              </div>
            </li>
          </ul>

             <div className="bg-amber-50 border-l-4 border-amber-500 p-5 rounded-lg mt-6">
            <p className="text-lg text-amber-900 font-semibold">
              <strong>Lưu ý:</strong> Kết quả của mỗi cá nhân là khác nhau. Hãy kiên nhẫn và kỷ luật.
            </p>
          </div>
        </div>

        {/* Footer Button */}
        <div className="p-8 md:p-10 pt-0">
          <button
            onClick={handleAccept}
            className="w-full py-5 bg-gradient-to-r from-purple-700 via-pink-600 to-orange-500 text-white font-black text-xl rounded-2xl shadow-lg hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-300 uppercase tracking-wide"
          >
            Tôi đã hiểu & Bắt đầu
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
