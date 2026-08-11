import { useState, useEffect } from 'react'
import { HomePage } from './components/HomePage'
import { AddSpouseModal, AddChildModal, MarkDeceasedModal, AddRootModal, EditMemberModal } from './components/ActionModals'
import { FamilyTree } from './components/FamilyTree'
import { ProfilePage } from './components/ProfilePage'
import { KinshipCalculator } from './components/KinshipCalculator'
import { LoginModal } from './components/LoginModal'
import { useAuth } from './context/AuthContext'
import { DetailedMember } from './types/member'
import { getMembers, addMember, addSpouse, markDeceased, updateMember } from './services/api'
// Khởi tạo ID ngẫu nhiên đơn giản
const generateId = () => 'm_' + Math.random().toString(36).substr(2, 9);

// Mock Data Ban đầu
const INITIAL_MEMBERS: DetailedMember[] = [
  {
    id: 'm1',
    name: 'Nguyễn Văn Cụ Tổ',
    gender: 'male',
    birthDate: '1900',
    isDeceased: true,
    deathDate: '1980',
    generation: 1,
    birthOrder: 1,
    spouses: [],
    academicLevel: 'Nho học',
    career: 'Lý trưởng',
    biography: 'Người khai sinh ra dòng họ Nguyễn Văn tại làng Vọng.',
    achievements: ['Xây dựng từ đường dòng họ', 'Khuyến học làng xã']
  },
  {
    id: 'm2',
    name: 'Nguyễn Văn A (Con cả)',
    gender: 'male',
    birthDate: '1930',
    isDeceased: false,
    generation: 2,
    birthOrder: 1,
    fatherId: 'm1',
    spouses: [],
    career: 'Trưởng Tộc'
  },
  {
    id: 'm3',
    name: 'Nguyễn Văn B (Con thứ)',
    gender: 'male',
    birthDate: '1935',
    isDeceased: false,
    generation: 2,
    birthOrder: 2,
    fatherId: 'm1',
    spouses: []
  }
];

