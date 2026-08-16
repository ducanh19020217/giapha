import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'genealogy_my_member_id';

interface IdentityContextType {
  myMemberId: string | null;
  setMyMemberId: (id: string | null) => void;
}

const IdentityContext = createContext<IdentityContextType | undefined>(undefined);

// Lưu "bạn là ai trong gia phả" chỉ trên trình duyệt (localStorage), không gửi lên
// backend — mỗi người xem tự chọn bản thân trên máy của họ để xem xưng hô cá nhân hóa.
export const IdentityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [myMemberId, setMyMemberIdState] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setMyMemberIdState(stored);
  }, []);

  const setMyMemberId = (id: string | null) => {
    setMyMemberIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <IdentityContext.Provider value={{ myMemberId, setMyMemberId }}>
      {children}
    </IdentityContext.Provider>
  );
};

export const useIdentity = () => {
  const context = useContext(IdentityContext);
  if (context === undefined) {
    throw new Error('useIdentity must be used within an IdentityProvider');
  }
  return context;
};
