import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import GuideGettingStarted from '../components/guide/guide-getting-started';
import GuidePlanTab from '../components/guide/guide-plan-tab';
import GuideResults from '../components/guide/guide-results';
import GuideLab from '../components/guide/guide-lab';
import GuideSpecialCases from '../components/guide/guide-special-cases';

const TOC_ITEMS = [
  { id: 'getting-started', label: 'MAF là gì & Bắt đầu' },
  { id: 'plan-tab', label: 'Tab Kế Hoạch Tập Luyện' },
  { id: 'results', label: 'Đọc hiểu Kết quả' },
  { id: 'lab', label: 'Phòng MAF Test' },
  { id: 'special-cases', label: 'Trường hợp Đặc biệt' },
  { id: 'tips', label: 'Mẹo Tập Luyện' },
  { id: 'faq', label: 'Câu Hỏi Thường Gặp' },
];

// Scrolls to anchor with offset to account for sticky header
const scrollToSection = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const offset = 80;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: 'smooth' });
};

const GuidePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-gray-900 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors text-sm font-medium"
          >
            <ArrowLeft size={16} />
            Quay lại ứng dụng
          </button>
          <div className="flex items-center gap-2 text-purple-400">
            <BookOpen size={18} />
            <span className="text-sm font-semibold text-white hidden sm:inline">
              Hướng Dẫn Sử Dụng
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-700 to-pink-500 mb-2">
            Hướng Dẫn Sử Dụng
          </h1>
          <p className="text-gray-600 text-lg">MAF Running Coach</p>
          <p className="text-gray-500 text-sm mt-1">
            Chào mừng bạn đến với <strong>MAF Running Coach</strong> — ứng dụng giúp bạn tính
            toán nhịp tim MAF và lập kế hoạch tập luyện cá nhân hóa.
          </p>
        </div>

        {/* Table of contents */}
        <nav className="bg-white border border-gray-200 rounded-xl p-5 mb-10 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Mục lục
          </p>
          <ol className="space-y-1">
            {TOC_ITEMS.map((item, i) => (
              <li key={item.id}>
                <button
                  onClick={() => scrollToSection(item.id)}
                  className="text-sm text-purple-700 hover:text-purple-900 hover:underline text-left transition-colors"
                >
                  {i + 1}. {item.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* Content sections */}
        <div className="space-y-14">
          <GuideGettingStarted />
          <hr className="border-gray-200" />
          <GuidePlanTab />
          <hr className="border-gray-200" />
          <GuideResults />
          <hr className="border-gray-200" />
          <GuideLab />
          <hr className="border-gray-200" />
          <GuideSpecialCases />
        </div>

        {/* Back to top */}
        <div className="mt-14 text-center">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="text-sm text-purple-600 hover:text-purple-800 underline transition-colors"
          >
            ↑ Lên đầu trang
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 py-10 bg-gray-900 text-gray-500 text-center text-sm border-t border-gray-800">
        <p className="font-medium text-gray-400">MAF Running Coach</p>
        <p className="mt-2">
          Based on "The Big Book of Endurance Training and Racing" by Dr. Phil Maffetone.
        </p>
        <p className="mt-1 text-gray-600 text-xs">Phiên bản 1.0.0 | Cập nhật 31/03/2026</p>
      </footer>
    </div>
  );
};

export default GuidePage;
