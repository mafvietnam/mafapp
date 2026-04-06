import React from 'react';

interface DashboardCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

/** Responsive card: glassmorphism on mobile, solid gray-900 on desktop */
export default function DashboardCard({ children, className = '', onClick }: DashboardCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        rounded-[20px] lg:rounded-[16px]
        bg-white/5 backdrop-blur-[28px] border border-white/15
        shadow-[0_8px_32px_rgba(0,0,0,0.3)]
        lg:bg-dark-card lg:backdrop-blur-none lg:border-white/5
        lg:shadow-[0_4px_20px_rgba(0,0,0,0.2)]
        ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
