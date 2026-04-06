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
  isMedicalClearanceConfirmed,
}) => {
  const ageNum = parseInt(age);
  const isSenior = !isNaN(ageNum) && ageNum >= 60;
  const h = parseFloat(height);
  const w = parseFloat(weight);
  let bmi = 0;
  if (!isNaN(h) && !isNaN(w) && h > 0) bmi = w / Math.pow(h / 100, 2);
  const isObese = bmi >= 30;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
      {COMMITMENT_CARDS.map((card) => {
        let isDisabled = false;
        let disabledMessage = '';
        let isRedAlarm = false;

        if (isRecovering) {
          if (card.id === CommitmentLevel.BASE || card.id === CommitmentLevel.PERFORMANCE) {
            isDisabled = true;
            isRedAlarm = true;
            disabledMessage = 'Hệ thống KHÓA bài tập cường độ cao để bảo vệ bạn.';
          }
        } else if (isObese || isMedicatedOrInjured) {
          if (card.id === CommitmentLevel.PERFORMANCE) {
            isDisabled = true;
            disabledMessage = isObese
              ? 'BMI > 30: Vô hiệu hóa để bảo vệ khớp gối.'
              : 'Không phù hợp khi đang dùng thuốc hoặc chấn thương.';
          }
        } else if (isSenior) {
          if (card.id === CommitmentLevel.PERFORMANCE) {
            isDisabled = true;
            disabledMessage = 'Giới hạn an toàn cho độ tuổi > 60';
          } else if (card.id === CommitmentLevel.BASE && !isMedicalClearanceConfirmed) {
            isDisabled = true;
            disabledMessage = 'Cần xác nhận y tế để mở khóa';
          }
        } else if (
          (experience === ExperienceLevel.NONE || experience === ExperienceLevel.INCONSISTENT) &&
          card.id === CommitmentLevel.PERFORMANCE
        ) {
          isDisabled = true;
          disabledMessage = 'Cần kinh nghiệm tập luyện đều đặn để tham gia gói Hiệu suất cao.';
        }

        const forceHealthRec = isRecovering || (isSenior && !isMedicalClearanceConfirmed) || isObese;
        const isRecommended = forceHealthRec ? card.id === CommitmentLevel.HEALTH : card.recommended;
        const isSelected = selected === card.id;
        const Icon = card.icon;

        return (
          <div
            key={card.id}
            onClick={() => !isDisabled && onSelect(card.id)}
            className={`
              relative rounded-2xl p-6 border-2 transition-all duration-300 flex flex-col h-full
              ${isDisabled
                ? 'opacity-40 cursor-not-allowed border-white/5 bg-white/5 grayscale'
                : 'cursor-pointer'
              }
              ${!isDisabled && isSelected
                ? 'border-maf-violet bg-maf-violet/10 shadow-[0_0_20px_rgba(145,48,248,0.2)]'
                : !isDisabled
                  ? 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                  : ''
              }
            `}
          >
            {isDisabled && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl p-4 text-center bg-maf-dark/80 backdrop-blur-sm">
                <div className={`text-white text-sm font-bold px-4 py-3 rounded-lg max-w-[95%] leading-relaxed ${isRedAlarm ? 'bg-red-600/90' : 'bg-white/10 border border-white/20'}`}>
                  {isRedAlarm && <div className="uppercase border-b border-red-400 mb-2 pb-1 text-xs tracking-wider">Cảnh báo Y Tế</div>}
                  {disabledMessage}
                </div>
              </div>
            )}

            {!isDisabled && isRecommended && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-maf-red to-maf-violet text-white text-xs font-bold px-3 py-1 rounded-full shadow-md z-20 whitespace-nowrap uppercase tracking-wide">
                KHUYÊN DÙNG
              </div>
            )}

            <div className="flex flex-col items-center text-center space-y-3 flex-grow">
              <div className={`p-3 rounded-full ${isSelected ? 'bg-maf-violet/20' : 'bg-white/5'}`}>
                <Icon className={`w-8 h-8 ${card.color}`} />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">{card.title}</h3>
              <p className="text-sm font-bold text-white/70">{card.hours}</p>
              <p className="text-sm text-white/50 leading-relaxed">{card.benefit}</p>
            </div>

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
