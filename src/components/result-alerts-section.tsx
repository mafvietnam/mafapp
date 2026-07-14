import React from 'react';
import { AlertTriangle, Lightbulb } from 'lucide-react';

interface ResultAlertsSectionProps {
  explanation?: string;
  notes: string[];
}

const ResultAlertsSection: React.FC<ResultAlertsSectionProps> = ({ explanation, notes }) => (
  <div className="w-full space-y-4">
    {explanation && (
      <div className="bg-blue-50 p-4 md:p-5 rounded-2xl border border-blue-200 shadow-sm flex items-start space-x-3 md:space-x-4 w-full">
        <div className="bg-blue-100 p-2 rounded-full flex-shrink-0">
          <Lightbulb className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
        </div>
        <p className="text-sm md:text-base text-blue-900 font-medium leading-relaxed whitespace-pre-wrap">
          {explanation}
        </p>
      </div>
    )}
    {notes.length > 0 && (
      <div className="bg-amber-50 p-4 md:p-5 rounded-2xl border-l-8 border-amber-500 shadow-sm space-y-3">
        {notes.map((note, idx) => (
          <div key={idx} className="flex items-start text-amber-900 font-medium text-sm md:text-base">
            <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 mr-2.5 md:mr-3 flex-shrink-0 mt-0.5" />
            <span>{note}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default ResultAlertsSection;
