import React, { useState } from 'react';
import { DetailedMember } from '../types/member';
import { submitEditRequest } from '../services/api';

interface SuggestEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: DetailedMember;
}

// Cho phép khách (không có tài khoản Admin) đề xuất chỉnh sửa 1 vài thông tin cơ bản
// của hồ sơ — không áp dụng ngay, Admin sẽ vào mục "Trang Quản Trị > Đề xuất chờ duyệt"
// để xem và quyết định có áp dụng hay không.
export const SuggestEditModal: React.FC<SuggestEditModalProps> = ({ isOpen, onClose, member }) => {
  const [name, setName] = useState(member.name);
  const [birthDate, setBirthDate] = useState(member.birthDate || '');
  const [career, setCareer] = useState(member.career || '');
  const [biography, setBiography] = useState(member.biography || '');
  const [submitterName, setSubmitterName] = useState('');
  const [submitterContact, setSubmitterContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const changes: Record<string, string> = {};
    if (name.trim() && name.trim() !== member.name) changes.name = name.trim();
    if (birthDate.trim() && birthDate.trim() !== (member.birthDate || '')) changes.birthDate = birthDate.trim();
    if (career.trim() !== (member.career || '')) changes.career = career.trim();
    if (biography.trim() !== (member.biography || '')) changes.biography = biography.trim();

    if (Object.keys(changes).length === 0) {
      setError('Bạn chưa thay đổi thông tin nào so với hồ sơ hiện tại.');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitEditRequest(member.id, changes, submitterName || undefined, submitterContact || undefined);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setDone(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden relative max-h-[90vh] flex flex-col">
        <div className="bg-wood text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h3 className="text-lg font-serif">Đề xuất chỉnh sửa hồ sơ: {member.name}</h3>
          <button onClick={handleClose} className="text-white hover:text-orange-200 font-bold text-xl">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto">
          {done ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-green-700 font-medium">Đã gửi đề xuất thành công!</p>
              <p className="text-sm text-gray-500">Quản trị viên sẽ xem xét và áp dụng nếu hợp lý. Cảm ơn bạn đã đóng góp.</p>
              <button onClick={handleClose} className="mt-2 bg-burgundy hover:bg-burgundy-dark text-white px-6 py-2 rounded font-medium">Đóng</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm border border-red-200">{error}</div>}
              <p className="text-xs text-gray-500">Sửa những thông tin bạn thấy chưa đúng bên dưới. Thông tin gửi lên sẽ được Admin duyệt trước khi cập nhật vào gia phả chung.</p>

              <div>
                <label className="block text-sm font-medium text-wood-dark mb-1">Họ tên</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-wood-dark mb-1">Ngày/Năm sinh</label>
                <input type="text" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" placeholder="VD: 1990 hoặc 01/01/1990" />
              </div>
              <div>
                <label className="block text-sm font-medium text-wood-dark mb-1">Nghề nghiệp/Chức vụ</label>
                <input type="text" value={career} onChange={e => setCareer(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-wood-dark mb-1">Tiểu sử</label>
                <textarea value={biography} onChange={e => setBiography(e.target.value)} rows={4} className="w-full border rounded p-2 focus:border-bronze outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-wood-light/10 pt-4">
                <div>
                  <label className="block text-sm font-medium text-wood-dark mb-1">Tên của bạn (tùy chọn)</label>
                  <input type="text" value={submitterName} onChange={e => setSubmitterName(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-wood-dark mb-1">SĐT/Email liên hệ (tùy chọn)</label>
                  <input type="text" value={submitterContact} onChange={e => setSubmitterContact(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isSubmitting} className="bg-burgundy hover:bg-burgundy-dark text-white px-6 py-2 rounded font-medium transition-colors disabled:opacity-50">
                  {isSubmitting ? 'Đang gửi...' : 'Gửi đề xuất'}
                </button>
                <button type="button" onClick={handleClose} disabled={isSubmitting} className="bg-gray-100 hover:bg-gray-200 text-wood-dark px-6 py-2 rounded font-medium transition-colors disabled:opacity-50">
                  Hủy
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
