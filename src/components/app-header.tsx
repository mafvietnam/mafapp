import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

const AppHeader: React.FC = () => {
  const navigate = useNavigate();

  return (
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
        <div className="max-w-7xl mx-auto px-4 flex items-end justify-between">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-200 drop-shadow-md tracking-tight uppercase italic">
              MAF Running Coach
            </h1>
            <p className="text-gray-300 mt-2 font-medium text-lg max-w-2xl text-shadow hidden md:block">
              Xây dựng nền tảng hiếu khí vững chắc - Run Slow to Race Fast
            </p>
          </div>
          <button
            onClick={() => navigate('/guide')}
            title="Hướng dẫn sử dụng"
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-sm font-medium px-3 py-2 rounded-lg transition-all backdrop-blur-sm flex-shrink-0 mb-1"
          >
            <BookOpen size={16} />
            <span className="hidden sm:inline">Hướng dẫn</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