function App() {
  const [members, setMembers] = useState<DetailedMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [currentView, setCurrentView] = useState<'home' | 'tree' | 'kinship'>('home');
  
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Các state cho Modals
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);
  const [isSpouseModalOpen, setSpouseModalOpen] = useState(false);
  const [isChildModalOpen, setChildModalOpen] = useState(false);
  const [isDeceasedModalOpen, setDeceasedModalOpen] = useState(false);
  const [isRootModalOpen, setRootModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);

  const fetchMembers = async () => {
    try {
      const data = await getMembers();
      setMembers(data);
      if (data.length > 0 && !selectedMemberId) {
        setSelectedMemberId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const selectedMember = members.find(m => m.id === selectedMemberId);

  // --- HANDLERS ---
  const handleAddRoot = async (name: string, gender: 'male'|'female') => {
    try {
      await addMember({
        name,
        gender,
        generation: 1,
        birthOrder: 1,
      });
      await fetchMembers();
      setRootModalOpen(false);
    } catch (error) {
      console.error('Failed to add root member:', error);
    }
  };

  const handleEditMember = async (data: Partial<DetailedMember>) => {
    if (!selectedMember) return;
    try {
      await updateMember(selectedMember.id, data);
      await fetchMembers();
      setEditModalOpen(false);
    } catch (error) {
      console.error('Failed to update member:', error);
    }
  };

  const handleAddSpouse = async (name: string, isPrimary: boolean) => {
    if (!selectedMember) return;
    try {
      const order = (selectedMember.spouses?.length || 0) + 1;
      await addSpouse(selectedMember.id, { name, isPrimary, order });
      await fetchMembers();
      setSpouseModalOpen(false);
    } catch (error) {
      console.error('Failed to add spouse:', error);
    }
  };

  const handleAddChild = async (name: string, gender: 'male'|'female', otherParentId: string | null) => {
    if (!selectedMember) return;
    try {
      const existingChildren = members.filter(m => m.fatherId === selectedMember.id || m.motherId === selectedMember.id);
      const nextBirthOrder = existingChildren.length + 1;

      await addMember({
        name,
        gender,
        generation: selectedMember.generation + 1,
        birthOrder: nextBirthOrder,
        fatherId: selectedMember.gender === 'male' ? selectedMember.id : (otherParentId || undefined),
        motherId: selectedMember.gender === 'female' ? selectedMember.id : (otherParentId || undefined),
      });
      await fetchMembers();
      setChildModalOpen(false);
    } catch (error) {
      console.error('Failed to add child:', error);
    }
  };

  const handleMarkDeceased = async (deathDate: string) => {
    if (!selectedMember) return;
    try {
      await markDeceased(selectedMember.id, { deathDate });
      await fetchMembers();
      setDeceasedModalOpen(false);
    } catch (error) {
      console.error('Failed to mark deceased:', error);
    }
  };

  if (currentView === 'home') {
    return (
      <>
        <HomePage 
          members={members} 
          onNavigate={setCurrentView} 
          onLoginClick={() => setLoginModalOpen(true)} 
        />
        <LoginModal isOpen={isLoginModalOpen} onClose={() => setLoginModalOpen(false)} />
      </>
    );
  }

  return (
    <div className={`min-h-screen bg-[#F4F0EB] font-sans text-wood-dark ${currentView === 'tree' ? 'p-0 h-screen overflow-hidden' : 'p-4 md:p-8'}`}>
      {currentView !== 'tree' && (
        <header className="w-full max-w-[95%] mx-auto mb-10 text-center relative py-6">
          <div className="absolute top-4 left-4 z-10 hidden md:block">
            <button 
              onClick={() => setCurrentView('home')} 
              className="text-sm border border-wood-dark text-wood-dark hover:bg-wood-dark hover:text-white px-4 py-2 rounded transition-colors shadow-sm font-medium flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Trang Chủ
            </button>
          </div>
          <div className="absolute top-4 right-4 z-10">
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-wood-dark">Xin chào, {user.username} ({user.role})</span>
                <button onClick={logout} className="text-xs bg-wood hover:bg-wood-dark text-white px-3 py-1.5 rounded transition-colors shadow-sm">Đăng xuất</button>
              </div>
            ) : (
              <button onClick={() => setLoginModalOpen(true)} className="text-xs border border-burgundy text-burgundy hover:bg-burgundy hover:text-white px-3 py-1.5 rounded transition-colors shadow-sm font-medium">Đăng Nhập Quản Trị</button>
            )}
          </div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-burgundy/20"></div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-burgundy mb-3 tracking-wide uppercase">
            Gia Phả Nguyễn Tộc
          </h1>
          <p className="text-base text-wood italic font-serif">Mộc bản - Lưu truyền muôn đời</p>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-burgundy/20"></div>
        </header>
      )}

      {currentView === 'tree' && (
        <div className="fixed top-4 left-4 z-50">
          <button 
            onClick={() => setCurrentView('home')} 
            className="text-sm bg-white/80 backdrop-blur-sm border border-wood-dark/20 text-wood-dark hover:bg-wood-dark hover:text-white px-4 py-2 rounded-full transition-colors shadow-md font-medium flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Trang Chủ
          </button>
        </div>
      )}

      <main className={`w-full mx-auto ${currentView === 'tree' ? 'h-full w-full max-w-full' : 'max-w-[95%]'}`}>
        {currentView === 'tree' && (
          <div className="h-full w-full">
            <FamilyTree 
              members={members} 
              selectedMemberId={selectedMemberId} 
              onSelectMember={setSelectedMemberId} 
              onAddSpouse={(id) => { setSelectedMemberId(id); setSpouseModalOpen(true); }}
              onAddChild={(id) => { setSelectedMemberId(id); setChildModalOpen(true); }}
              onMarkDeceased={(id) => { setSelectedMemberId(id); setDeceasedModalOpen(true); }}
              onAddRoot={() => setRootModalOpen(true)}
              isAdmin={isAdmin}
            />
          </div>
        )}

        {currentView === 'kinship' && (
          <div className="mt-8 bg-white p-8 rounded-xl shadow-sm border border-wood/10">
            <h2 className="text-2xl font-serif text-burgundy mb-6 text-center">Tra Cứu Quan Hệ Huyết Thống</h2>
            <KinshipCalculator members={members} />
          </div>
        )}
      </main>

      {currentView !== 'tree' && (
        <footer className="mt-16 text-center text-sm text-wood/60 pb-8">
          &copy; {new Date().getFullYear()} Hệ thống Quản lý Gia phả Số
        </footer>
      )}

      {/* --- MODALS --- */}
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setLoginModalOpen(false)} />

      {selectedMember && (
        <ProfilePage 
          member={selectedMember} 
          allMembers={members} 
          onAddSpouse={() => setSpouseModalOpen(true)}
          onAddChild={() => setChildModalOpen(true)}
          onMarkDeceased={() => setDeceasedModalOpen(true)}
          onEdit={() => setEditModalOpen(true)}
          isAdmin={isAdmin}
          onClose={() => setSelectedMemberId('')}
        />
      )}

      <AddRootModal 
        isOpen={isRootModalOpen} 
        onClose={() => setRootModalOpen(false)} 
        onSave={handleAddRoot} 
      />
      
      {selectedMember && (
        <>
          <AddSpouseModal 
            isOpen={isSpouseModalOpen} 
            onClose={() => setSpouseModalOpen(false)} 
            onSave={handleAddSpouse} 
            targetMember={selectedMember} 
          />
          <AddChildModal 
            isOpen={isChildModalOpen} 
            onClose={() => setChildModalOpen(false)} 
            onSave={handleAddChild} 
            targetMember={selectedMember} 
            allMembers={members}
          />
          <MarkDeceasedModal 
            isOpen={isDeceasedModalOpen} 
            onClose={() => setDeceasedModalOpen(false)} 
            onSave={handleMarkDeceased} 
            targetMember={selectedMember} 
          />
          <EditMemberModal
            isOpen={isEditModalOpen}
            onClose={() => setEditModalOpen(false)}
            onSave={handleEditMember}
            targetMember={selectedMember}
          />
        </>
      )}
    </div>
  )
}

export default App
