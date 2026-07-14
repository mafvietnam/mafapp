import React from 'react';
import { Scale } from 'lucide-react';

interface ResultHeartRateCardProps {
  mafHeartRate: number;
  lowerZone: number;
  upperZone: number;
  bmi: number;
  bmiCategory: string;
}

const ResultHeartRateCard: React.FC<ResultHeartRateCardProps> = ({
  mafHeartRate,
  lowerZone,
  upperZone,
  bmi,
  bmiCategory,
}) => (
  <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
    <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-3 text-center md:text-left md:px-6">
      <h3 className="text-gray-300 uppercase text-sm font-bold tracking-widest">
        Nhịp Tim Mục Tiêu (MAF)
      </h3>
    </div>
    <div className="p-5 md:p-8 bg-gradient-to-br from-white to-gray-50 flex flex-col md:flex-row items-center justify-between gap-5 md:gap-6">
      {/* BPM number */}
      <div className="flex items-baseline">
        <span className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 leading-none">
          {mafHeartRate}
        </span>
        <span className="text-base md:text-lg font-bold text-gray-400 ml-2 tracking-wider">BPM</span>
      </div>
      {/* Zone + BMI */}
      <div className="flex flex-col items-center md:items-end space-y-3 w-full md:w-auto">
        <div className="bg-purple-100 px-4 py-2 md:px-5 rounded-xl border border-purple-200 w-full md:w-auto text-center md:text-right">
          <p className="text-purple-900 font-bold text-base md:text-lg">
            Zone: {lowerZone} - {upperZone} bpm
          </p>
          <p className="text-purple-600 text-xs font-medium uppercase">Vùng Hiệu Suất Tối Đa</p>
        </div>
        <div
          className={`px-5 py-2 rounded-xl border font-bold text-base flex items-center justify-center md:justify-end w-full md:w-auto ${
            bmi >= 25
              ? 'bg-orange-100 text-orange-900 border-orange-200'
              : 'bg-green-100 text-green-900 border-green-200'
          }`}
        >
          <Scale className="w-4 h-4 mr-2" />
          BMI: {bmi} ({bmiCategory})
        </div>
      </div>
    </div>
  </div>
);

export default ResultHeartRateCard;
