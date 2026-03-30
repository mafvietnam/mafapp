
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, ExperienceLevel, CommitmentLevel, MafResult, ScheduleItem } from './types';
import { EXPERIENCE_OPTIONS } from './constants';
import { CommitmentSelector } from './components/commitment-selector';
import { MafLab } from './components/maf-lab';
import WelcomeModal from './components/welcome-modal';
import RecoveryModal from './components/recovery-modal';
import { getWeeklySchedule, adjustScheduleForSafety, adjustForProbation, formatSessionDetails, calculateSmartLongRun, enforceWeeklyVolumeCap, VOLUME_CAPS, formatWeeklyVolumeSummary } from './utils/maf-logic';
import { AlertTriangle, Calendar, Activity as ActivityIcon, ShieldCheck, Scale, Ruler, Smile, TrendingUp, AlertCircle, BarChart3, Lock, Zap, Timer, CheckCircle2, TrendingDown, Info, ClipboardList, Beaker, LayoutDashboard, Leaf, Lightbulb } from 'lucide-react';

const App: React.FC = () => {
  // --- NAVIGATION STATE ---
  const [activeTab, setActiveTab] = useState<'PLAN' | 'LAB'>('PLAN');

  // --- USER PROFILE STATE ---
  const [userProfile, setUserProfile] = useState<UserProfile>({
    age: '',
    height: '',
    weight: '',
    experience: ExperienceLevel.NONE,
    isRecovering: false,
    isMedicatedOrInjured: false,
    isMedicalClearanceConfirmed: false,
    commitment: CommitmentLevel.BASE,
    previousMonthPace: '', // Optional field for volume adjustment
  });

  // --- VERIFIED DATA STATE (FROM LAB) ---
  const [verifiedMafPace, setVerifiedMafPace] = useState<string | null>(null);

  // --- RECOVERY MODAL STATE ---
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  // --- ANALYSIS RESULT STATE ---
  const [result, setResult] = useState<MafResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Helpers
  const ageNum = parseInt(userProfile.age);
  const isSenior = !isNaN(ageNum) && ageNum >= 60;
  const isChild = !isNaN(ageNum) && ageNum > 0 && ageNum < 16;
  const isNewbie = userProfile.experience === ExperienceLevel.NONE;

  // Calculate MAF HR early for passing to Lab
  const calculateRawMaf = () => {
    if (isNaN(ageNum) || ageNum < 1) return null;
    let maf = 180 - ageNum;
    if (userProfile.isRecovering) maf -= 10;
    if (userProfile.isMedicatedOrInjured) maf -= 5;
    const expOption = EXPERIENCE_OPTIONS.find(opt => opt.value === userProfile.experience);
    if (expOption) maf += expOption.score;
    return maf;
  };

  const getBMI = () => {
    const h = parseFloat(userProfile.height);
    const w = parseFloat(userProfile.weight);
    if (!isNaN(h) && !isNaN(w) && h > 0) {
      const bmiValue = w / Math.pow(h / 100, 2);
      if (bmiValue > 100) return 0;
      return parseFloat(bmiValue.toFixed(1));
    }
    return 0;
  };

  const parsePaceToSeconds = (paceStr: string): number => {
    if (!paceStr) return 0;
    if (!paceStr.includes(':')) {
       const val = parseFloat(paceStr);
       return isNaN(val) ? 0 : val * 60;
    }
    const parts = paceStr.split(':');
    const min = parseInt(parts[0]) || 0;
    const sec = parseInt(parts[1]) || 0;
    return min * 60 + sec;
  };

  // --- HANDLERS ---

  const handleLabComplete = (pace: string) => {
    setVerifiedMafPace(pace);
    setActiveTab('PLAN');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUserProfile((prev) => {
      let newCommitment = prev.commitment;
      if (name === 'experience') {
        if ((value === ExperienceLevel.NONE || value === ExperienceLevel.INCONSISTENT) && prev.commitment === CommitmentLevel.PERFORMANCE) {
           newCommitment = CommitmentLevel.BASE;
        }
      }
      return { ...prev, [name]: value, commitment: newCommitment };
    });
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let numVal = parseFloat(value);
    if (isNaN(numVal)) return;
    let newVal = numVal;
    if (name === 'age') {
       if (numVal > 120) newVal = 120;
       if (numVal < 1) newVal = 1;
    }
    if (name === 'height') {
      if (numVal < 100) newVal = 100;
      if (numVal > 250) newVal = 250;
    }
    if (name === 'weight') {
      if (numVal < 30) newVal = 30;
      if (numVal > 200) newVal = 200;
    }
    if (newVal !== numVal) {
      setUserProfile(prev => ({ ...prev, [name]: newVal.toString() }));
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setUserProfile((prev) => {
      let newCommitment = prev.commitment;
      const nextState = { ...prev, [name]: checked };
      if (name === 'isRecovering' && checked) newCommitment = CommitmentLevel.HEALTH;
      if (name === 'isMedicatedOrInjured' && checked && !prev.isRecovering) {
        if (prev.commitment === CommitmentLevel.PERFORMANCE) newCommitment = CommitmentLevel.HEALTH;
      }
      return { ...nextState, commitment: newCommitment };
    });
  };

  const handleCommitmentSelect = (level: CommitmentLevel) => {
    if (userProfile.isRecovering && (level === CommitmentLevel.BASE || level === CommitmentLevel.PERFORMANCE)) return;
    const bmi = getBMI();
    const isObese = bmi >= 30;
    if ((userProfile.isMedicatedOrInjured || isObese) && level === CommitmentLevel.PERFORMANCE) return;
    if (!isNaN(ageNum) && ageNum >= 60) {
      if (level === CommitmentLevel.PERFORMANCE) return; 
      if (level === CommitmentLevel.BASE && !userProfile.isMedicalClearanceConfirmed) return;
    }
    if ((userProfile.experience === ExperienceLevel.NONE || userProfile.experience === ExperienceLevel.INCONSISTENT) && level === CommitmentLevel.PERFORMANCE) return;
    setUserProfile(prev => ({ ...prev, commitment: level }));
  };

  const handleRecoveryConfirm = () => {
    setUserProfile(prev => ({
      ...prev,
      isProbation: true,
      probationStartDate: new Date().toISOString(),
      isRecovering: false,
      isMedicatedOrInjured: false
    }));
    setShowRecoveryModal(false);
  };

  const calculateDaysSinceStart = () => {
    if (!userProfile.probationStartDate) return 0;
    const start = new Date(userProfile.probationStartDate);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const calculateMAF = () => {
    if (isNaN(ageNum)) return;
    
    // SPECIAL RULE: CHILDREN < 16 (Chapter 29)
    if (isChild) {
      setResult({
        mafHeartRate: 0,
        upperZone: 0,
        lowerZone: 0,
        notes: [],
        explanation: undefined,
        scheduleTitle: 'HƯỚNG DẪN CHO TRẺ EM',
        schedule: [
          { day: 'Hằng ngày', activity: 'VUI CHƠI TỰ NHIÊN - Không theo lịch trình cố định', duration: 0, type: 'REST' },
        ],
        mindset: 'Trẻ em dưới 16 tuổi KHÔNG NÊN tập luyện theo kế hoạch tập luyện có cấu trúc. Thay vào đó, hãy khuyến khích trẻ VUI CHƠI tự nhiên: chạy nhảy, bơi lội, đạp xe, chơi thể thao với bạn bè. Để cơ thể phát triển tự nhiên qua vận động vui vẻ!',
        bmi: 0,
        bmiCategory: 'Trẻ em'
      });
      
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return;
    }
    
    const bmi = getBMI();
    if (bmi === 0) {
      alert("Vui lòng kiểm tra lại Chiều cao và Cân nặng!");
      return;
    }

    let maf = 180 - ageNum;
    const notes: string[] = [];
    const isObese = bmi >= 30;
    
    // --- DETERMINE EFFECTIVE PACE & EXPLANATION ---
    const hasVerifiedPace = verifiedMafPace && verifiedMafPace.trim() !== "";
    let effectivePace = hasVerifiedPace ? verifiedMafPace! : "10:00";
    let explanation = "";
    let bmiCategory = "Bình thường";
    
    if (!hasVerifiedPace) {
        // ADAPTIVE DEFAULT PACE LOGIC
        if (bmi >= 30) {
            effectivePace = "18:00";
            bmiCategory = "Béo phì";
            explanation = `💡 HỆ THỐNG TỰ ĐỘNG TÍNH TOÁN:\nVì bạn chưa có kết quả Test, chúng tôi đã chọn Pace ${effectivePace} min/km (Đi bộ) dựa trên chỉ số BMI ${bmi} của bạn để đảm bảo an toàn xương khớp.`;
        } else if (bmi >= 25) {
            effectivePace = "14:00";
            bmiCategory = "Thừa cân";
            explanation = `💡 HỆ THỐNG TỰ ĐỘNG TÍNH TOÁN:\nVì bạn chưa có kết quả Test, chúng tôi đã chọn Pace ${effectivePace} min/km (Đi bộ nhanh) dựa trên chỉ số BMI ${bmi} của bạn để giảm tải cho tim.`;
        } else {
            effectivePace = "10:00";
            bmiCategory = bmi < 18.5 ? "Thiếu cân" : "Bình thường";
            explanation = `ℹ️ HỆ THỐNG TỰ ĐỘNG:\nSử dụng Pace mặc định an toàn ${effectivePace} min/km cho thể trạng bình thường.`;
        }
    } else {
        if (bmi >= 30) bmiCategory = "Béo phì";
        else if (bmi >= 25) bmiCategory = "Thừa cân";
        else if (bmi < 18.5) bmiCategory = "Thiếu cân";
    }

    // --- MAF HEART RATE CALCULATION ---
    if (userProfile.isRecovering) {
      maf -= 10;
      notes.push("Đã trừ 10 nhịp (Đang hồi phục bệnh/phẫu thuật)");
    }
    if (userProfile.isMedicatedOrInjured) {
      maf -= 5;
      notes.push("Đã trừ 5 nhịp (Dùng thuốc/Chấn thương)");
    }
    // PROBATION MODE: Keep -10 adjustment for heart rate safety
    if (userProfile.isProbation) {
      maf -= 10;
      notes.push("🛡️ CHẾ ĐỘ THỬ THÁCH: Đã trừ 10 nhịp để bảo vệ an toàn tuyệt đối");
    }
    const expOption = EXPERIENCE_OPTIONS.find(opt => opt.value === userProfile.experience);
    if (expOption) {
      if (expOption.score !== 0) {
        maf += expOption.score;
        const action = expOption.score > 0 ? "cộng" : "trừ";
        notes.push(`Đã ${action} ${Math.abs(expOption.score)} nhịp (${expOption.label})`);
      }
      if (userProfile.experience === ExperienceLevel.INCONSISTENT) {
        notes.push("CẢNH BÁO: Đã điều chỉnh giảm 5 nhịp để xây lại nền tảng hiếu khí do tim cao/ngắt quãng.");
      }
    }

    const lowerZone = maf - 10;
    let mindset = "";
    if (userProfile.experience === ExperienceLevel.NONE || userProfile.experience === ExperienceLevel.REGULAR_NEW) {
      mindset = "Hãy bắt đầu thật chậm. Nếu nhịp tim vượt quá MAF, hãy đi bộ ngay lập tức. Đừng lo lắng về tốc độ (Pace), hãy tập trung vào nhịp tim.";
    } else {
      mindset = "Bỏ lại cái tôi ở nhà. Chạy chậm để chạy nhanh hơn. Bạn sẽ cảm thấy như đang chạy quá chậm, nhưng hãy tin tưởng vào quá trình sinh lý học.";
    }
    if (ageNum > 60 && userProfile.experience === ExperienceLevel.ADVANCED) {
       mindset = `Tuyệt vời! Bác là tấm gương cho thế hệ trẻ. Hãy tận hưởng kế hoạch tập luyện an toàn này. ${mindset}`;
    }

    // --- GENERATE SCHEDULE ---
    let finalSchedule = getWeeklySchedule(userProfile.commitment);
    finalSchedule = adjustScheduleForSafety(finalSchedule, userProfile, bmi);

    // --- PACE COMPARISON & VOLUME ADJUSTMENT (MAF Test Logic) ---
    let volumeAdjustmentMessage: string | undefined;
    let volumeAdjustmentType: 'PROGRESS' | 'REGRESSION' | 'STABLE' | undefined;
    
    const hasPreviousPace = userProfile.previousMonthPace && userProfile.previousMonthPace.trim() !== "";
    const hasCurrentPace = verifiedMafPace && verifiedMafPace.trim() !== "";
    
    if (hasCurrentPace && hasPreviousPace) {
      const currentPaceSeconds = parsePaceToSeconds(verifiedMafPace!);
      const previousPaceSeconds = parsePaceToSeconds(userProfile.previousMonthPace!);
      
      if (currentPaceSeconds > 0 && previousPaceSeconds > 0) {
        // Delta: positive = slower (regression), negative = faster (progress)
        const delta = currentPaceSeconds - previousPaceSeconds;
        
        if (delta < -10) {
          // PROGRESS: Faster by more than 10 seconds
          volumeAdjustmentType = 'PROGRESS';
          const improvement = Math.abs(delta);
          volumeAdjustmentMessage = `📈 PHÁT HIỆN TIẾN BỘ: Pace của bạn nhanh hơn ${improvement}s/km so với tháng trước! Hệ thống đã tăng thời gian bài chạy dài (Long Run) thêm 10% để tối ưu hóa nền tảng hiếu khí.`;
          
          // Increase Long Run duration by 10%
          const longRunIndex = finalSchedule.findIndex(s => s.type === 'LONG_RUN');
          if (longRunIndex !== -1) {
            const originalDuration = finalSchedule[longRunIndex].duration;
            const newDuration = Math.round(originalDuration * 1.1);
            
            // Apply safety caps
            let cappedDuration = newDuration;
            if (ageNum >= 60 && cappedDuration > 90) cappedDuration = 90;
            if (isNewbie && cappedDuration > 60) cappedDuration = 60;
            
            finalSchedule[longRunIndex] = {
              ...finalSchedule[longRunIndex],
              duration: cappedDuration
            };
          }
          
        } else if (delta > 10) {
          // REGRESSION: Slower by more than 10 seconds
          volumeAdjustmentType = 'REGRESSION';
          const decline = Math.abs(delta);
          volumeAdjustmentMessage = `📉 CẢNH BÁO SỨC KHỎE: Pace của bạn chậm hơn ${decline}s/km so với tháng trước. Hệ thống đã kích hoạt CHẾ ĐỘ HỒI PHỤC - Giảm 30% khối lượng tập toàn bộ tuần để ngăn ngừa quá tải và phục hồi sức khỏe.`;
          
          // Decrease ALL workout durations by 30%
          finalSchedule = finalSchedule.map(item => {
            if (item.duration > 0) {
              const newDuration = Math.round(item.duration * 0.7);
              // Minimum 15 minutes (for 15/15 rule)
              const minDuration = item.type === 'REST' ? 0 : Math.max(newDuration, 15);
              return {
                ...item,
                duration: minDuration
              };
            }
            return item;
          });
          
        } else {
          // STABLE: Within 10 seconds
          volumeAdjustmentType = 'STABLE';
          volumeAdjustmentMessage = `✅ ỔN ĐỊNH: Pace của bạn duy trì ổn định so với tháng trước (chênh lệch ${Math.abs(delta)}s). Hệ thống giữ nguyên lịch tập chuẩn.`;
        }
      }
    }

    // SYNC: Global replacement of "Run" with "Walk" if BMI >= 30
    if (bmi >= 30) {
       finalSchedule = finalSchedule.map(item => ({
          ...item,
          activity: item.activity.replace(/Chạy/g, "Đi bộ"),
          type: 'WALK'
       }));
    } else if (bmi >= 25 && !hasVerifiedPace) {
        // For overweight using default pace, suggest brisk walk/jog
        finalSchedule = finalSchedule.map(item => ({
            ...item,
            activity: item.activity.replace(/Chạy/g, "Đi bộ nhanh / Jogging"),
         }));
    }

    // APPLY PROBATION MODE: 70% volume reduction
    if (userProfile.isProbation) {
      finalSchedule = adjustForProbation(finalSchedule);
    }

    // --- SMART LONG RUN CALCULATION (History-based) ---
    let longRunAdjustmentMessage: string | undefined;
    let longRunAdjustmentType: 'INCREASE' | 'MAINTAIN' | 'DECREASE' | 'CAP' | undefined;
    let isLongRunCapped = false;
    
    // Only apply smart calculation if user has experience > 6 months and schedule has Long Run
    const longRunIndex = finalSchedule.findIndex(s => s.type === 'LONG_RUN');
    const hasExperience = userProfile.experience === ExperienceLevel.REGULAR_NEW || userProfile.experience === ExperienceLevel.ADVANCED;
    
    if (longRunIndex !== -1 && hasExperience && !userProfile.isProbation) {
      const smartResult = calculateSmartLongRun(
        userProfile.lastLongRunDuration,
        userProfile.lastLongRunHeartRate,
        maf,
        userProfile.commitment,
        ageNum,
        userProfile.experience,
        userProfile.lastLongRunFeeling
      );
      
      // Update Long Run duration
      finalSchedule[longRunIndex] = {
        ...finalSchedule[longRunIndex],
        duration: smartResult.duration
      };
      
      longRunAdjustmentMessage = smartResult.message;
      longRunAdjustmentType = smartResult.adjustmentType;
      isLongRunCapped = smartResult.isCapped || false;
    }

    // --- ENFORCE WEEKLY VOLUME CAP ---
    // Ensure total weekly volume doesn't exceed commitment level limit
    let weeklyVolumeCapMessage: string | undefined;
    
    if (!userProfile.isProbation) {
      const volumeCapResult = enforceWeeklyVolumeCap(finalSchedule, userProfile.commitment);
      finalSchedule = volumeCapResult.adjustedSchedule;
      
      if (volumeCapResult.wasReduced && volumeCapResult.reductionMessage) {
        weeklyVolumeCapMessage = volumeCapResult.reductionMessage;
        notes.push(volumeCapResult.reductionMessage);
      }
    }

    // Apply The 15/15 Rule
    finalSchedule = finalSchedule.map(item => {
      if (item.type === 'RUN' || item.type === 'LONG_RUN' || item.type === 'CROSS_TRAIN' || item.type === 'WALK' || item.type === 'RECOVERY') {
        const structuredDetails = formatSessionDetails(item.duration, maf, item.type);
        return {
          ...item,
          activity: `${item.activity}\n${structuredDetails}`
        };
      }
      return item;
    });

    // --- NOTES & WARNINGS ---
    const paceSeconds = parsePaceToSeconds(effectivePace);
    
    if (!isNewbie && paceSeconds > 0 && paceSeconds <= 300) {
      if (ageNum > 35 || userProfile.experience === ExperienceLevel.REGULAR_NEW) {
        notes.push("⚡ CẢNH BÁO CƠ HỌC: Tốc độ Aerobic đang khá cao. Chú trọng giày chạy và khởi động kỹ.");
      }
    }
    
    if (!isNewbie && paceSeconds > 0 && paceSeconds < 270) {
       const swapIndex = finalSchedule.findIndex(s => s.day === 'Thứ 5' && s.type === 'RUN');
       if (swapIndex !== -1) {
         finalSchedule[swapIndex] = {
            ...finalSchedule[swapIndex],
            activity: "Strength / Cross-training (Gym/Yoga)\n(Thay thế chạy để bảo vệ khớp)",
            type: "CROSS_TRAIN"
         };
         notes.push("Đã chuyển buổi chạy Thứ 5 sang Strength để bảo vệ khớp do Pace nhanh.");
       }
    }

    if (isObese) {
      notes.push("⚠️ JOINT SAFETY: Vì BMI > 30, ưu tiên các bài tập ít tác động mạnh (Low Impact).");
    }
    
    if (ageNum >= 60) notes.push("LƯU Ý QUAN TRỌNG: Lắng nghe cơ thể. Đi bộ bất cứ khi nào thấy mệt.");

    setResult({
      mafHeartRate: maf,
      upperZone: maf,
      lowerZone: lowerZone,
      notes,
      explanation: !hasVerifiedPace ? explanation : undefined,
      volumeAdjustmentMessage,
      volumeAdjustmentType,
      longRunAdjustmentMessage,
      longRunAdjustmentType,
      scheduleTitle: `LỊCH TẬP ${userProfile.commitment === CommitmentLevel.HEALTH ? 'DUY TRÌ' : userProfile.commitment === CommitmentLevel.BASE ? 'NỀN TẢNG' : 'HIỆU SUẤT'}`,
      schedule: finalSchedule,
      mindset,
      bmi: bmi, 
      bmiCategory
    });

    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const getVolumeCapText = () => {
    const cap = VOLUME_CAPS[userProfile.commitment];
    const hours = Math.floor(cap.maxWeeklyMinutes / 60);
    const minutes = cap.maxWeeklyMinutes % 60;
    const maxLongRunHours = Math.floor(cap.maxLongRunMinutes / 60);
    const maxLongRunMins = cap.maxLongRunMinutes % 60;
    
    const weeklyText = minutes > 0 ? `${hours}h${minutes}p` : `${hours}h`;
    const longRunText = maxLongRunMins > 0 ? `${maxLongRunHours}h${maxLongRunMins}p` : `${maxLongRunHours}h`;
    
    return `${weeklyText}/tuần (Long Run max: ${longRunText})`;
  };

  // --- SAFETY EFFECTS ---
  useEffect(() => {
    if (isNaN(ageNum)) return;
    if (userProfile.isRecovering || userProfile.isMedicatedOrInjured) return;
    if (ageNum >= 60) {
      if (!userProfile.isMedicalClearanceConfirmed) {
        if (userProfile.commitment === CommitmentLevel.BASE || userProfile.commitment === CommitmentLevel.PERFORMANCE) {
          setUserProfile(prev => ({ ...prev, commitment: CommitmentLevel.HEALTH }));
        }
      } 
      else if (userProfile.isMedicalClearanceConfirmed) {
         if (userProfile.commitment === CommitmentLevel.PERFORMANCE) {
           setUserProfile(prev => ({ ...prev, commitment: CommitmentLevel.BASE }));
         }
      }
    }
  }, [userProfile.age, userProfile.isMedicalClearanceConfirmed, userProfile.isRecovering, userProfile.isMedicatedOrInjured, userProfile.commitment, ageNum]);

  // --- PROBATION AUTO-UNLOCK ---
  useEffect(() => {
    if (userProfile.isProbation && userProfile.probationStartDate) {
      const startDate = new Date(userProfile.probationStartDate);
      const now = new Date();
      const daysPassed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysPassed >= 14) {
        // Auto unlock after 14 days
        setUserProfile(prev => ({
          ...prev,
          isProbation: false,
          probationStartDate: undefined
        }));
        
        alert('🎉 Chúc mừng! Bạn đã tốt nghiệp giai đoạn hồi phục!\n\nHãy bắt đầu xây dựng nền tảng thực sự.');
      }
    }
  }, [userProfile.isProbation, userProfile.probationStartDate]);

  // --- RENDER ---
  return (
    <>
      {/* Welcome Modal - Hiển thị lần đầu */}
      <WelcomeModal />
      
      {/* Recovery Modal */}
      <RecoveryModal 
        isOpen={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        onConfirm={handleRecoveryConfirm}
      />
      
      <div className="min-h-screen pb-20 bg-gray-50 font-sans">
      
      {/* --- HEADER --- */}
      <header className="relative w-full bg-gray-900 shadow-lg overflow-hidden group">
        <div className="relative max-w-7xl mx-auto h-auto">
          <img 
            src="https://tonytechlab.com/wp-content/uploads/2025/10/maf.jpg" 
            alt="MAF Running Header" 
            className="w-full h-auto object-contain max-h-[60vh] md:max-h-[500px] opacity-90 group-hover:opacity-100 transition-opacity duration-700"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-10 z-10">
          <div className="max-w-7xl mx-auto px-4">
            <h1 className="text-3xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-200 drop-shadow-md tracking-tight uppercase italic">
              MAF Running Coach
            </h1>
            <p className="text-gray-300 mt-2 font-medium text-lg max-w-2xl text-shadow hidden md:block">
              Xây dựng nền tảng hiếu khí vững chắc - Run Slow to Race Fast
            </p>
          </div>
        </div>
      </header>

      {/* --- TAB NAVIGATION --- */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="bg-white rounded-xl shadow-md p-1 flex">
          <button
            onClick={() => setActiveTab('PLAN')}
            className={`flex-1 py-4 text-center font-bold text-base uppercase tracking-wider flex items-center justify-center space-x-2 rounded-lg transition-all ${
              activeTab === 'PLAN' 
                ? 'bg-purple-50 text-purple-700 shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Kế Hoạch Tập Luyện</span>
          </button>
          <button
            onClick={() => setActiveTab('LAB')}
            className={`flex-1 py-4 text-center font-bold text-base uppercase tracking-wider flex items-center justify-center space-x-2 rounded-lg transition-all ${
              activeTab === 'LAB' 
                ? 'bg-blue-50 text-blue-700 shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Beaker className="w-5 h-5" />
            <span>Phòng MAF Test</span>
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        
        {/* === TRƯỜNG HỢP 1: ĐANG Ở TAB MAF LAB === */}
        {activeTab === 'LAB' && (
          <MafLab onComplete={handleLabComplete} targetMafHr={calculateRawMaf()} />
        )}

        {/* === TRƯỜNG HỢP 2: ĐANG Ở TAB PLAN === */}
        {activeTab === 'PLAN' && (
          <div className="space-y-10"> 
            
            {/* 1. FORM NHẬP LIỆU (Luôn hiển thị ở trên cùng) */}
            <section className="bg-white rounded-2xl shadow-lg p-8 md:p-10 animate-fade-in border border-gray-100">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {/* LEFT INPUTS */}
                  <div className="space-y-8">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                      <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mr-3 text-base">1</span>
                      Thông tin Cá nhân
                    </h2>
                    
                    <div className="grid grid-cols-3 gap-6">
                      <div className="col-span-1">
                        <label className="block text-base font-medium text-gray-900 mb-2">Tuổi</label>
                        <input type="number" name="age" value={userProfile.age} onChange={handleInputChange} onBlur={handleBlur} className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="30" />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-base font-medium text-gray-900 mb-2">Cao (cm)</label>
                        <input type="number" name="height" value={userProfile.height} onChange={handleInputChange} onBlur={handleBlur} className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="170" />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-base font-medium text-gray-900 mb-2">Nặng (kg)</label>
                        <input type="number" name="weight" value={userProfile.weight} onChange={handleInputChange} onBlur={handleBlur} className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="65" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-base font-medium text-gray-900 mb-2">Kinh nghiệm</label>
                      <select name="experience" value={userProfile.experience} onChange={handleInputChange} className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white">
                        {EXPERIENCE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* RIGHT INPUTS */}
                  <div className="space-y-8">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center">
                      <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mr-3 text-base">2</span>
                      Sức khỏe
                    </h2>
                    
                    <div className="space-y-3">
                      <label className="flex items-center space-x-3 cursor-pointer p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition">
                        <input type="checkbox" name="isRecovering" checked={userProfile.isRecovering} onChange={handleCheckboxChange} className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500" />
                        <span className="text-base text-gray-800">Đang hồi phục bệnh nặng (-10 nhịp)</span>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition">
                        <input type="checkbox" name="isMedicatedOrInjured" checked={userProfile.isMedicatedOrInjured} onChange={handleCheckboxChange} className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500" />
                        <span className="text-base text-gray-800">Dùng thuốc / Chấn thương (-5 nhịp)</span>
                      </label>
                      {isSenior && (
                        <label className="flex items-center space-x-3 cursor-pointer p-3 bg-amber-50 rounded-lg border border-amber-200">
                           <input type="checkbox" name="isMedicalClearanceConfirmed" checked={userProfile.isMedicalClearanceConfirmed} onChange={handleCheckboxChange} className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500" />
                           <span className="text-base text-amber-900 font-bold">Xác nhận Y tế (trên 60 tuổi)</span>
                        </label>
                      )}
                    </div>

                    {/* Health Re-evaluation Button */}
                    {(userProfile.isRecovering || userProfile.isMedicatedOrInjured) && !userProfile.isProbation && (
                      <div className="pt-4">
                        <button
                          onClick={() => setShowRecoveryModal(true)}
                          className="w-full px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-bold rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex items-center justify-center space-x-2"
                        >
                          <ShieldCheck className="w-5 h-5" />
                          <span>🔄 Cập nhật Sức khỏe</span>
                        </button>
                      </div>
                    )}

                    {isNewbie ? (
                       <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start space-x-3">
                          <Leaf className="w-5 h-5 text-emerald-600 mt-1 flex-shrink-0" />
                          <p className="text-base text-emerald-800">Giai đoạn này chỉ cần quan tâm đến <strong>Thời gian</strong> và <strong>Nhịp tim</strong>. Chạy thật chậm!</p>
                       </div>
                    ) : (
                       <div className="space-y-4">
                          <div className={`p-4 rounded-xl border transition-all ${verifiedMafPace ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                             <label className="block text-sm font-bold text-gray-500 uppercase mb-2">Pace MAF Hiện tại</label>
                             {verifiedMafPace ? (
                                <div className="flex items-center justify-between">
                                   <span className="text-2xl font-mono font-bold text-green-700">{verifiedMafPace} /km</span>
                                   <button onClick={() => setActiveTab('LAB')} className="text-sm text-gray-500 underline">Test lại</button>
                                </div>
                             ) : (
                                <div className="flex items-center justify-between">
                                   <span className="text-base text-gray-400 italic">Chưa có dữ liệu</span>
                                   <button onClick={() => setActiveTab('LAB')} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50">Nhập Test</button>
                                </div>
                             )}
                          </div>
                          
                          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                             <label className="block text-sm font-bold text-gray-500 uppercase mb-2">
                                Pace MAF Tháng Trước <span className="text-gray-400 text-xs normal-case">(Không bắt buộc)</span>
                             </label>
                             <input 
                                type="text" 
                                name="previousMonthPace" 
                                value={userProfile.previousMonthPace || ''} 
                                onChange={handleInputChange}
                                className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white" 
                                placeholder="VD: 6:30 hoặc 6.5"
                             />
                             <p className="text-xs text-gray-500 mt-2">Nhập pace tháng trước để hệ thống điều chỉnh khối lượng tập</p>
                          </div>

                          {/* LONG RUN HISTORY - For smart calculation */}
                          {(userProfile.experience === ExperienceLevel.REGULAR_NEW || userProfile.experience === ExperienceLevel.ADVANCED) && (
                            <div className="p-4 rounded-xl border border-orange-200 bg-orange-50">
                              <div className="flex items-center mb-3">
                                <Timer className="w-5 h-5 text-orange-600 mr-2" />
                                <label className="text-sm font-bold text-orange-800 uppercase">
                                  Dữ liệu Long Run gần nhất
                                </label>
                              </div>
                              <p className="text-xs text-orange-700 mb-4">
                                Nhập dữ liệu từ bài Long Run gần nhất để hệ thống tính toán thông minh
                              </p>
                              
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-orange-900 mb-1">Thời gian (phút)</label>
                                  <input
                                    type="number"
                                    name="lastLongRunDuration"
                                    value={userProfile.lastLongRunDuration || ''}
                                    onChange={(e) => setUserProfile(prev => ({ 
                                      ...prev, 
                                      lastLongRunDuration: e.target.value ? parseInt(e.target.value) : undefined 
                                    }))}
                                    className="w-full p-2 text-base border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                                    placeholder="90"
                                  />
                                </div>
                                
                                <div>
                                  <label className="block text-xs font-medium text-orange-900 mb-1">Nhịp tim TB (bpm)</label>
                                  <input
                                    type="number"
                                    name="lastLongRunHeartRate"
                                    value={userProfile.lastLongRunHeartRate || ''}
                                    onChange={(e) => setUserProfile(prev => ({ 
                                      ...prev, 
                                      lastLongRunHeartRate: e.target.value ? parseInt(e.target.value) : undefined 
                                    }))}
                                    className="w-full p-2 text-base border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                                    placeholder="145"
                                  />
                                </div>
                                
                                <div>
                                  <label className="block text-xs font-medium text-orange-900 mb-1">Cảm nhận</label>
                                  <select
                                    name="lastLongRunFeeling"
                                    value={userProfile.lastLongRunFeeling || ''}
                                    onChange={(e) => setUserProfile(prev => ({ 
                                      ...prev, 
                                      lastLongRunFeeling: e.target.value as 'GOOD' | 'TIRED' | 'VERY_TIRED' | undefined || undefined 
                                    }))}
                                    className="w-full p-2 text-sm border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                                  >
                                    <option value="">-- Chọn --</option>
                                    <option value="GOOD">😊 Tốt</option>
                                    <option value="TIRED">😰 Hơi mệt</option>
                                    <option value="VERY_TIRED">😫 Rất mệt</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}
                       </div>
                    )}
                  </div>
               </div>

               {/* COMMITMENT SELECTOR - FULL WIDTH SECTION */}
               <div className="w-full pt-8 mt-8 border-t border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center mb-6">
                    <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mr-3 text-base">3</span>
                    Mức độ Cam kết
                  </h2>
                  <CommitmentSelector 
                     selected={userProfile.commitment} onSelect={handleCommitmentSelect} 
                     age={userProfile.age} height={userProfile.height} weight={userProfile.weight} 
                     experience={userProfile.experience} isRecovering={userProfile.isRecovering} 
                     isMedicatedOrInjured={userProfile.isMedicatedOrInjured} isMedicalClearanceConfirmed={userProfile.isMedicalClearanceConfirmed}
                   />
               </div>

               <div className="flex justify-center mt-8">
                  <button onClick={calculateMAF} className="w-full md:w-auto px-12 py-4 bg-gradient-to-r from-purple-700 to-pink-600 text-white font-bold text-xl rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all">
                    PHÂN TÍCH & LẬP KẾ HOẠCH
                  </button>
               </div>
            </section>

            {/* 2. KẾT QUẢ PHÂN TÍCH - SINGLE COLUMN VERTICAL STACK */}
            {result && isChild && (
              <div ref={resultRef} className="max-w-7xl mx-auto space-y-8 mt-10 animate-fade-in-up">
                {/* SPECIAL DISPLAY FOR CHILDREN */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-2xl shadow-xl border-4 border-green-300">
                  <div className="flex items-center justify-center mb-6">
                    <Smile className="w-12 h-12 text-green-600 mr-4" />
                    <h2 className="text-3xl font-bold text-green-800 uppercase tracking-wide">{result.scheduleTitle}</h2>
                  </div>
                  
                  <div className="bg-white p-6 rounded-xl shadow-md mb-6 border-l-8 border-green-500">
                    <h3 className="text-xl font-bold text-gray-700 mb-4 flex items-center">
                      <Lightbulb className="w-6 h-6 text-yellow-500 mr-3" />
                      Hướng dẫn của Dr. Phil Maffetone
                    </h3>
                    <p className="text-xl text-gray-800 leading-relaxed italic">
                      "{result.mindset}"
                    </p>
                  </div>

                  <div className="bg-white p-8 rounded-xl shadow-md border border-green-200">
                    <h3 className="text-2xl font-bold text-green-700 mb-6 text-center flex items-center justify-center">
                      <ActivityIcon className="w-8 h-8 mr-3" />
                      Các hoạt động được khuyên dùng
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                        <h4 className="font-bold text-blue-800 mb-2 text-lg">🏃 Chạy nhảy tự do</h4>
                        <p className="text-blue-700">Chơi đuổi bắt, chạy thi với bạn bè</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
                        <h4 className="font-bold text-purple-800 mb-2 text-lg">⚽ Thể thao</h4>
                        <p className="text-purple-700">Bóng đá, bóng rổ, cầu lông...</p>
                      </div>
                      <div className="bg-cyan-50 p-4 rounded-lg border-2 border-cyan-200">
                        <h4 className="font-bold text-cyan-800 mb-2 text-lg">🏊 Bơi lội</h4>
                        <p className="text-cyan-700">Vui chơi trong nước, học bơi</p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
                        <h4 className="font-bold text-orange-800 mb-2 text-lg">🚴 Đạp xe</h4>
                        <p className="text-orange-700">Đạp xe quanh khu phố, công viên</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 bg-amber-50 p-6 rounded-xl border-l-8 border-amber-400">
                    <p className="text-amber-900 font-medium text-lg">
                      <strong>LƯU Ý:</strong> Không cần đo nhịp tim, không cần theo lịch trình cố định. Hãy để trẻ tận hưởng niềm vui vận động tự nhiên!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {result && !isChild && (
              <div ref={resultRef} className="max-w-7xl mx-auto space-y-8 mt-10 animate-fade-in-up">
                
                {/* KHỐI 1: NHỊP TIM (Horizontal Flex) */}
                <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-3 text-center md:text-left md:px-6">
                        <h3 className="text-gray-300 uppercase text-sm font-bold tracking-widest">Nhịp Tim Mục Tiêu (MAF)</h3>
                    </div>
                    
                    <div className="p-6 md:p-8 bg-gradient-to-br from-white to-gray-50 flex flex-col md:flex-row items-center justify-between gap-6">
                        {/* Number Section (Left) */}
                        <div className="flex items-baseline">
                            <span className="text-7xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 leading-none">
                                {result.mafHeartRate}
                            </span>
                            <span className="text-lg font-bold text-gray-400 ml-2 tracking-wider">BPM</span>
                        </div>

                        {/* Details Section (Right) */}
                        <div className="flex flex-col items-center md:items-end space-y-3 w-full md:w-auto">
                             <div className="bg-purple-100 px-5 py-2 rounded-xl border border-purple-200 w-full md:w-auto text-center md:text-right">
                                <p className="text-purple-900 font-bold text-lg">
                                    Zone: {result.lowerZone} - {result.upperZone} bpm
                                </p>
                                <p className="text-purple-600 text-xs font-medium uppercase">Vùng Hiệu Suất Tối Đa</p>
                             </div>
                             
                             <div className={`px-5 py-2 rounded-xl border font-bold text-base flex items-center justify-center md:justify-end w-full md:w-auto ${result.bmi >= 25 ? 'bg-orange-100 text-orange-900 border-orange-200' : 'bg-green-100 text-green-900 border-green-200'}`}>
                                <Scale className="w-4 h-4 mr-2" />
                                BMI: {result.bmi} ({result.bmiCategory})
                             </div>
                        </div>
                    </div>
                </div>

                {/* KHỐI 2: HỆ THỐNG TỰ ĐỘNG / CẢNH BÁO */}
                <div className="w-full space-y-4">
                    {/* Pace Explanation */}
                    {result.explanation && (
                        <div className="bg-blue-50 p-5 rounded-2xl border border-blue-200 shadow-sm flex items-start space-x-4 w-full">
                            <div className="bg-blue-100 p-2 rounded-full flex-shrink-0">
                                <Lightbulb className="w-5 h-5 text-blue-600" />
                            </div>
                            <p className="text-base text-blue-900 font-medium leading-relaxed whitespace-pre-wrap">
                                {result.explanation}
                            </p>
                        </div>
                    )}

                    {/* Warning Notes */}
                    {result.notes.length > 0 && (
                        <div className="bg-amber-50 p-5 rounded-2xl border-l-8 border-amber-500 shadow-sm space-y-3">
                            {result.notes.map((note, idx) => (
                                <div key={idx} className="flex items-start text-amber-900 font-medium text-base">
                                    <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                                    <span>{note}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* PROBATION ALERT - Only shown during probation period */}
                {userProfile.isProbation && (
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-2xl shadow-lg border-4 border-blue-400">
                    <div className="flex items-start space-x-4">
                      <div className="bg-blue-200 p-3 rounded-full flex-shrink-0">
                        <ShieldCheck className="w-8 h-8 text-blue-700" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-blue-900 uppercase mb-2 flex items-center">
                          🛡️ CHẾ ĐỘ THỬ THÁCH (Ngày {calculateDaysSinceStart()}/14)
                        </h3>
                        <p className="text-lg text-blue-800 leading-relaxed font-medium">
                          Hệ thống đang giới hạn <strong>70% khối lượng</strong> và giữ <strong>nhịp tim thấp (-10 bpm)</strong> để đảm bảo an toàn tuyệt đối cho bạn. 
                          Sau <strong>14 ngày</strong> nếu ổn định sẽ mở khóa hoàn toàn.
                        </p>
                        <div className="mt-4 flex items-center space-x-2">
                          <div className="h-2 flex-1 bg-blue-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
                              style={{ width: `${Math.min((calculateDaysSinceStart() / 14) * 100, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-blue-700 font-bold text-sm whitespace-nowrap">
                            {14 - calculateDaysSinceStart()} ngày còn lại
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* KHỐI 3: TƯ DUY & QUY TẮC */}
                <div className="space-y-6">
                    {/* Mindset Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-md border-t-4 border-blue-500">
                        <h3 className="text-base font-bold text-gray-400 uppercase mb-3 flex items-center">
                            <ActivityIcon className="w-4 h-4 mr-2"/> Tư duy Cốt lõi
                        </h3>
                        <p className="text-xl text-gray-800 italic leading-relaxed font-medium text-center px-4">
                            "{result.mindset}"
                        </p>
                        <div className="mt-6 pt-4 border-t border-gray-100 text-base text-gray-600 flex justify-center items-center">
                            <Lock className="w-4 h-4 mr-2 text-gray-400" />
                            <span>Trần Giới Hạn Tuần: <strong>{getVolumeCapText()}</strong> {ageNum > 50 && <span className="text-amber-700 font-bold ml-2">(trên 50 tuổi max 2.5h/run)</span>}</span>
                        </div>
                    </div>

                    {/* Golden Rules Card */}
                    <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-200 shadow-md">
                        <div className="flex items-center justify-center mb-6">
                            <Zap className="w-6 h-6 text-amber-600 mr-2" />
                            <h4 className="text-xl font-bold text-amber-900 uppercase tracking-wide">Quy Tắc Vàng</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="text-center">
                                <div className="bg-yellow-200 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 text-lg font-bold text-yellow-800">1</div>
                                <h5 className="font-bold text-amber-900 uppercase mb-1 text-sm">Chạy MAF</h5>
                                <p className="text-amber-800 text-sm">Tuyệt đối không để tim vượt quá <strong>{result.mafHeartRate} bpm</strong>.</p>
                            </div>
                            <div className="text-center">
                                <div className="bg-yellow-200 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 text-lg font-bold text-yellow-800">2</div>
                                <h5 className="font-bold text-amber-900 uppercase mb-1 text-sm">Hồi phục</h5>
                                <p className="text-amber-800 text-sm">Chạy chậm, thoải mái, giữ tim dưới <strong>{result.lowerZone} bpm</strong>.</p>
                            </div>
                            <div className="text-center">
                                <div className="bg-yellow-200 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 text-lg font-bold text-yellow-800">3</div>
                                <h5 className="font-bold text-amber-900 uppercase mb-1 text-sm">Luật 15/15</h5>
                                <p className="text-amber-800 text-sm">Luôn dành <strong>15 phút</strong> đầu/cuối để khởi động/thả lỏng.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* VOLUME ADJUSTMENT MESSAGE (if exists) */}
                {result.volumeAdjustmentMessage && (
                  <div className={`p-6 rounded-2xl shadow-lg border-4 ${
                    result.volumeAdjustmentType === 'PROGRESS' ? 'bg-green-50 border-green-400' :
                    result.volumeAdjustmentType === 'REGRESSION' ? 'bg-red-50 border-red-400' :
                    'bg-blue-50 border-blue-400'
                  }`}>
                    <div className="flex items-start space-x-4">
                      <div className={`p-3 rounded-full ${
                        result.volumeAdjustmentType === 'PROGRESS' ? 'bg-green-200' :
                        result.volumeAdjustmentType === 'REGRESSION' ? 'bg-red-200' :
                        'bg-blue-200'
                      }`}>
                        {result.volumeAdjustmentType === 'PROGRESS' && <TrendingUp className="w-8 h-8 text-green-700" />}
                        {result.volumeAdjustmentType === 'REGRESSION' && <TrendingDown className="w-8 h-8 text-red-700" />}
                        {result.volumeAdjustmentType === 'STABLE' && <CheckCircle2 className="w-8 h-8 text-blue-700" />}
                      </div>
                      <div className="flex-1">
                        <h3 className={`text-xl font-bold mb-2 uppercase ${
                          result.volumeAdjustmentType === 'PROGRESS' ? 'text-green-800' :
                          result.volumeAdjustmentType === 'REGRESSION' ? 'text-red-800' :
                          'text-blue-800'
                        }`}>
                          ĐIỀU CHỈNH KHỐI LƯỢNG TẬP
                        </h3>
                        <p className={`text-lg leading-relaxed ${
                          result.volumeAdjustmentType === 'PROGRESS' ? 'text-green-900' :
                          result.volumeAdjustmentType === 'REGRESSION' ? 'text-red-900' :
                          'text-blue-900'
                        }`}>
                          {result.volumeAdjustmentMessage}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* KHỐI 4: LỊCH TẬP */}
                <div className="w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
                    <div className="bg-gradient-to-r from-purple-700 via-pink-600 to-orange-500 p-6 text-center">
                        <h2 className="text-2xl font-bold text-white uppercase tracking-wide flex items-center justify-center">
                            <Calendar className="w-8 h-8 mr-3" />
                            LỊCH TRÌNH CHI TIẾT
                        </h2>
                        <p className="text-white/80 mt-1 text-base">{result.scheduleTitle}</p>
                    </div>
                    
                    <div className="p-0 overflow-x-auto">
                       <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="p-6 text-lg font-extrabold text-gray-500 uppercase w-[15%]">Ngày</th>
                            <th className="p-6 text-lg font-extrabold text-gray-500 uppercase w-[65%]">Nội dung bài tập</th>
                            <th className="p-6 text-lg font-extrabold text-gray-500 uppercase text-right w-[20%]">Thời lượng</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {result.schedule.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50 transition-colors group">
                              <td className="p-6 font-bold text-gray-800 align-top text-xl border-r border-gray-50 bg-white group-hover:bg-gray-50/50">
                                {item.day}
                              </td>
                              <td className="p-6 align-top">
                                {/* Main Badge */}
                                <div className="mb-3">
                                    <span className={`inline-flex items-center px-4 py-2 rounded-lg text-lg font-bold border shadow-sm
                                      ${item.type === 'REST' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                        item.type === 'LONG_RUN' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                        item.type === 'WALK' ? 'bg-green-100 text-green-800 border-green-200' :
                                        item.type === 'CROSS_TRAIN' ? 'bg-teal-100 text-teal-800 border-teal-200' :
                                        item.type === 'RECOVERY' ? 'bg-green-50 text-green-700 border-green-200' :
                                        'bg-purple-100 text-purple-800 border-purple-200'}`}>
                                      {item.activity.split('\n')[0]}
                                    </span>
                                </div>
                                {/* Smart Long Run Adjustment Badge */}
                                {item.type === 'LONG_RUN' && result.longRunAdjustmentMessage && (
                                  <div className={`mt-3 p-3 rounded-lg border-l-4 flex items-start space-x-2 ${
                                    result.longRunAdjustmentType === 'INCREASE' ? 'bg-green-50 border-green-500' :
                                    result.longRunAdjustmentType === 'DECREASE' ? 'bg-red-50 border-red-500' :
                                    result.longRunAdjustmentType === 'CAP' ? 'bg-amber-50 border-amber-500' :
                                    'bg-blue-50 border-blue-500'
                                  }`}>
                                    {result.longRunAdjustmentType === 'INCREASE' && <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />}
                                    {result.longRunAdjustmentType === 'DECREASE' && <TrendingDown className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
                                    {result.longRunAdjustmentType === 'CAP' && <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />}
                                    {result.longRunAdjustmentType === 'MAINTAIN' && <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />}
                                    <span className={`text-sm font-medium ${
                                      result.longRunAdjustmentType === 'INCREASE' ? 'text-green-800' :
                                      result.longRunAdjustmentType === 'DECREASE' ? 'text-red-800' :
                                      result.longRunAdjustmentType === 'CAP' ? 'text-amber-800' :
                                      'text-blue-800'
                                    }`}>
                                      {result.longRunAdjustmentMessage}
                                    </span>
                                  </div>
                                )}
                                {/* Details */}
                                {item.activity.includes('\n') && (
                                  <div className="mt-4 space-y-3 pl-2">
                                    {item.activity.split('\n').slice(1).map((line, i) => (
                                      <p key={i} className="text-lg text-gray-700 font-medium leading-relaxed border-l-4 border-blue-100 pl-4">
                                        {line}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="p-6 text-right font-black text-gray-900 align-top text-3xl">
                                {item.duration > 0 ? (
                                  <span className="bg-gray-100 px-4 py-2 rounded-xl text-gray-800">{item.duration}'</span>
                                ) : <span className="text-gray-300">-</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-gray-50 p-4 text-center border-t border-gray-200">
                       <p className="text-gray-400 text-sm italic">*Lưu ý: Luôn lắng nghe cơ thể. Nếu cảm thấy mệt mỏi bất thường, hãy nghỉ ngơi thêm.</p>
                    </div>
                </div>

              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mt-24 py-12 bg-gray-900 text-gray-500 text-center text-base border-t border-gray-800">
        <p className="font-medium text-gray-400">MAF Running Coach</p>
        <p className="mt-2 text-sm">Based on "The Big Book of Endurance Training and Racing" by Dr. Phil Maffetone.</p>
      </footer>
      </div>
    </>
  );
};

export default App;
