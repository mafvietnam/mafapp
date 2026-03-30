import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface ProbationAlertProps {
  daysSinceStart: number;
}

const ProbationAlert: React.FC<ProbationAlertProps> = ({ daysSinceStart }) => (
  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-2xl shadow-lg border-4 border-blue-400">
    <div className="flex items-start space-x-4">
      <div className="bg-blue-200 p-3 rounded-full flex-shrink-0">
        <ShieldCheck className="w-8 h-8 text-blue-700" />
      </div>
      <div className="flex-1">
        <h3 className="text-2xl font-bold text-blue-900 uppercase mb-2 flex items-center">
          🛡️ CHẾ ĐỘ THỬ THÁCH (Ngày {daysSinceStart}/14)
        </h3>
        <p className="text-lg text-blue-800 leading-relaxed font-medium">
          Hệ thống đang giới hạn <strong>70% khối lượng</strong> và giữ{' '}
          <strong>nhịp tim thấp (-10 bpm)</strong> để đảm bảo an toàn tuyệt đối cho bạn. Sau{' '}
          <strong>14 ngày</strong> nếu ổn định sẽ mở khóa hoàn toàn.
        </p>
        <div className="mt-4 flex items-center space-x-2">
          <div className="h-2 flex-1 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
              style={{ width: `${Math.min((daysSinceStart / 14) * 100, 100)}%` }}
            />
          </div>
          <span className="text-blue-700 font-bold text-sm whitespace-nowrap">
            {14 - daysSinceStart} ngày còn lại
          </span>
        </div>
      </div>
    </div>
  </div>
);

export default ProbationAlert;
