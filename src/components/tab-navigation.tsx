import React from 'react';
import { LayoutDashboard, Beaker } from 'lucide-react';

interface TabNavigationProps {
  activeTab: 'PLAN' | 'LAB';
  onTabChange: (tab: 'PLAN' | 'LAB') => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => (
  <div className="max-w-7xl mx-auto px-4 mt-6">
    <div className="desktop-card p-1 flex">
      <button
        onClick={() => onTabChange('PLAN')}
        className={`flex-1 py-4 text-center font-bold text-base uppercase tracking-wider flex items-center justify-center space-x-2 rounded-lg transition-all ${
          activeTab === 'PLAN'
            ? 'bg-maf-violet/20 text-maf-violet'
            : 'text-slate-500 hover:bg-white/5'
        }`}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span>Kế Hoạch Tập Luyện</span>
      </button>
      <button
        onClick={() => onTabChange('LAB')}
        className={`flex-1 py-4 text-center font-bold text-base uppercase tracking-wider flex items-center justify-center space-x-2 rounded-lg transition-all ${
          activeTab === 'LAB'
            ? 'bg-cyan-500/20 text-cyan-400'
            : 'text-slate-500 hover:bg-white/5'
        }`}
      >
        <Beaker className="w-5 h-5" />
        <span>Phòng MAF Test</span>
      </button>
    </div>
  </div>
);

export default TabNavigation;
