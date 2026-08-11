import React from 'react';
import { DetailedMember } from '../types/member';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface HomePageProps {
  members: DetailedMember[];
  onLoginClick: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ members, onLoginClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Calculate max generation
  const maxGeneration = members.length > 0 
    ? Math.max(...members.map(m => m.generation)) 
    : 0;

  return (
    <div className="min-h-screen bg-[#F4F0EB] font-sans flex flex-col relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" 
           style={{ 
             backgroundImage: 'radial-gradient(circle at 50% 50%, #8b0000 0%, transparent 60%)',
           }} 
      />

      <header className="w-full p-4 flex justify-end relative z-50">
        {user ? (
          <div className="flex items-center gap-4 bg-white/50 px-4 py-2 rounded-lg shadow-sm backdrop-blur-sm border border-wood/20">
            <span className="text-sm font-medium text-wood-dark">
              Xin chào, <span className="text-burgundy font-bold">{user.username}</span>
            </span>
            <button 
              onClick={() => { logout(); window.location.reload(); }} 
              className="text-sm bg-wood hover:bg-wood-dark text-white px-4 py-2 rounded transition-colors shadow-sm font-medium"
            >
              Đăng xuất
            </button>
          </div>
        ) : (
          <button 
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLoginClick(); }} 
            className="text-sm border-2 border-burgundy text-burgundy hover:bg-burgundy hover:text-white px-4 py-2 rounded transition-all shadow-sm font-medium bg-white/50 backdrop-blur-sm"
          >
            Đăng Nhập Quản Trị
          </button>
        )}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 -mt-10">
        <div className="text-center mb-16 space-y-6 max-w-3xl">
          <div className="mx-auto w-32 h-1 bg-gradient-to-r from-transparent via-burgundy to-transparent mb-8"></div>
          
          <h1 className="text-5xl md:text-7xl font-serif font-bold text-burgundy mb-6 tracking-wider uppercase drop-shadow-sm whitespace-pre-line leading-tight">
            {(import.meta.env.VITE_FAMILY_TITLE || 'Gia Phả | Nguyễn Tộc').replace(' | ', '\n').replace('|', '\n')}
          </h1>
          
          <p className="text-xl md:text-2xl text-wood-dark italic font-serif leading-relaxed">
            "{import.meta.env.VITE_FAMILY_SUBTITLE || 'Mộc bản - Lưu truyền muôn đời'}"
          </p>
          
          {maxGeneration > 0 && (
            <div className="inline-block mt-4 px-6 py-2 border-y border-wood/30">
              <p className="text-lg text-wood font-medium">
                Ghi nhận <span className="text-burgundy font-bold text-2xl mx-2">{maxGeneration}</span> đời truyền thừa
              </p>
            </div>
          )}
          
          <div className="mx-auto w-32 h-1 bg-gradient-to-r from-transparent via-burgundy to-transparent mt-8"></div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl px-4">
          <button 
            onClick={() => navigate('/tree')}
            className="flex-1 group relative overflow-hidden rounded-xl bg-white p-8 shadow-lg transition-all hover:shadow-xl hover:-translate-y-1 border border-wood/10"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-burgundy/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative z-10 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-burgundy/10 flex items-center justify-center text-burgundy group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-burgundy mb-2 font-serif">Sơ Đồ Gia Phả</h3>
                <p className="text-sm text-wood-dark/80">Xem cây phả hệ, thêm mới và quản lý thông tin các thành viên.</p>
              </div>
            </div>
          </button>

          <button 
            onClick={() => navigate('/kinship')}
            className="flex-1 group relative overflow-hidden rounded-xl bg-white p-8 shadow-lg transition-all hover:shadow-xl hover:-translate-y-1 border border-wood/10"
          >
            <div className="absolute inset-0 bg-gradient-to-bl from-wood/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative z-10 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-wood/10 flex items-center justify-center text-wood-dark group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-wood-dark mb-2 font-serif">Tra Cứu Quan Hệ</h3>
                <p className="text-sm text-wood-dark/80">Tính toán và hiển thị quan hệ họ hàng, danh xưng giữa 2 thành viên.</p>
              </div>
            </div>
          </button>
        </div>
      </main>

      <footer className="w-full py-6 text-center text-sm text-wood/60 relative z-10">
        &copy; {new Date().getFullYear()} Hệ thống Quản lý Gia phả Số
      </footer>
    </div>
  );
};
