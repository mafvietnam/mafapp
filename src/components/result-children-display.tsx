import React from 'react';
import { Smile, Activity as ActivityIcon, Lightbulb } from 'lucide-react';
import { MafResult } from '../types';

interface ResultChildrenDisplayProps {
  result: MafResult;
}

const ResultChildrenDisplay: React.FC<ResultChildrenDisplayProps> = ({ result }) => (
  <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-5 md:p-8 rounded-2xl shadow-xl border-4 border-green-300">
    <div className="flex items-center justify-center mb-5 md:mb-6">
      <Smile className="w-9 h-9 md:w-12 md:h-12 text-green-600 mr-3 md:mr-4" />
      <h2 className="text-xl md:text-3xl font-bold text-green-800 uppercase tracking-wide">
        {result.scheduleTitle}
      </h2>
    </div>

    <div className="bg-white p-5 md:p-6 rounded-xl shadow-md mb-5 md:mb-6 border-l-8 border-green-500">
      <h3 className="text-base md:text-xl font-bold text-gray-700 mb-3 md:mb-4 flex items-center">
        <Lightbulb className="w-5 h-5 md:w-6 md:h-6 text-yellow-500 mr-2 md:mr-3 flex-shrink-0" />
        Hướng dẫn của Dr. Phil Maffetone
      </h3>
      <p className="text-base md:text-xl text-gray-800 leading-relaxed italic">"{result.mindset}"</p>
    </div>

    <div className="bg-white p-5 md:p-8 rounded-xl shadow-md border border-green-200">
      <h3 className="text-lg md:text-2xl font-bold text-green-700 mb-5 md:mb-6 text-center flex items-center justify-center">
        <ActivityIcon className="w-6 h-6 md:w-8 md:h-8 mr-2 md:mr-3" />
        Các hoạt động được khuyên dùng
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
          <h4 className="font-bold text-blue-800 mb-1.5 md:mb-2 text-base md:text-lg">🏃 Chạy nhảy tự do</h4>
          <p className="text-sm md:text-base text-blue-700">Chơi đuổi bắt, chạy thi với bạn bè</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
          <h4 className="font-bold text-purple-800 mb-1.5 md:mb-2 text-base md:text-lg">⚽ Thể thao</h4>
          <p className="text-sm md:text-base text-purple-700">Bóng đá, bóng rổ, cầu lông...</p>
        </div>
        <div className="bg-cyan-50 p-4 rounded-lg border-2 border-cyan-200">
          <h4 className="font-bold text-cyan-800 mb-1.5 md:mb-2 text-base md:text-lg">🏊 Bơi lội</h4>
          <p className="text-sm md:text-base text-cyan-700">Vui chơi trong nước, học bơi</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
          <h4 className="font-bold text-orange-800 mb-1.5 md:mb-2 text-base md:text-lg">🚴 Đạp xe</h4>
          <p className="text-sm md:text-base text-orange-700">Đạp xe quanh khu phố, công viên</p>
        </div>
      </div>
    </div>

    <div className="mt-5 md:mt-6 bg-amber-50 p-5 md:p-6 rounded-xl border-l-8 border-amber-400">
      <p className="text-amber-900 font-medium text-sm md:text-lg">
        <strong>LƯU Ý:</strong> Không cần đo nhịp tim, không cần theo lịch trình cố định. Hãy để
        trẻ tận hưởng niềm vui vận động tự nhiên!
      </p>
    </div>
  </div>
);

export default ResultChildrenDisplay;
