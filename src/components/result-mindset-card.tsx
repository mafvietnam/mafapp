import React from 'react';
import { Activity as ActivityIcon, Lock, Zap } from 'lucide-react';

interface ResultMindsetCardProps {
  mindset: string;
  mafHeartRate: number;
  lowerZone: number;
  ageNum: number;
  volumeCapText: string;
}

const ResultMindsetCard: React.FC<ResultMindsetCardProps> = ({
  mindset,
  mafHeartRate,
  lowerZone,
  ageNum,
  volumeCapText,
}) => (
  <div className="space-y-6">
    {/* Mindset */}
    <div className="bg-white p-6 rounded-2xl shadow-md border-t-4 border-blue-500">
      <h3 className="text-base font-bold text-gray-400 uppercase mb-3 flex items-center">
        <ActivityIcon className="w-4 h-4 mr-2" /> Tư duy Cốt lõi
      </h3>
      <p className="text-xl text-gray-800 italic leading-relaxed font-medium text-center px-4">
        "{mindset}"
      </p>
      <div className="mt-6 pt-4 border-t border-gray-100 text-base text-gray-600 flex justify-center items-center">
        <Lock className="w-4 h-4 mr-2 text-gray-400" />
        <span>
          Trần Giới Hạn Tuần: <strong>{volumeCapText}</strong>{' '}
          {ageNum > 50 && (
            <span className="text-amber-700 font-bold ml-2">(trên 50 tuổi max 2.5h/run)</span>
          )}
        </span>
      </div>
    </div>

    {/* Golden Rules */}
    <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-200 shadow-md">
      <div className="flex items-center justify-center mb-6">
        <Zap className="w-6 h-6 text-amber-600 mr-2" />
        <h4 className="text-xl font-bold text-amber-900 uppercase tracking-wide">Quy Tắc Vàng</h4>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center">
          <div className="bg-yellow-200 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 text-lg font-bold text-yellow-800">
            1
          </div>
          <h5 className="font-bold text-amber-900 uppercase mb-1 text-sm">Chạy MAF</h5>
          <p className="text-amber-800 text-sm">
            Tuyệt đối không để tim vượt quá <strong>{mafHeartRate} bpm</strong>.
          </p>
        </div>
        <div className="text-center">
          <div className="bg-yellow-200 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 text-lg font-bold text-yellow-800">
            2
          </div>
          <h5 className="font-bold text-amber-900 uppercase mb-1 text-sm">Hồi phục</h5>
          <p className="text-amber-800 text-sm">
            Chạy chậm, thoải mái, giữ tim dưới <strong>{lowerZone} bpm</strong>.
          </p>
        </div>
        <div className="text-center">
          <div className="bg-yellow-200 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 text-lg font-bold text-yellow-800">
            3
          </div>
          <h5 className="font-bold text-amber-900 uppercase mb-1 text-sm">Luật 15/15</h5>
          <p className="text-amber-800 text-sm">
            Luôn dành <strong>15 phút</strong> đầu/cuối để khởi động/thả lỏng.
          </p>
        </div>
      </div>
    </div>
  </div>
);

export default ResultMindsetCard;
