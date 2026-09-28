import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DetailedMember } from '../types/member';
import { FamilyEvent } from '../types/event';
import { DateWithCalendarInput } from './ActionModals';
import { resizeImageToBase64 } from '../utils/imageUpload';
import { uploadAvatar } from '../services/api';
import { getAncestorTree, calculateKinship } from '../utils/kinshipCalculator';
import { SuggestEditModal } from './SuggestEditModal';

interface ProfilePageProps {
  member: DetailedMember;
  allMembers: DetailedMember[];
  events?: FamilyEvent[];
  myMemberId?: string | null;
  onAddSpouse?: () => void;
  onAddChild?: () => void;
  onAddParent?: () => void;
  onMarkDeceased?: () => void;
  onAddEvent?: () => void;
  onDeleteEvent?: (id: string) => void;
  onSaveEdit?: (data: Partial<DetailedMember>) => Promise<void> | void;
  onDelete?: () => void;
  onSetRootGeneration?: () => void;
  isAdmin?: boolean;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  member,
  allMembers,
  events,
  myMemberId,
  onAddSpouse,
  onAddChild,
  onAddParent,
  onMarkDeceased,
  onAddEvent,
  onDeleteEvent,
  onSaveEdit,
  onDelete,
  onSetRootGeneration,
  isAdmin
}) => {
  // Người đầu tiên của gia phả (không có cha/mẹ trên cây, ở đời nhỏ nhất) — admin được đặt lại là đời thứ mấy
  const minGeneration = allMembers.length > 0 ? Math.min(...allMembers.map(m => m.generation || 1)) : 1;
  const isRootMember = !member.fatherId && !member.motherId && member.generation === minGeneration;
  const memberEvents = (events || []).filter(e => e.memberId === member.id);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const children = allMembers.filter(
    (m) => m.fatherId === member.id || m.motherId === member.id
  );
  const ancestors = useMemo(() => getAncestorTree(member, allMembers), [member, allMembers]);

  const myMember = myMemberId ? allMembers.find(m => m.id === myMemberId) : undefined;
  const relationToMe = useMemo(() => {
    if (!myMember || myMember.id === member.id) return null;
    return calculateKinship(myMember, member, allMembers);
  }, [myMember, member, allMembers]);

  // --- Trạng thái form Sửa hồ sơ ---
  const [name, setName] = useState(member.name);
  const [gender, setGender] = useState(member.gender);
  const [birthDate, setBirthDate] = useState(member.birthDate || '');
  const [career, setCareer] = useState(member.career || '');
  const [academicLevel, setAcademicLevel] = useState(member.academicLevel || '');
  const [biography, setBiography] = useState(member.biography || '');
  const [email, setEmail] = useState(member.email || '');
  const [telegramChatId, setTelegramChatId] = useState(member.telegramChatId || '');
  const [avatarUrl, setAvatarUrl] = useState(member.avatarUrl || '');
  const [birthOrder, setBirthOrder] = useState(member.birthOrder || 1);
  const [relationType, setRelationType] = useState(member.relationType || 'BIOLOGICAL');
  const [isDeceased, setIsDeceased] = useState(member.isDeceased || false);
  const [deathDate, setDeathDate] = useState(member.deathDate || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Đổi người xem hồ sơ thì thoát chế độ sửa và nạp lại dữ liệu form
  useEffect(() => {
    setIsEditing(false);
    setName(member.name);
    setGender(member.gender);
    setBirthDate(member.birthDate || '');
    setCareer(member.career || '');
    setAcademicLevel(member.academicLevel || '');
    setBiography(member.biography || '');
    setEmail(member.email || '');
    setTelegramChatId(member.telegramChatId || '');
    setAvatarUrl(member.avatarUrl || '');
    setBirthOrder(member.birthOrder || 1);
    setRelationType(member.relationType || 'BIOLOGICAL');
    setIsDeceased(member.isDeceased || false);
    setDeathDate(member.deathDate || '');
  }, [member]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingEdit(true);
    try {
      await onSaveEdit?.({
        name, gender, birthDate, career, academicLevel, biography, email, telegramChatId, avatarUrl,
        birthOrder, relationType, isDeceased, deathDate,
      });
      setIsEditing(false);
    } catch {
      // Lỗi đã được báo cho người dùng ở nơi gọi; giữ nguyên form để sửa lại
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const { base64, mimeType } = await resizeImageToBase64(file);
      const { url } = await uploadAvatar(base64, mimeType);
      setAvatarUrl(url);
    } catch (err) {
      alert('Lỗi khi tải ảnh lên: ' + err);
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="flex items-center justify-between gap-2 mb-4 print:hidden">
        <Link
          to="/tree"
          className="inline-flex items-center gap-2 text-sm text-wood-dark hover:text-burgundy font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Quay lại Cây Phả Hệ
        </Link>
        <div className="flex items-center gap-2">
          {!isAdmin && (
            <button
              onClick={() => setIsSuggestOpen(true)}
              className="text-xs border border-wood-dark/30 text-wood-dark hover:bg-wood-dark hover:text-white px-3 py-1.5 rounded-full transition-colors font-medium"
            >
              Đề xuất chỉnh sửa
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="text-xs border border-wood-dark/30 text-wood-dark hover:bg-wood-dark hover:text-white px-3 py-1.5 rounded-full transition-colors font-medium"
          >
            In / Xuất PDF
          </button>
        </div>
      </div>

      <SuggestEditModal isOpen={isSuggestOpen} onClose={() => setIsSuggestOpen(false)} member={member} />

      <div className="bg-white rounded-2xl shadow-xl border border-wood-light/20 overflow-hidden">
        {/* Header Profile */}
        <div className="bg-wood text-white px-6 py-8 flex flex-col items-center gap-3 relative">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-bronze overflow-hidden bg-wood-light flex-shrink-0 z-10 shadow-md">
            {member.avatarUrl ? (
              <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl text-bronze-light">
                {member.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="text-center z-10">
            <h1 className="text-2xl md:text-3xl font-bold text-bronze-light mb-1">
              {member.name} {member.isDeceased && <span className="text-gray-300 text-xl font-normal ml-2">(Đã khuất)</span>}
            </h1>
            <p className="text-base text-orange-100/90 mb-1">
              Đời thứ {member.generation}
              {isAdmin && isRootMember && onSetRootGeneration && (
                <button
                  type="button"
                  onClick={onSetRootGeneration}
                  className="ml-1.5 align-middle text-xs bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-full"
                  title="Đặt người đầu tiên là đời thứ mấy"
                >
                  ✎ Đổi
                </button>
              )}
              {' '}• {member.relationType === 'ADOPTED' ? 'Con nuôi' : member.relationType === 'STEPCHILD' ? 'Con riêng' : 'Con đẻ'} thứ {member.birthOrder}
            </p>
            <p className="text-xs text-orange-100/70 italic">
              {member.birthDate || '?'} - {member.isDeceased ? (member.deathDate || 'Không rõ') : 'Nay'}
            </p>
            {relationToMe && (
              <p className="mt-2 inline-block bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-serif">
                Bạn gọi người này là: <span className="font-bold text-bronze-light">{relationToMe}</span>
              </p>
            )}
            {myMember?.id === member.id && (
              <p className="mt-2 inline-block bg-burgundy/70 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-serif font-bold">
                Đây là bạn
              </p>
            )}
          </div>
        </div>

        {/* Toolbar / Action Buttons */}
        {isAdmin && !isEditing && (
          <div className="bg-[#5c3a21] border-b border-wood-dark px-4 py-3 flex gap-2 flex-wrap justify-center shadow-inner z-10 print:hidden">
            <button onClick={() => setIsEditing(true)} className="bg-white/10 hover:bg-white hover:text-wood-dark text-white px-3 py-1.5 rounded text-[10px] font-serif uppercase tracking-wider transition-colors border border-white/20">
              Sửa hồ sơ
            </button>
            <button onClick={onAddSpouse} className="bg-white/10 hover:bg-white hover:text-wood-dark text-white px-3 py-1.5 rounded text-[10px] font-serif uppercase tracking-wider transition-colors border border-white/20">
              + Phu/Thê
            </button>
            {(!member.fatherId && !member.motherId) && (
              <button onClick={onAddParent} className="bg-white/10 hover:bg-white hover:text-wood-dark text-white px-3 py-1.5 rounded text-[10px] font-serif uppercase tracking-wider transition-colors border border-white/20">
                + Phụ/Mẫu
              </button>
            )}
            <button onClick={onAddChild} className="bg-white/10 hover:bg-white hover:text-wood-dark text-white px-3 py-1.5 rounded text-[10px] font-serif uppercase tracking-wider transition-colors border border-white/20">
              + Hậu duệ
            </button>
            <button onClick={onAddEvent} className="bg-white/10 hover:bg-white hover:text-wood-dark text-white px-3 py-1.5 rounded text-[10px] font-serif uppercase tracking-wider transition-colors border border-white/20">
              + Sự kiện
            </button>
            {!member.isDeceased && (
              <button onClick={onMarkDeceased} className="bg-white/10 hover:bg-white hover:text-wood-dark text-white px-3 py-1.5 rounded text-[10px] font-serif uppercase tracking-wider transition-colors border border-white/20">
                Báo tử
              </button>
            )}
            <button
              onClick={() => {
                if (window.confirm("CẢNH BÁO: Xóa thành viên này sẽ loại bỏ họ (và các liên kết hôn nhân) khỏi phả đồ. Nếu người này có con, những người con sẽ bị tách ra thành nhánh mới. Bạn có chắc chắn muốn xóa?")) {
                  setIsDeleting(true);
                  onDelete?.();
                }
              }}
              disabled={isDeleting}
              className="bg-red-500/20 hover:bg-red-600 hover:text-white text-red-100 px-3 py-1.5 rounded text-[10px] font-serif uppercase tracking-wider transition-colors border border-red-500/30 disabled:opacity-50"
            >
              {isDeleting ? 'Đang xóa...' : 'Xóa'}
            </button>
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="p-5 md:p-8 space-y-5">
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-bronze/40 bg-wood-light flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl text-wood/40">
                    {name.charAt(0)}
                  </div>
                )}
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <label className="text-sm text-burgundy hover:text-burgundy-dark underline cursor-pointer font-medium">
                Đổi ảnh đại diện
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isUploadingAvatar}
                  onChange={handleAvatarFileChange}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <label className="block text-sm font-medium text-wood-dark mb-1">Họ tên</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-wood-dark mb-1">Giới tính</label>
                <select value={gender} onChange={e => setGender(e.target.value as 'male' | 'female')} className="w-full border rounded p-2 outline-none">
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                </select>
              </div>

              <DateWithCalendarInput label="Ngày/Năm sinh" value={birthDate} onChange={setBirthDate} placeholder="VD: 1990 hoặc 01/01/1990" />
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={isDeceased} onChange={e => setIsDeceased(e.target.checked)} className="rounded text-burgundy focus:ring-burgundy" />
                  <span className="text-sm font-medium text-wood-dark">Đã khuất</span>
                </label>
              </div>
              {isDeceased && (
                <DateWithCalendarInput label="Ngày/Năm mất" value={deathDate} onChange={setDeathDate} placeholder="VD: 2020" />
              )}

              <div>
                <label className="block text-sm font-medium text-wood-dark mb-1">Thứ tự sinh (Anh/Chị/Em)</label>
                <input type="number" min="1" value={birthOrder} onChange={e => setBirthOrder(parseInt(e.target.value) || 1)} className="w-full border rounded p-2 focus:border-bronze outline-none" placeholder="VD: 1 (Trưởng), 2 (Thứ)" />
              </div>
              <div>
                <label className="block text-sm font-medium text-wood-dark mb-1">Loại quan hệ</label>
                <select value={relationType} onChange={e => setRelationType(e.target.value as 'BIOLOGICAL' | 'ADOPTED' | 'STEPCHILD')} className="w-full border rounded p-2 outline-none">
                  <option value="BIOLOGICAL">Con đẻ</option>
                  <option value="ADOPTED">Con nuôi</option>
                  <option value="STEPCHILD">Con riêng</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-wood-dark mb-1">Học vấn/Học vị</label>
                <input type="text" value={academicLevel} onChange={e => setAcademicLevel(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" placeholder="VD: Cử nhân, Tiến sĩ" />
              </div>
              <div>
                <label className="block text-sm font-medium text-wood-dark mb-1">Nghề nghiệp/Chức vụ</label>
                <input type="text" value={career} onChange={e => setCareer(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" placeholder="VD: Kỹ sư phần mềm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-wood-dark mb-1">Email liên hệ (tùy chọn)</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" placeholder="VD: nguoidung@gmail.com" />
                <p className="text-xs text-gray-500 mt-1">Dùng để gửi email nhắc lịch giỗ/sinh nhật tự động.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-wood-dark mb-1">Telegram Chat ID (tùy chọn)</label>
                <input type="text" value={telegramChatId} onChange={e => setTelegramChatId(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" placeholder="VD: 123456789" />
                <p className="text-xs text-gray-500 mt-1">Thay thế/bổ sung cho email để nhận nhắc lịch qua Telegram (cần Admin cấu hình Bot Token trong backend).</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-wood-dark mb-1">Tiểu sử</label>
                <textarea value={biography} onChange={e => setBiography(e.target.value)} rows={5} className="w-full border rounded p-2 focus:border-bronze outline-none" placeholder="Ghi chú thêm về thành viên..."></textarea>
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-wood-light/10">
              <button type="submit" disabled={isSubmittingEdit} className="bg-burgundy hover:bg-burgundy-dark text-white px-6 py-2 rounded font-medium transition-colors disabled:opacity-50">
                {isSubmittingEdit ? 'Đang lưu...' : 'Lưu Thay Đổi'}
              </button>
              <button type="button" onClick={() => setIsEditing(false)} disabled={isSubmittingEdit} className="bg-gray-100 hover:bg-gray-200 text-wood-dark px-6 py-2 rounded font-medium transition-colors disabled:opacity-50">
                Hủy
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 md:p-8 flex flex-col gap-6 flex-1">
            {/* Phần: Tiểu sử */}
            <div className="space-y-4">
              <section>
                <h2 className="text-lg text-burgundy border-b-2 border-bronze/30 pb-1.5 mb-3 font-serif font-bold">
                  Tiểu sử & Sự nghiệp
                </h2>
                {member.academicLevel && (
                  <p className="mb-1 text-sm"><span className="font-semibold text-wood">Học vị:</span> {member.academicLevel}</p>
                )}
                {member.career && (
                  <p className="mb-1 text-sm"><span className="font-semibold text-wood">Sự nghiệp:</span> {member.career}</p>
                )}
                {member.email && (
                  <p className="mb-3 text-sm"><span className="font-semibold text-wood">Email:</span> {member.email}</p>
                )}
                <div className="prose prose-sm prose-wood max-w-none text-gray-700 leading-relaxed font-serif">
                  <p>{member.biography || 'Đang cập nhật tiểu sử...'}</p>
                </div>
              </section>

              {member.achievements && member.achievements.length > 0 && (
                <section>
                  <h2 className="text-lg text-burgundy border-b-2 border-bronze/30 pb-1.5 mb-3 font-serif font-bold">
                    Đóng góp & Thành tích
                  </h2>
                  <ul className="list-disc pl-5 space-y-1.5 text-sm text-gray-700 font-serif">
                    {member.achievements.map((ach, idx) => (
                      <li key={idx}>{ach}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Phần: Quan hệ gia đình */}
            <div className="bg-orange-50/50 p-4 md:p-5 rounded-lg border border-wood-light/10 space-y-4 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
              <section>
                <h3 className="text-base text-wood font-semibold mb-2 flex items-center gap-2 font-serif">
                  <span className="w-1.5 h-4 bg-burgundy rounded-full block"></span> Tổ Tiên
                </h3>
                {ancestors.length > 0 ? (
                  <div className="space-y-1.5 text-sm text-gray-700">
                    {ancestors.map(a => (
                      <p key={a.member.id}>
                        {a.label}: <span className="font-medium text-wood-dark">{a.member.name}</span>
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic font-serif">Chưa cập nhật</p>
                )}
              </section>

              <section>
                <h3 className="text-base text-wood font-semibold mb-2 flex items-center gap-2 font-serif">
                  <span className="w-1.5 h-4 bg-bronze rounded-full block"></span> Phối ngẫu
                </h3>
                {member.spouses && member.spouses.length > 0 ? (
                  <ul className="space-y-2 text-sm text-gray-700">
                    {member.spouses.map(spouse => {
                      const spouseData = allMembers.find(m => m.id === spouse.id);
                      return (
                        <li key={spouse.id} className="flex flex-col">
                          <span className="font-medium text-wood-dark">{spouseData?.name || 'Không rõ'}</span>
                          <span className="text-xs opacity-70">
                            {spouse.isPrimary ? 'Chính thất' : `Thứ thất (Vợ/Chồng thứ ${spouse.order})`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 italic font-serif">Chưa cập nhật</p>
                )}
              </section>

              <section>
                <h3 className="text-base text-wood font-semibold mb-2 flex items-center gap-2 font-serif">
                  <span className="w-1.5 h-4 bg-wood-light rounded-full block"></span> Hậu duệ ({children.length})
                </h3>
                {children.length > 0 ? (
                  <ul className="space-y-2 text-sm text-gray-700 list-disc pl-4 font-serif">
                    {children.sort((a, b) => a.birthOrder - b.birthOrder).map(child => (
                      <li key={child.id}>
                        <span className="font-medium text-wood-dark">{child.name}</span>
                        <span className="text-xs opacity-70 ml-1">
                          {child.gender === 'male' ? '(Nam)' : '(Nữ)'}
                          {child.relationType === 'ADOPTED' ? ' - Con nuôi' : child.relationType === 'STEPCHILD' ? ' - Con riêng' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 italic font-serif">Chưa cập nhật</p>
                )}
              </section>

              {memberEvents.length > 0 && (
                <section>
                  <h3 className="text-base text-wood font-semibold mb-2 flex items-center gap-2 font-serif">
                    <span className="w-1.5 h-4 bg-burgundy rounded-full block"></span> Sự kiện khác
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    {memberEvents.map(ev => (
                      <li key={ev.id} className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-medium text-wood-dark">{ev.title}</span>
                          <span className="text-xs opacity-70 ml-1">({ev.day}/{ev.month}{ev.year ? '/' + ev.year : ''})</span>
                          {ev.note && <p className="text-xs text-gray-500 italic">{ev.note}</p>}
                        </div>
                        {isAdmin && (
                          <button onClick={() => onDeleteEvent?.(ev.id)} className="text-gray-400 hover:text-red-500 text-sm flex-shrink-0" title="Xóa sự kiện">
                            &times;
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
