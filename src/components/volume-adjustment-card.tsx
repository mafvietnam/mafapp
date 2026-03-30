import React from 'react';
import { TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';

interface VolumeAdjustmentCardProps {
  message: string;
  type: 'PROGRESS' | 'REGRESSION' | 'STABLE';
}

const VolumeAdjustmentCard: React.FC<VolumeAdjustmentCardProps> = ({ message, type }) => {
  const isProgress = type === 'PROGRESS';
  const isRegression = type === 'REGRESSION';

  const containerClass = isProgress
    ? 'bg-green-50 border-green-400'
    : isRegression
    ? 'bg-red-50 border-red-400'
    : 'bg-blue-50 border-blue-400';

  const iconBgClass = isProgress ? 'bg-green-200' : isRegression ? 'bg-red-200' : 'bg-blue-200';

  const titleClass = isProgress
    ? 'text-green-800'
    : isRegression
    ? 'text-red-800'
    : 'text-blue-800';

  const textClass = isProgress
    ? 'text-green-900'
    : isRegression
    ? 'text-red-900'
    : 'text-blue-900';

  return (
    <div className={`p-6 rounded-2xl shadow-lg border-4 ${containerClass}`}>
      <div className="flex items-start space-x-4">
        <div className={`p-3 rounded-full ${iconBgClass}`}>
          {isProgress && <TrendingUp className="w-8 h-8 text-green-700" />}
          {isRegression && <TrendingDown className="w-8 h-8 text-red-700" />}
          {!isProgress && !isRegression && <CheckCircle2 className="w-8 h-8 text-blue-700" />}
        </div>
        <div className="flex-1">
          <h3 className={`text-xl font-bold mb-2 uppercase ${titleClass}`}>
            ĐIỀU CHỈNH KHỐI LƯỢNG TẬP
          </h3>
          <p className={`text-lg leading-relaxed ${textClass}`}>{message}</p>
        </div>
      </div>
    </div>
  );
};

export default VolumeAdjustmentCard;
