import React, { useState, useMemo } from 'react';
import { DetailedMember } from '../types/member';
import { useIdentity } from '../context/IdentityContext';

interface IdentityModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: DetailedMember[];
}

export const IdentityModal: React.FC<IdentityModalProps> = ({ isOpen, onClose, members }) => {
  const { myMemberId, setMyMemberId } = useIdentity();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m => m.name.toLowerCase().includes(q));
  }, [members, query]);

  if (!isOpen) return null;

  const currentMe = members.find(m => m.id === myMemberId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden relative flex flex-col max-h-[80vh]">
        <div className="bg-wood text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h3 className="text-xl font-serif">Bạn là ai trong Gia Phả?</h3>
          <button onClick={onClose} className="text-white hover:text-orange-200 font-bold text-xl">&times;</button>
        </div>
        <div className="p-6 flex flex-col gap-4 overflow-hidden flex-1">
          <p className="text-sm text-gray-600">
            Chọn tên bạn trong danh sách để xem cách xưng hô của bạn với từng thành viên trên Cây Phả Hệ và Trang Hồ Sơ. Lựa chọn này chỉ lưu trên trình duyệt của bạn, không ảnh hưởng đến ai khác.
          </p>
          {currentMe && (
            <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm flex items-center justify-between flex-shrink-0">
              <span>Hiện tại: <span className="font-semibold text-burgundy">{currentMe.name}</span></span>
              <button
                onClick={() => setMyMemberId(null)}
                className="text-xs text-gray-500 hover:text-red-500 underline"
              >
                Bỏ chọn
              </button>
            </div>
          )}
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tìm tên..."
            className="w-full border rounded p-2 focus:border-bronze outline-none flex-shrink-0"
          />
          <div className="overflow-y-auto flex-1 -mx-2 px-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-4">Không tìm thấy</p>
            ) : (
              <ul className="space-y-1">
                {filtered.map(m => (
                  <li key={m.id}>
                    <button
                      onClick={() => { setMyMemberId(m.id); onClose(); }}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${m.id === myMemberId ? 'bg-burgundy text-white font-medium' : 'hover:bg-orange-50 text-wood-dark'}`}
                    >
                      {m.name} <span className="text-xs opacity-70">(Đời {m.generation})</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
