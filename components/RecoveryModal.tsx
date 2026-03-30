import React, { useState } from 'react';
import { X, ShieldCheck, AlertCircle } from 'lucide-react';

interface RecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const RecoveryModal: React.FC<RecoveryModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [checkedItems, setCheckedItems] = useState<boolean[]>([false, false, false, false, false]);

  if (!isOpen) return null;

  const handleCheckboxChange = (index: number) => {
    const newCheckedItems = [...checkedItems];
    newCheckedItems[index] = !newCheckedItems[index];
    setCheckedItems(newCheckedItems);
  };

  const allChecked = checkedItems.every(item => item === true);

  const handleConfirm = () => {
    if (allChecked) {
      onConfirm();
      // Reset checkboxes after confirmation
      setCheckedItems([false, false, false, false, false]);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset checkboxes when closing
    setCheckedItems([false, false, false, false, false]);
  };

  const criteria = [
    "Tôi đã hoàn toàn hết đau khi sinh hoạt hàng ngày.",
    "Tôi vận động nhẹ (đi bộ/chạy chậm) không thấy đau tăng lên.",
    "Cuối ngày không có hiện tượng đau âm ỉ hay sưng tấy trở lại.",
    "Tôi đã ngưng sử dụng thuốc giảm đau/kháng viêm > 7 ngày.",
    "Tôi chấp nhận tham gia \"Giai đoạn Thử thách\" (2 tuần) trước khi tập nặng."
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-teal-600 to-cyan-600 p-6 rounded-t-3xl">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex items-center justify-center space-x-3">
            <div className="bg-white/20 p-3 rounded-full">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-wide">
              🩺 ĐÁNH GIÁ SẴN SÀNG TẬP LUYỆN
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 md:p-8 space-y-6">
          
          {/* Introduction */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-5 rounded-lg">
            <p className="text-lg text-blue-900 leading-relaxed">
              Theo <strong>Dr. Phil Maffetone</strong> (Chương 24 - The Big Book of Endurance Training), 
              để đảm bảo chấn thương không tái phát, bạn cần vượt qua bài kiểm tra sau:
            </p>
          </div>

          {/* Checklist Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Tiêu chí đánh giá (Bắt buộc tick đủ 5/5)
              </h3>
              <span className="text-sm font-bold text-gray-500">
                {checkedItems.filter(item => item).length}/5
              </span>
            </div>

            {criteria.map((criterion, index) => (
              <label
                key={index}
                className={`flex items-start space-x-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  checkedItems[index]
                    ? 'bg-teal-50 border-teal-500 shadow-md'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checkedItems[index]}
                  onChange={() => handleCheckboxChange(index)}
                  className="w-6 h-6 text-teal-600 rounded focus:ring-2 focus:ring-teal-500 mt-1 flex-shrink-0"
                />
                <span className={`text-base leading-relaxed ${
                  checkedItems[index] ? 'text-teal-900 font-medium' : 'text-gray-700'
                }`}>
                  {criterion}
                </span>
              </label>
            ))}
          </div>

          {/* Warning Box */}
          <div className="bg-amber-50 border-2 border-amber-300 p-5 rounded-xl">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
              <div className="space-y-2">
                <h4 className="font-bold text-amber-900 text-lg">
                  ⚠️ Cam kết "Giai đoạn Thử thách"
                </h4>
                <p className="text-amber-800 leading-relaxed">
                  Trong <strong>14 ngày tới</strong>, hệ thống sẽ tự động:
                </p>
                <ul className="list-disc list-inside text-amber-800 space-y-1 ml-2">
                  <li>Giảm 30% khối lượng tập luyện toàn bộ tuần</li>
                  <li>Giữ nhịp tim ở mức thấp (trừ -10 bpm như đang hồi phục)</li>
                  <li>Giới hạn thời lượng Long Run để bảo vệ cơ thể</li>
                  <li>Tự động mở khóa sau 14 ngày nếu ổn định</li>
                </ul>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 p-6 rounded-b-3xl border-t border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <button
              onClick={handleClose}
              className="flex-1 px-6 py-4 bg-white border-2 border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleConfirm}
              disabled={!allChecked}
              className={`flex-1 px-6 py-4 font-bold rounded-xl transition-all ${
                allChecked
                  ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:shadow-lg transform hover:-translate-y-0.5'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              ✅ Xác nhận & Bắt đầu Thử thách
            </button>
          </div>
          
          {!allChecked && (
            <p className="text-center text-sm text-gray-500 mt-3 italic">
              Vui lòng tick đủ 5 tiêu chí để tiếp tục
            </p>
          )}
        </div>

      </div>
    </div>
  );
};

export default RecoveryModal;
