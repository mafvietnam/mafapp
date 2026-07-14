import React from 'react';
import { MafResult } from '../types';
import { UserProfile } from '../types';
import ResultHeartRateCard from './result-heart-rate-card';
import ResultAlertsSection from './result-alerts-section';
import ResultMindsetCard from './result-mindset-card';
import ResultScheduleTable from './result-schedule-table';
import ResultChildrenDisplay from './result-children-display';
import ProbationAlert from './probation-alert';
import VolumeAdjustmentCard from './volume-adjustment-card';
import { calculateDaysSinceStart } from '../hooks/use-probation';

interface ResultDisplayProps {
  result: MafResult;
  userProfile: UserProfile;
  isChild: boolean;
  ageNum: number;
  volumeCapText: string;
  resultRef: React.RefObject<HTMLDivElement>;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({
  result,
  userProfile,
  isChild,
  ageNum,
  volumeCapText,
  resultRef,
}) => {
  if (isChild) {
    return (
      <div ref={resultRef} className="max-w-7xl mx-auto space-y-6 md:space-y-8 mt-8 md:mt-10 animate-fade-in-up">
        <ResultChildrenDisplay result={result} />
      </div>
    );
  }

  return (
    <div ref={resultRef} className="max-w-7xl mx-auto space-y-6 md:space-y-8 mt-8 md:mt-10 animate-fade-in-up">
      <ResultHeartRateCard
        mafHeartRate={result.mafHeartRate}
        lowerZone={result.lowerZone}
        upperZone={result.upperZone}
        bmi={result.bmi}
        bmiCategory={result.bmiCategory}
      />

      <ResultAlertsSection explanation={result.explanation} notes={result.notes} />

      {userProfile.isProbation && (
        <ProbationAlert daysSinceStart={calculateDaysSinceStart(userProfile.probationStartDate)} />
      )}

      <ResultMindsetCard
        mindset={result.mindset}
        mafHeartRate={result.mafHeartRate}
        lowerZone={result.lowerZone}
        ageNum={ageNum}
        volumeCapText={volumeCapText}
      />

      {result.volumeAdjustmentMessage && result.volumeAdjustmentType && (
        <VolumeAdjustmentCard
          message={result.volumeAdjustmentMessage}
          type={result.volumeAdjustmentType}
        />
      )}

      <ResultScheduleTable
        scheduleTitle={result.scheduleTitle}
        schedule={result.schedule}
        longRunAdjustmentMessage={result.longRunAdjustmentMessage}
        longRunAdjustmentType={result.longRunAdjustmentType}
      />
    </div>
  );
};

export default ResultDisplay;
