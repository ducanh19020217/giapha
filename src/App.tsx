import { useState, useEffect } from 'react'
import { Routes, Route, Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { HomePage } from './components/HomePage'
import { AddSpouseModal, AddChildModal, MarkDeceasedModal, AddRootModal, AddParentModal, AddEventModal, SetRootGenerationModal } from './components/ActionModals'
import { FamilyTree } from './components/FamilyTree'
import { ProfilePage } from './components/ProfilePage'
import { KinshipCalculator } from './components/KinshipCalculator'
import { EventsCalendar } from './components/EventsCalendar'
import { LoginModal } from './components/LoginModal'
import { IdentityModal } from './components/IdentityModal'
import { useAuth } from './context/AuthContext'
import { useIdentity } from './context/IdentityContext'
import { KINSHIP_LOOKUP_ENABLED } from './config/featureFlags'
import { DetailedMember } from './types/member'
import { FamilyEvent } from './types/event'
import * as api from './services/api'
import { getMembers, addMember, addSpouse, markDeceased, updateMember, deleteMember, logoutRemote } from './services/api'
import { AdminPanel } from './components/AdminPanel'
import { StatsPage } from './components/StatsPage'

// Bọc ProfilePage để đọc :id từ URL và tra thành viên tương ứng (route /member/:id)
function MemberPageRoute(props: {
  members: DetailedMember[];
  events: FamilyEvent[];
  isAdmin: boolean;
  onAddSpouse: (id: string) => void;
  onAddChild: (id: string) => void;
  onAddParent: (id: string) => void;
  onMarkDeceased: (id: string) => void;
  onAddEvent: (id: string) => void;
  onDeleteEvent: (id: string) => void;
  onSaveEdit: (id: string, data: Partial<DetailedMember>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const { id } = useParams();
  const { myMemberId } = useIdentity();
  const member = props.members.find(m => m.id === id);

  if (!member) {
    return (
      <div className="text-center py-24">
        <p className="text-wood-dark mb-4">Không tìm thấy thành viên này.</p>
        <Link to="/tree" className="text-burgundy underline font-medium">Quay lại Cây Phả Hệ</Link>
      </div>
    );
  }

  return (
    <ProfilePage
      member={member}
      allMembers={props.members}
      events={props.events}
      isAdmin={props.isAdmin}
      myMemberId={myMemberId}
      onAddSpouse={() => props.onAddSpouse(member.id)}
      onAddChild={() => props.onAddChild(member.id)}
      onAddParent={() => props.onAddParent(member.id)}
      onMarkDeceased={() => props.onMarkDeceased(member.id)}
      onAddEvent={() => props.onAddEvent(member.id)}
      onDeleteEvent={props.onDeleteEvent}
      onSaveEdit={(data) => props.onSaveEdit(member.id, data)}
      onDelete={() => props.onDelete(member.id)}
    />
  );
}

function App() {
  const [members, setMembers] = useState<DetailedMember[]>([]);
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [isFetching, setIsFetching] = useState(true);
  
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { myMemberId } = useIdentity();

  const location = useLocation();
  const navigate = useNavigate();
  const isTreeView = location.pathname === '/tree';

  // Các state cho Modals
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);
  const [isIdentityModalOpen, setIdentityModalOpen] = useState(false);
  const [isSpouseModalOpen, setSpouseModalOpen] = useState(false);
  const [isChildModalOpen, setChildModalOpen] = useState(false);
  const [isDeceasedModalOpen, setDeceasedModalOpen] = useState(false);
  const [isGenerationModalOpen, setGenerationModalOpen] = useState(false);
  const [isRootModalOpen, setRootModalOpen] = useState(false);
  const [isParentModalOpen, setParentModalOpen] = useState(false);
  const [isEventModalOpen, setEventModalOpen] = useState(false);
  const [eventModalDefaultMemberId, setEventModalDefaultMemberId] = useState<string | undefined>(undefined);

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

  const fetchEventsData = async () => {
    try {
      const data = await api.fetchEvents();
      setEvents(data);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchEventsData();
  }, []);

  const selectedMember = members.find(m => m.id === selectedMemberId);
  const myMember = members.find(m => m.id === myMemberId);

  // --- HANDLERS ---
  const handleAddRoot = async (name: string, gender: 'male'|'female', birthDate: string, generation: number) => {
    try {
      await addMember({
        name,
        gender,
        birthDate: birthDate || undefined,
        generation,
        birthOrder: 1,
      });
      await fetchMembers();
      setRootModalOpen(false);
    } catch (error) {
      console.error('Failed to add root member:', error);
    }
  };

  const handleEditMember = async (id: string, data: Partial<DetailedMember>) => {
    try {
      await updateMember(id, data);
      await fetchMembers();
    } catch (error) {
      console.error('Failed to update member:', error);
      alert('Lỗi khi lưu thay đổi: ' + error);
      throw error; // để trang hồ sơ giữ nguyên form thay vì đóng chế độ sửa
    }
  };

  const handleDeleteMember = async (id: string) => {
    // 1. Optimistic Update: Xóa ngay trên giao diện để có cảm giác tức thì (0.1s)
    setMembers(prev => prev.filter(m => m.id !== id));
    if (selectedMemberId === id) {
      setSelectedMemberId('');
    }
    if (location.pathname === `/member/${id}`) {
      navigate('/tree');
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

  // Mở các modal thao tác nhanh (dùng chung cho Cây Phả Hệ và Trang Hồ Sơ)
  const openAddSpouse = (id: string) => { setSelectedMemberId(id); setSpouseModalOpen(true); };
  const openAddChild = (id: string) => { setSelectedMemberId(id); setChildModalOpen(true); };
  const openAddParent = (id: string) => { setSelectedMemberId(id); setParentModalOpen(true); };
  const openMarkDeceased = (id: string) => { setSelectedMemberId(id); setDeceasedModalOpen(true); };
  const openSetRootGeneration = (id: string) => { setSelectedMemberId(id); setGenerationModalOpen(true); };

  const handleSetRootGeneration = async (generation: number) => {
    if (!selectedMember) return;
    try {
      await api.shiftGenerations(generation - selectedMember.generation);
      await fetchMembers();
      setGenerationModalOpen(false);
    } catch (error) {
      console.error('Failed to shift generations:', error);
      alert('Lỗi khi đặt số đời: ' + error);
    }
  };
  const openAddEvent = (id: string) => { setEventModalDefaultMemberId(id); setEventModalOpen(true); };

  const handleAddSpouse = async (name: string, isPrimary: boolean, birthDate: string) => {
    if (!selectedMember) return;
    try {
      const order = (selectedMember.spouses?.length || 0) + 1;
      const newSpouse = await addSpouse(selectedMember.id, { name, isPrimary, order, birthDate: birthDate || undefined }, selectedMember);
      // Apps Script bản cũ (chưa triển khai lại) bỏ qua birthDate khi thêm vợ/chồng -> lưu bổ sung
      if (birthDate && newSpouse?.id && !newSpouse.birthDate) {
        await updateMember(newSpouse.id, { birthDate });
      }
      await fetchMembers();
      setSpouseModalOpen(false);
    } catch (error) {
      console.error('Failed to add spouse:', error);
    }
  };

  const handleAddChild = async (name: string, gender: 'male'|'female', otherParentId: string | null, relationType: 'BIOLOGICAL' | 'ADOPTED' | 'STEPCHILD', birthOrder: number, birthDate: string) => {
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
        birthDate: birthDate || undefined,
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

  const handleAddEvent = async (data: Partial<FamilyEvent>) => {
    try {
      await api.addEvent(data);
      await fetchEventsData();
      setEventModalOpen(false);
    } catch (error) {
      console.error('Failed to add event:', error);
      alert('Lỗi khi thêm sự kiện: ' + error);
    }
  };

  const handleLogout = () => {
    logoutRemote().finally(() => {
      logout();
      window.location.reload();
    });
  };

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa sự kiện này?')) return;
    try {
      await api.deleteEvent(id);
      await fetchEventsData();
    } catch (error) {
      console.error('Failed to delete event:', error);
      alert('Lỗi khi xóa sự kiện: ' + error);
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
          <div className={`min-h-screen bg-[#F4F0EB] font-sans text-wood-dark ${isTreeView ? 'p-0 h-dvh overflow-hidden' : 'p-4 md:p-8'}`}>
            {!isTreeView && (
              <header className="w-full max-w-[95%] mx-auto mb-10 relative z-50 print:hidden">
                {/* Thanh công cụ trên mobile: nằm trên tiêu đề theo dòng chảy bình thường, không đè lên chữ */}
                <div className="flex md:hidden items-center justify-between gap-2 mb-4">
                  <Link
                    to="/"
                    aria-label="Trang chủ"
                    className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full border border-wood-dark text-wood-dark hover:bg-wood-dark hover:text-white transition-colors shadow-sm bg-white/50 backdrop-blur-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </Link>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => setIdentityModalOpen(true)}
                      className="text-xs border border-wood-dark/30 text-wood-dark hover:bg-wood-dark hover:text-white px-2.5 py-1.5 rounded-full transition-colors shadow-sm font-medium bg-white/50 backdrop-blur-sm truncate max-w-[120px]"
                    >
                      {myMember ? myMember.name : 'Bạn là ai?'}
                    </button>
                    {user ? (
                      <button onClick={handleLogout} className="flex-shrink-0 text-xs bg-wood hover:bg-wood-dark text-white px-2.5 py-1.5 rounded-full transition-colors shadow-sm font-medium">
                        Đăng xuất
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLoginModalOpen(true); }}
                        className="flex-shrink-0 text-xs border-2 border-burgundy text-burgundy hover:bg-burgundy hover:text-white px-2.5 py-1.5 rounded-full transition-all shadow-sm font-medium bg-white/50 backdrop-blur-sm"
                      >
                        Đăng nhập
                      </button>
                    )}
                  </div>
                </div>

                {/* Desktop: điều khiển đặt ở góc tuyệt đối, không chiếm chỗ của tiêu đề */}
                <div className="hidden md:block absolute top-4 left-4 z-10">
                  <Link to="/" className="text-sm border border-wood-dark text-wood-dark hover:bg-wood-dark hover:text-white px-4 py-2 rounded transition-colors shadow-sm font-medium flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Trang Chủ
                  </Link>
                </div>
                <div className="hidden md:flex absolute top-4 right-4 z-10 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIdentityModalOpen(true)}
                    className="text-sm border border-wood-dark/30 text-wood-dark hover:bg-wood-dark hover:text-white px-4 py-2 rounded transition-colors shadow-sm font-medium bg-white/50 backdrop-blur-sm"
                  >
                    {myMember ? <>Bạn: <span className="font-bold">{myMember.name}</span></> : 'Bạn là ai?'}
                  </button>
                  {user ? (
                    <div className="flex items-center gap-4 bg-white/50 px-4 py-2 rounded-lg shadow-sm backdrop-blur-sm border border-wood/20">
                      <span className="text-sm font-medium text-wood-dark">Xin chào, <span className="text-burgundy font-bold">{user.username}</span></span>
                      <button onClick={handleLogout} className="text-sm bg-wood hover:bg-wood-dark text-white px-4 py-2 rounded transition-colors shadow-sm font-medium">Đăng xuất</button>
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

                <div className="text-center relative py-2 md:py-6">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-burgundy/20"></div>
                  <h1 className="text-4xl md:text-5xl font-serif font-bold text-burgundy mb-3 tracking-wide uppercase">
                    {import.meta.env.VITE_FAMILY_TITLE || 'Gia Phả Nguyễn Tộc'}
                  </h1>
                  <p className="text-base text-wood italic font-serif">
                    {import.meta.env.VITE_FAMILY_SUBTITLE || 'Mộc bản - Lưu truyền muôn đời'}
                  </p>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-burgundy/20"></div>
                </div>
              </header>
            )}

            {isTreeView && (
              <div className="fixed top-4 left-4 z-50 flex items-center gap-1.5 md:gap-2 max-w-[calc(100vw-2rem)]">
                <Link
                  to="/"
                  aria-label="Trang chủ"
                  className="flex-shrink-0 flex items-center justify-center w-9 h-9 md:w-auto md:h-auto md:px-4 md:py-2 rounded-full bg-white/80 backdrop-blur-sm border border-wood-dark/20 text-wood-dark hover:bg-wood-dark hover:text-white transition-colors shadow-md font-medium md:flex md:items-center md:gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span className="hidden md:inline">Trang Chủ</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setIdentityModalOpen(true)}
                  className="min-w-0 truncate text-xs md:text-sm bg-white/80 backdrop-blur-sm border border-wood-dark/20 text-wood-dark hover:bg-wood-dark hover:text-white px-3 py-1.5 md:px-4 md:py-2 rounded-full transition-colors shadow-md font-medium"
                >
                  {myMember ? myMember.name : 'Bạn là ai?'}
                </button>
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
                      onAddSpouse={openAddSpouse}
                      onAddChild={openAddChild}
                      onMarkDeceased={openMarkDeceased}
                      onSetRootGeneration={openSetRootGeneration}
                      onAddRoot={() => setRootModalOpen(true)}
                      isAdmin={isAdmin}
                      myMemberId={myMemberId}
                    />
                  </div>
                } />

                <Route path="member/:id" element={
                  <MemberPageRoute
                    members={members}
                    events={events}
                    isAdmin={isAdmin}
                    onAddSpouse={openAddSpouse}
                    onAddChild={openAddChild}
                    onAddParent={openAddParent}
                    onMarkDeceased={openMarkDeceased}
                    onAddEvent={openAddEvent}
                    onDeleteEvent={handleDeleteEvent}
                    onSaveEdit={handleEditMember}
                    onDelete={handleDeleteMember}
                  />
                } />

                <Route path="kinship" element={
                  KINSHIP_LOOKUP_ENABLED ? (
                    <div className="mt-8 bg-white p-8 rounded-xl shadow-sm border border-wood/10">
                      <h2 className="text-2xl font-serif text-burgundy mb-6 text-center">Tra Cứu Quan Hệ Huyết Thống</h2>
                      <KinshipCalculator members={members} />
                    </div>
                  ) : <Navigate to="/" replace />
                } />

                <Route path="events" element={
                  <div className="mt-4">
                    <EventsCalendar
                      members={members}
                      events={events}
                      isAdmin={isAdmin}
                      onAddEvent={() => { setEventModalDefaultMemberId(undefined); setEventModalOpen(true); }}
                      onDeleteEvent={handleDeleteEvent}
                    />
                  </div>
                } />

                <Route path="stats" element={<StatsPage members={members} />} />

                <Route path="admin" element={
                  isAdmin ? (
                    <AdminPanel members={members} onDataChanged={() => { fetchMembers(); fetchEventsData(); }} />
                  ) : <Navigate to="/" replace />
                } />
              </Routes>
            </main>

            {!isTreeView && (
              <footer className="mt-16 text-center text-sm text-wood/60 pb-8 print:hidden">
                &copy; {new Date().getFullYear()} Hệ thống Quản lý Gia phả Số
              </footer>
            )}
          </div>
        } />
      </Routes>

      {/* --- MODALS --- */}
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setLoginModalOpen(false)} />
      <IdentityModal isOpen={isIdentityModalOpen} onClose={() => setIdentityModalOpen(false)} members={members} />

      <AddRootModal
        isOpen={isRootModalOpen}
        onClose={() => setRootModalOpen(false)}
        onSave={handleAddRoot}
      />

      <AddEventModal
        isOpen={isEventModalOpen}
        onClose={() => setEventModalOpen(false)}
        onSave={handleAddEvent}
        allMembers={members}
        defaultMemberId={eventModalDefaultMemberId}
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
          <SetRootGenerationModal
            isOpen={isGenerationModalOpen}
            onClose={() => setGenerationModalOpen(false)}
            onSave={handleSetRootGeneration}
            targetMember={selectedMember}
            memberCount={members.length}
          />
        </>
      )}
    </>
  )
}

export default App
