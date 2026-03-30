import React from 'react';

const AppHeader: React.FC = () => (
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
);

export default AppHeader;
