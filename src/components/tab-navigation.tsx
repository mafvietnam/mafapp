import React from 'react';
import { LayoutDashboard, Beaker } from 'lucide-react';

interface TabNavigationProps {
  activeTab: 'PLAN' | 'LAB';
  onTabChange: (tab: 'PLAN' | 'LAB') => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => (
  <div className="max-w-7xl mx-auto px-4 mt-6">
    <div className="bg-white rounded-xl shadow-md p-1 flex">
      <button
        onClick={() => onTabChange('PLAN')}
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
        onClick={() => onTabChange('LAB')}
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
);

export default TabNavigation;
