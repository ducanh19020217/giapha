import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { HomePage } from './components/HomePage'
import { AddSpouseModal, AddChildModal, MarkDeceasedModal, AddRootModal, EditMemberModal, AddParentModal } from './components/ActionModals'
import { FamilyTree } from './components/FamilyTree'
import { ProfilePage } from './components/ProfilePage'
import { KinshipCalculator } from './components/KinshipCalculator'
import { EventsCalendar } from './components/EventsCalendar'
import { LoginModal } from './components/LoginModal'
import { useAuth } from './context/AuthContext'
import { DetailedMember } from './types/member'
import * as api from './services/api'
import { getMembers, addMember, addSpouse, markDeceased, updateMember, deleteMember } from './services/api'
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
  const [isFetching, setIsFetching] = useState(true);
  
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const location = useLocation();
  const isTreeView = location.pathname === '/tree';

  // Các state cho Modals
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);
  const [isSpouseModalOpen, setSpouseModalOpen] = useState(false);
  const [isChildModalOpen, setChildModalOpen] = useState(false);
  const [isDeceasedModalOpen, setDeceasedModalOpen] = useState(false);
  const [isRootModalOpen, setRootModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isParentModalOpen, setParentModalOpen] = useState(false);

  const fetchMembers = async () => {
    setIsFetching(true);
    try {
      const data = await getMembers();
      setMembers(data);
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setIsFetching(false);
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

  const handleDeleteMember = async (id: string) => {
    // 1. Optimistic Update: Xóa ngay trên giao diện để có cảm giác tức thì (0.1s)
    setMembers(prev => prev.filter(m => m.id !== id));
    if (selectedMemberId === id) {
      setSelectedMemberId('');
    }

    // 2. Gọi API ngầm phía sau (mất khoảng ~3 giây nhưng người dùng không phải đợi)
    try {
      await deleteMember(id);
      // fetchMembers đã tự gọi setMembers bên trong nó, không cần .then()
      fetchMembers();
    } catch (error) {
      console.error('Failed to delete member:', error);
      alert('Lỗi: ' + error);
      // 3. Phục hồi (Rollback) nếu lỗi
      fetchMembers();
    }
  };

  const handleAddSpouse = async (name: string, isPrimary: boolean) => {
    if (!selectedMember) return;
    try {
      const order = (selectedMember.spouses?.length || 0) + 1;
      await addSpouse(selectedMember.id, { name, isPrimary, order }, selectedMember);
      await fetchMembers();
      setSpouseModalOpen(false);
    } catch (error) {
      console.error('Failed to add spouse:', error);
    }
  };

  const handleAddChild = async (name: string, gender: 'male'|'female', otherParentId: string | null, relationType: 'BIOLOGICAL' | 'ADOPTED' | 'STEPCHILD', birthOrder: number) => {
    if (!selectedMember) return;
    try {
      // Handle stepchild logic
      let fatherId = selectedMember.gender === 'male' ? selectedMember.id : (otherParentId || undefined);
      let motherId = selectedMember.gender === 'female' ? selectedMember.id : (otherParentId || undefined);

      if (relationType === 'STEPCHILD' && otherParentId) {
        if (otherParentId === selectedMember.id) {
           // Con riêng của người đang chọn
           fatherId = selectedMember.gender === 'male' ? selectedMember.id : undefined;
           motherId = selectedMember.gender === 'female' ? selectedMember.id : undefined;
        } else {
           // Con riêng của vợ/chồng (otherParentId)
           const spouse = members.find(m => m.id === otherParentId);
           if (spouse) {
             fatherId = spouse.gender === 'male' ? spouse.id : undefined;
             motherId = spouse.gender === 'female' ? spouse.id : undefined;
           }
        }
      }

      await addMember({
        name,
        gender,
        generation: selectedMember.generation + 1,
        birthOrder,
        fatherId,
        motherId,
        relationType
      });
      await fetchMembers();
      setChildModalOpen(false);
    } catch (error) {
      console.error('Failed to add child:', error);
    }
  };

  const handleAddParent = async (name: string, gender: 'male'|'female', birthDate: string, isDeceased: boolean) => {
    if (!selectedMember) return;
    try {
      await api.addParent(selectedMember.id, { name, gender, birthDate, isDeceased });
      await fetchMembers();
      setParentModalOpen(false);
    } catch (error) {
      console.error('Failed to add parent:', error);
      alert('Lỗi khi thêm Phụ/Mẫu: ' + error);
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

  return (
    <>
      <Routes>
        <Route path="/" element={
          <HomePage 
            members={members} 
            onLoginClick={() => setLoginModalOpen(true)} 
          />
        } />
        
        <Route path="/*" element={
          <div className={`min-h-screen bg-[#F4F0EB] font-sans text-wood-dark ${isTreeView ? 'p-0 h-screen overflow-hidden' : 'p-4 md:p-8'}`}>
            {!isTreeView && (
              <header className="w-full max-w-[95%] mx-auto mb-10 text-center relative py-6 z-50">
                <div className="absolute top-4 left-4 z-10 hidden md:block">
                  <Link to="/" className="text-sm border border-wood-dark text-wood-dark hover:bg-wood-dark hover:text-white px-4 py-2 rounded transition-colors shadow-sm font-medium flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Trang Chủ
                  </Link>
                </div>
                <div className="absolute top-4 right-4 z-10">
                  {user ? (
                    <div className="flex items-center gap-4 bg-white/50 px-4 py-2 rounded-lg shadow-sm backdrop-blur-sm border border-wood/20">
                      <span className="text-sm font-medium text-wood-dark">Xin chào, <span className="text-burgundy font-bold">{user.username}</span></span>
                      <button onClick={() => { logout(); window.location.reload(); }} className="text-sm bg-wood hover:bg-wood-dark text-white px-4 py-2 rounded transition-colors shadow-sm font-medium">Đăng xuất</button>
                    </div>
                  ) : (
                    <button 
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLoginModalOpen(true); }} 
                      className="text-sm border-2 border-burgundy text-burgundy hover:bg-burgundy hover:text-white px-4 py-2 rounded transition-all shadow-sm font-medium bg-white/50 backdrop-blur-sm"
                    >
                      Đăng Nhập Quản Trị
                    </button>
                  )}
                </div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-burgundy/20"></div>
                <h1 className="text-4xl md:text-5xl font-serif font-bold text-burgundy mb-3 tracking-wide uppercase">
                  {import.meta.env.VITE_FAMILY_TITLE || 'Gia Phả Nguyễn Tộc'}
                </h1>
                <p className="text-base text-wood italic font-serif">
                  {import.meta.env.VITE_FAMILY_SUBTITLE || 'Mộc bản - Lưu truyền muôn đời'}
                </p>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-burgundy/20"></div>
              </header>
            )}

            {isTreeView && (
              <div className="fixed top-4 left-4 z-50">
                <Link to="/" className="text-sm bg-white/80 backdrop-blur-sm border border-wood-dark/20 text-wood-dark hover:bg-wood-dark hover:text-white px-4 py-2 rounded-full transition-colors shadow-md font-medium flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Trang Chủ
                </Link>
              </div>
            )}

            <main className={`w-full mx-auto ${isTreeView ? 'h-full w-full max-w-full' : 'max-w-[95%]'}`}>
              <Routes>
                <Route path="tree" element={
                  <div className="h-full w-full">
                    <FamilyTree 
                      members={members} 
                      isLoading={isFetching}
                      selectedMemberId={selectedMemberId} 
                      onSelectMember={setSelectedMemberId} 
                      onAddSpouse={(id) => { setSelectedMemberId(id); setSpouseModalOpen(true); }}
                      onAddChild={(id) => { setSelectedMemberId(id); setChildModalOpen(true); }}
                      onMarkDeceased={(id) => { setSelectedMemberId(id); setDeceasedModalOpen(true); }}
                      onAddRoot={() => setRootModalOpen(true)}
                      isAdmin={isAdmin}
                    />
                  </div>
                } />
                
                <Route path="kinship" element={
                  <div className="mt-8 bg-white p-8 rounded-xl shadow-sm border border-wood/10">
                    <h2 className="text-2xl font-serif text-burgundy mb-6 text-center">Tra Cứu Quan Hệ Huyết Thống</h2>
                    <KinshipCalculator members={members} />
                  </div>
                } />

                <Route path="events" element={
                  <div className="mt-4">
                    <EventsCalendar members={members} />
                  </div>
                } />
              </Routes>
            </main>

            {!isTreeView && (
              <footer className="mt-16 text-center text-sm text-wood/60 pb-8">
                &copy; {new Date().getFullYear()} Hệ thống Quản lý Gia phả Số
              </footer>
            )}
          </div>
        } />
      </Routes>

      {/* --- MODALS --- */}
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setLoginModalOpen(false)} />

      {selectedMember && (
        <ProfilePage 
          member={selectedMember} 
          allMembers={members} 
          onAddSpouse={() => setSpouseModalOpen(true)}
          onAddChild={() => setChildModalOpen(true)}
          onAddParent={() => setParentModalOpen(true)}
          onMarkDeceased={() => setDeceasedModalOpen(true)}
          onEdit={() => setEditModalOpen(true)}
          onDelete={() => handleDeleteMember(selectedMember.id)}
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
          <AddParentModal 
            isOpen={isParentModalOpen} 
            onClose={() => setParentModalOpen(false)} 
            onSave={handleAddParent} 
            targetMember={selectedMember} 
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
    </>
  )
}

export default App
