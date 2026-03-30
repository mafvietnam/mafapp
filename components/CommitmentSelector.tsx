
import React from 'react';
import { CommitmentLevel, ExperienceLevel } from '../types';
import { COMMITMENT_CARDS } from '../constants';

interface CommitmentSelectorProps {
  selected: CommitmentLevel;
  onSelect: (level: CommitmentLevel) => void;
  age: string;
  height: string;
  weight: string;
  experience: ExperienceLevel;
  isRecovering: boolean;
  isMedicatedOrInjured: boolean;
  isMedicalClearanceConfirmed: boolean;
}

export const CommitmentSelector: React.FC<CommitmentSelectorProps> = ({ 
  selected, 
  onSelect, 
  age,
  height,
  weight,
  experience,
  isRecovering,
  isMedicatedOrInjured,
  isMedicalClearanceConfirmed
}) => {
  // Check if any health restriction is active to shift recommendation
  const hasHealthRestriction = isRecovering || isMedicatedOrInjured;
  
  const ageNum = parseInt(age);
  const isSenior = !isNaN(ageNum) && ageNum >= 60;

  // Calculate BMI for Joint Safety Protocol
  const h = parseFloat(height);
  const w = parseFloat(weight);
  let bmi = 0;
  if (!isNaN(h) && !isNaN(w) && h > 0) {
    bmi = w / Math.pow(h / 100, 2);
  }
  const isObese = bmi >= 30;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
      {COMMITMENT_CARDS.map((card) => {
        // --- LOGIC: DISABLE STATES (PRIORITY ORDER) ---
        let isDisabled = false;
        let disabledMessage = "";
        let isRedAlarm = false;

        // PRIORITY 1: RED ALARM (Recovering/Surgery) - Highest Priority
        // Applies to ALL AGES. Blocks BASE and PERFORMANCE.
        if (isRecovering) {
          if (card.id === CommitmentLevel.BASE || card.id === CommitmentLevel.PERFORMANCE) {
            isDisabled = true;
            isRedAlarm = true;
            disabledMessage = "Dựa trên tình trạng y tế bạn cung cấp, hệ thống KHÓA các bài tập cường độ cao để bảo vệ bạn khỏi biến chứng.";
          }
        }
        // PRIORITY 2: JOINT SAFETY PROTOCOL (BMI >= 30) & YELLOW ALARM
        // Blocks PERFORMANCE.
        else if (isObese || isMedicatedOrInjured) {
          if (card.id === CommitmentLevel.PERFORMANCE) {
            isDisabled = true;
            if (isObese) {
              disabledMessage = "BMI > 30: Vô hiệu hóa gói Hiệu suất cao để bảo vệ khớp gối.";
            } else {
              disabledMessage = "Không phù hợp khi đang dùng thuốc hoặc chấn thương.";
            }
          }
        }
        // PRIORITY 3: SENIOR SAFETY (Age >= 60)
        else if (isSenior) {
          if (card.id === CommitmentLevel.PERFORMANCE) {
             // Case B: Age >= 60 -> Lock Performance regardless of confirmation
             isDisabled = true;
             disabledMessage = "Giới hạn an toàn cho độ tuổi > 60";
          } else if (card.id === CommitmentLevel.BASE && !isMedicalClearanceConfirmed) {
             // Case A: Age >= 60 AND Not Confirmed -> Block Base
             isDisabled = true;
             disabledMessage = "Cần xác nhận y tế để mở khóa";
          }
        }
        // PRIORITY 4: EXPERIENCE SAFETY
        else if (experience === ExperienceLevel.NONE || experience === ExperienceLevel.INCONSISTENT) {
           if (card.id === CommitmentLevel.PERFORMANCE) {
             isDisabled = true;
             disabledMessage = "Cần kinh nghiệm tập luyện đều đặn để tham gia gói Hiệu suất cao.";
           }
        }

        // --- LOGIC: RECOMMENDED BADGE ---
        // If has restriction OR (Senior & Not Confirmed) OR Obese -> Recommend HEALTH (Card 1) or BASE (if only Obese but allows Base)
        // Actually, for BMI > 30, we recommend Health or Base, but usually Health is safer starter.
        // Let's force Health recommendation if Red Alarm or Senior Not Confirmed.
        
        let forceHealthRec = isRecovering || (isSenior && !isMedicalClearanceConfirmed);
        
        // If Obese, we strongly suggest starting low impact, but Base is allowed (modified to walking). 
        // However, visually pointing to Health is safer.
        if (isObese) forceHealthRec = true;

        const isRecommended = forceHealthRec 
          ? card.id === CommitmentLevel.HEALTH 
          : card.recommended;

        const isSelected = selected === card.id;
        const Icon = card.icon;

        return (
          <div
            key={card.id}
            onClick={() => !isDisabled && onSelect(card.id)}
            className={`
              relative rounded-2xl p-6 border-2 transition-all duration-300 shadow-sm flex flex-col h-full
              ${isDisabled 
                ? 'opacity-60 cursor-not-allowed bg-gray-100 border-gray-200 grayscale-[0.8]' 
                : 'cursor-pointer'
              }
              ${!isDisabled && isSelected 
                ? 'border-transparent ring-4 ring-purple-500/50 bg-white shadow-xl transform scale-[1.02] z-10' 
                : !isDisabled 
                  ? 'border-gray-200 bg-white hover:border-purple-200 hover:shadow-lg'
                  : ''
              }
            `}
          >
            {/* Disabled Overlay/Message */}
            {isDisabled && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-50/80 rounded-2xl p-4 text-center backdrop-blur-[1px]">
                 <div className={`text-white text-base font-bold px-4 py-4 rounded-lg shadow-lg max-w-[95%] leading-relaxed ${isRedAlarm ? 'bg-red-600' : 'bg-gray-800/90'}`}>
                    {isRedAlarm && <div className="uppercase border-b border-red-400 mb-2 pb-1 text-sm tracking-wider">⛔ Cảnh báo Y Tế</div>}
                    {disabledMessage}
                 </div>
              </div>
            )}

            {/* Gradient border effect for selected state */}
            {!isDisabled && isSelected && (
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-700 via-pink-600 to-orange-500 opacity-5 pointer-events-none"></div>
            )}

            {!isDisabled && isRecommended && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-base font-bold px-4 py-1.5 rounded-full shadow-md z-20 whitespace-nowrap uppercase tracking-wide">
                KHUYÊN DÙNG
              </div>
            )}

            <div className="flex flex-col items-center text-center space-y-4 flex-grow">
              <div className={`p-4 rounded-full ${isSelected ? 'bg-gray-100' : 'bg-gray-50'}`}>
                <Icon className={`w-10 h-10 ${card.color}`} />
              </div>
              <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">{card.title}</h3>
              <p className="text-lg font-bold text-gray-700">{card.hours}</p>
              <p className="text-base text-gray-600 leading-relaxed font-medium">{card.benefit}</p>
            </div>
            
            {/* Hidden Radio for Accessibility */}
            <input 
              type="radio" 
              name="commitment" 
              value={card.id} 
              checked={isSelected}
              onChange={() => !isDisabled && onSelect(card.id)}
              disabled={isDisabled}
              className="sr-only"
            />
          </div>
        );
      })}
    </div>
  );
};
