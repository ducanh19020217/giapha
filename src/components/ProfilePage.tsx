import React from 'react';
import { DetailedMember } from '../types/member';

interface ProfilePageProps {
  member: DetailedMember;
  allMembers: DetailedMember[];
  onAddSpouse?: () => void;
  onAddChild?: () => void;
  onAddParent?: () => void;
  onMarkDeceased?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isAdmin?: boolean;
  onClose?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ 
  member, 
  allMembers,
  onAddSpouse,
  onAddChild,
  onAddParent,
  onMarkDeceased,
  onEdit,
  onDelete,
  isAdmin,
  onClose
}) => {
  // Trạng thái cho Confirmation Modal xóa
  const [isDeleting, setIsDeleting] = React.useState(false);
  // Lọc ra danh sách con cái
  const children = allMembers.filter(
    (m) => m.fatherId === member.id || m.motherId === member.id
  );

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 z-40 transition-opacity" 
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl overflow-y-auto z-50 flex flex-col border-l border-wood-light/20 animate-slide-in-right">
        
        {/* Close button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-20 text-white hover:text-wood-light/80 bg-black/20 hover:bg-black/40 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

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
              Đời thứ {member.generation} • {member.relationType === 'ADOPTED' ? 'Con nuôi' : member.relationType === 'STEPCHILD' ? 'Con riêng' : 'Con đẻ'} thứ {member.birthOrder}
            </p>
            <p className="text-xs text-orange-100/70 italic">
              {member.birthDate || '?'} - {member.isDeceased ? (member.deathDate || 'Không rõ') : 'Nay'}
            </p>
          </div>
        </div>

        {/* Toolbar / Action Buttons */}
        {isAdmin && (
          <div className="bg-[#5c3a21] border-b border-wood-dark px-4 py-3 flex gap-2 flex-wrap justify-center shadow-inner z-10">
            <button onClick={onEdit} className="bg-white/10 hover:bg-white hover:text-wood-dark text-white px-3 py-1.5 rounded text-[10px] font-serif uppercase tracking-wider transition-colors border border-white/20">
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

      <div className="p-5 md:p-6 flex flex-col gap-6 flex-1">
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
              <p className="mb-3 text-sm"><span className="font-semibold text-wood">Sự nghiệp:</span> {member.career}</p>
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
        <div className="bg-orange-50/50 p-4 rounded-lg border border-wood-light/10 space-y-4">
          <section>
            <h3 className="text-base text-wood font-semibold mb-2 flex items-center gap-2 font-serif">
              <span className="w-1.5 h-4 bg-burgundy rounded-full block"></span> Thân sinh
            </h3>
            <div className="space-y-1.5 text-sm text-gray-700">
              <p>Cha: <span className="font-medium text-wood-dark">{allMembers.find(m => m.id === member.fatherId)?.name || 'Không rõ'}</span></p>
              <p>Mẹ: <span className="font-medium text-wood-dark">{allMembers.find(m => m.id === member.motherId)?.name || 'Không rõ'}</span></p>
            </div>
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
        </div>
      </div>
    </div>
    </>
  );
};
