import React from 'react';
import { Calendar, TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ScheduleItem } from '../types';

interface ResultScheduleTableProps {
  scheduleTitle: string;
  schedule: ScheduleItem[];
  longRunAdjustmentMessage?: string;
  longRunAdjustmentType?: 'INCREASE' | 'MAINTAIN' | 'DECREASE' | 'CAP';
}

const ResultScheduleTable: React.FC<ResultScheduleTableProps> = ({
  scheduleTitle,
  schedule,
  longRunAdjustmentMessage,
  longRunAdjustmentType,
}) => (
  <div className="w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
    <div className="bg-gradient-to-r from-purple-700 via-pink-600 to-orange-500 p-4 md:p-6 text-center">
      <h2 className="text-lg md:text-2xl font-bold text-white uppercase tracking-wide flex items-center justify-center">
        <Calendar className="w-5 h-5 md:w-7 md:h-7 mr-2 md:mr-3" />
        LỊCH TRÌNH CHI TIẾT
      </h2>
      <p className="text-white/80 mt-1 text-xs md:text-base">{scheduleTitle}</p>
    </div>

    <div className="p-0 overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="p-3 md:p-5 text-[11px] md:text-xs font-extrabold text-gray-500 uppercase tracking-wider w-[18%]">
              Ngày
            </th>
            <th className="p-3 md:p-5 text-[11px] md:text-xs font-extrabold text-gray-500 uppercase tracking-wider w-[62%]">
              Nội dung bài tập
            </th>
            <th className="p-3 md:p-5 text-[11px] md:text-xs font-extrabold text-gray-500 uppercase tracking-wider text-right w-[20%]">
              Thời lượng
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {schedule.map((item, index) => (
            <tr key={index} className="hover:bg-gray-50 transition-colors group">
              <td className="p-3 md:p-5 font-bold text-gray-800 align-top text-sm md:text-lg border-r border-gray-50 bg-white group-hover:bg-gray-50/50">
                {item.day}
              </td>
              <td className="p-3 md:p-5 align-top">
                {/* Main badge */}
                <div className="mb-2 md:mb-3">
                  <span
                    className={`inline-flex items-center px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-sm md:text-base font-bold border shadow-sm
                      ${item.type === 'REST' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                        item.type === 'LONG_RUN' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                        item.type === 'WALK' ? 'bg-green-100 text-green-800 border-green-200' :
                        item.type === 'CROSS_TRAIN' ? 'bg-teal-100 text-teal-800 border-teal-200' :
                        item.type === 'RECOVERY' ? 'bg-green-50 text-green-700 border-green-200' :
                        'bg-purple-100 text-purple-800 border-purple-200'}`}
                  >
                    {item.activity.split('\n')[0]}
                  </span>
                </div>

                {/* Smart Long Run adjustment badge */}
                {item.type === 'LONG_RUN' && longRunAdjustmentMessage && (
                  <div
                    className={`mt-2 md:mt-3 p-2.5 md:p-3 rounded-lg border-l-4 flex items-start space-x-2 ${
                      longRunAdjustmentType === 'INCREASE' ? 'bg-green-50 border-green-500' :
                      longRunAdjustmentType === 'DECREASE' ? 'bg-red-50 border-red-500' :
                      longRunAdjustmentType === 'CAP' ? 'bg-amber-50 border-amber-500' :
                      'bg-blue-50 border-blue-500'
                    }`}
                  >
                    {longRunAdjustmentType === 'INCREASE' && (
                      <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    )}
                    {longRunAdjustmentType === 'DECREASE' && (
                      <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    {longRunAdjustmentType === 'CAP' && (
                      <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    )}
                    {longRunAdjustmentType === 'MAINTAIN' && (
                      <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    )}
                    <span
                      className={`text-xs md:text-sm font-medium ${
                        longRunAdjustmentType === 'INCREASE' ? 'text-green-800' :
                        longRunAdjustmentType === 'DECREASE' ? 'text-red-800' :
                        longRunAdjustmentType === 'CAP' ? 'text-amber-800' :
                        'text-blue-800'
                      }`}
                    >
                      {longRunAdjustmentMessage}
                    </span>
                  </div>
                )}

                {/* Session detail lines */}
                {item.activity.includes('\n') && (
                  <div className="mt-3 space-y-1.5 md:space-y-2 pl-1 md:pl-2">
                    {item.activity.split('\n').slice(1).map((line, i) => (
                      <p
                        key={i}
                        className="text-xs md:text-sm text-gray-700 font-medium leading-relaxed border-l-4 border-blue-100 pl-3 md:pl-4"
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </td>
              <td className="p-3 md:p-5 text-right font-black text-gray-900 align-top">
                {item.duration > 0 ? (
                  <span className="inline-block bg-gray-100 px-2.5 py-1 md:px-4 md:py-2 rounded-lg md:rounded-xl text-gray-800 text-base md:text-2xl whitespace-nowrap">
                    {item.duration}'
                  </span>
                ) : (
                  <span className="text-gray-300 text-base md:text-2xl">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="bg-gray-50 p-3 md:p-4 text-center border-t border-gray-200">
      <p className="text-gray-400 text-xs md:text-sm italic">
        *Lưu ý: Luôn lắng nghe cơ thể. Nếu cảm thấy mệt mỏi bất thường, hãy nghỉ ngơi thêm.
      </p>
    </div>
  </div>
);

export default ResultScheduleTable;
