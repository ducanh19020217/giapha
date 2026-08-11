import React, { useState, useEffect } from 'react';
import { DetailedMember } from '../types/member';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-wood text-white px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-serif">{title}</h3>
          <button onClick={onClose} className="text-white hover:text-orange-200 font-bold">&times;</button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- MODAL THÊM VỢ/CHỒNG ---
export const AddSpouseModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, isPrimary: boolean) => Promise<void> | void;
  targetMember: DetailedMember;
}> = ({ isOpen, onClose, onSave, targetMember }) => {
  const [name, setName] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave(name, isPrimary);
      setName('');
      setIsPrimary(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Kết hôn: ${targetMember.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-wood-dark mb-1">Họ tên Phối ngẫu</label>
          <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border rounded p-2 focus:border-bronze focus:ring-1 focus:ring-bronze outline-none" placeholder="Ví dụ: Trần Thị B" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="isPrimary" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} className="rounded text-burgundy focus:ring-burgundy" />
          <label htmlFor="isPrimary" className="text-sm text-gray-700">Là Chính thất (Vợ/Chồng cả)</label>
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full bg-burgundy hover:bg-burgundy-dark text-white py-2 rounded font-medium transition-colors disabled:opacity-50">
          {isSubmitting ? 'Đang xử lý...' : 'Lưu Thông Tin'}
        </button>
      </form>
    </Modal>
  );
};

// --- MODAL THÊM CON ---
export const AddChildModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, gender: 'male'|'female', otherParentId: string | null, relationType: 'BIOLOGICAL' | 'ADOPTED' | 'STEPCHILD', birthOrder: number) => Promise<void> | void;
  targetMember: DetailedMember;
  allMembers: DetailedMember[];
}> = ({ isOpen, onClose, onSave, targetMember, allMembers }) => {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male'|'female'>('male');
  const [otherParentId, setOtherParentId] = useState<string>('');
  const [relationType, setRelationType] = useState<'BIOLOGICAL' | 'ADOPTED' | 'STEPCHILD'>('BIOLOGICAL');
  const [birthOrder, setBirthOrder] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const spousesData = targetMember.spouses?.map(s => allMembers.find(m => m.id === s.id)).filter(Boolean) as DetailedMember[];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave(name, gender, otherParentId || null, relationType, birthOrder);
      setName('');
      setGender('male');
      setOtherParentId('');
      setRelationType('BIOLOGICAL');
      setBirthOrder(1);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Thêm Con cho ${targetMember.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-wood-dark mb-1">Họ tên Con</label>
          <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" placeholder="Tên đứa bé" />
        </div>
        <div>
          <label className="block text-sm font-medium text-wood-dark mb-1">Giới tính</label>
          <select value={gender} onChange={e => setGender(e.target.value as 'male'|'female')} className="w-full border rounded p-2 outline-none">
            <option value="male">Con trai</option>
            <option value="female">Con gái</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-wood-dark mb-1">Thứ tự sinh</label>
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
        {spousesData && spousesData.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-wood-dark mb-1">
              {relationType === 'STEPCHILD' ? 'Con riêng của ai?' : 'Người Mẹ/Cha kia là ai?'}
            </label>
            <select value={otherParentId} onChange={e => setOtherParentId(e.target.value)} className="w-full border rounded p-2 outline-none">
              <option value="">Không rõ / Khác</option>
              <option value={targetMember.id}>Là con riêng của {targetMember.name}</option>
              {spousesData.map(s => (
                <option key={s.id} value={s.id}>
                  {relationType === 'STEPCHILD' ? `Là con riêng của ${s.name}` : s.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" disabled={isSubmitting} className="w-full bg-wood hover:bg-wood-dark text-white py-2 rounded font-medium transition-colors disabled:opacity-50">
          {isSubmitting ? 'Đang xử lý...' : 'Tạo Hồ Sơ Con'}
        </button>
      </form>
    </Modal>
  );
};

// --- MODAL BÁO TỬ ---
export const MarkDeceasedModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (deathDate: string) => Promise<void> | void;
  targetMember: DetailedMember;
}> = ({ isOpen, onClose, onSave, targetMember }) => {
  const [deathDate, setDeathDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(deathDate);
      setDeathDate('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Báo Tử: ${targetMember.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600 mb-2">Đánh dấu thành viên này đã qua đời.</p>
        <div>
          <label className="block text-sm font-medium text-wood-dark mb-1">Năm mất / Ngày mất (Tuỳ chọn)</label>
          <input type="text" value={deathDate} onChange={e => setDeathDate(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" placeholder="Ví dụ: 2024 hoặc 15/08/2024" />
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full bg-gray-800 hover:bg-black text-white py-2 rounded font-medium transition-colors disabled:opacity-50">
          {isSubmitting ? 'Đang xử lý...' : 'Xác nhận Đã mất'}
        </button>
      </form>
    </Modal>
  );
};

// --- MODAL THÊM CỤ TỔ ---
export const AddRootModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, gender: 'male'|'female') => Promise<void> | void;
}> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male'|'female'>('male');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave(name, gender);
      setName('');
      setGender('male');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm Thành Viên Đầu Tiên (Cụ Tổ)">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-wood-dark mb-1">Họ tên Cụ Tổ</label>
          <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" placeholder="Ví dụ: Nguyễn Văn A" />
        </div>
        <div>
          <label className="block text-sm font-medium text-wood-dark mb-1">Giới tính</label>
          <select value={gender} onChange={e => setGender(e.target.value as 'male'|'female')} className="w-full border rounded p-2 outline-none">
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
          </select>
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full bg-burgundy hover:bg-burgundy-dark text-white py-2 rounded font-medium transition-colors disabled:opacity-50">
          {isSubmitting ? 'Đang xử lý...' : 'Khởi tạo Gia phả'}
        </button>
      </form>
    </Modal>
  );
};

// --- MODAL THÊM TỔ TIÊN (PHỤ/MẪU) ---
export const AddParentModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, gender: 'male'|'female', birthDate: string, isDeceased: boolean) => Promise<void> | void;
  targetMember: DetailedMember;
}> = ({ isOpen, onClose, onSave, targetMember }) => {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male'|'female'>('male');
  const [birthDate, setBirthDate] = useState('');
  const [isDeceased, setIsDeceased] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave(name, gender, birthDate, isDeceased);
      setName('');
      setGender('male');
      setBirthDate('');
      setIsDeceased(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Thêm Phụ/Mẫu cho ${targetMember.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600 bg-orange-50 p-2 rounded">
          <strong>Lưu ý:</strong> Nếu thêm Phụ/Mẫu cho Cụ Tổ (Đời 1), toàn bộ các thế hệ hiện tại sẽ tự động lùi xuống một đời để nhường vị trí Đời 1 cho Tổ Tiên mới.
        </p>
        <div>
          <label className="block text-sm font-medium text-wood-dark mb-1">Họ tên Tổ Tiên</label>
          <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" placeholder="Ví dụ: Nguyễn Văn A" />
        </div>
        <div>
          <label className="block text-sm font-medium text-wood-dark mb-1">Giới tính</label>
          <select value={gender} onChange={e => setGender(e.target.value as 'male'|'female')} className="w-full border rounded p-2 outline-none">
            <option value="male">Nam (Phụ thân)</option>
            <option value="female">Nữ (Mẫu thân)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-wood-dark mb-1">Ngày/Năm sinh (tùy chọn)</label>
          <input type="text" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" placeholder="VD: 1890 hoặc 01/01/1890" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="isDeceased" checked={isDeceased} onChange={e => setIsDeceased(e.target.checked)} className="rounded text-burgundy focus:ring-burgundy" />
          <label htmlFor="isDeceased" className="text-sm text-gray-700">Đã khuất</label>
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full bg-burgundy hover:bg-burgundy-dark text-white py-2 rounded font-medium transition-colors disabled:opacity-50">
          {isSubmitting ? 'Đang xử lý...' : 'Lưu Thông Tin'}
        </button>
      </form>
    </Modal>
  );
};

// --- MODAL SỬA THÔNG TIN ---
export const EditMemberModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<DetailedMember>) => Promise<void> | void;
  targetMember: DetailedMember;
}> = ({ isOpen, onClose, onSave, targetMember }) => {
  const [name, setName] = useState(targetMember.name);
  const [gender, setGender] = useState(targetMember.gender);
  const [birthDate, setBirthDate] = useState(targetMember.birthDate || '');
  const [career, setCareer] = useState(targetMember.career || '');
  const [academicLevel, setAcademicLevel] = useState(targetMember.academicLevel || '');
  const [biography, setBiography] = useState(targetMember.biography || '');
  const [birthOrder, setBirthOrder] = useState(targetMember.birthOrder || 1);
  const [relationType, setRelationType] = useState(targetMember.relationType || 'BIOLOGICAL');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setName(targetMember.name);
    setGender(targetMember.gender);
    setBirthDate(targetMember.birthDate || '');
    setCareer(targetMember.career || '');
    setAcademicLevel(targetMember.academicLevel || '');
    setBiography(targetMember.biography || '');
    setBirthOrder(targetMember.birthOrder || 1);
    setRelationType(targetMember.relationType || 'BIOLOGICAL');
  }, [targetMember]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave({
        name,
        gender,
        birthDate,
        career,
        academicLevel,
        biography,
        birthOrder,
        relationType,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Sửa thông tin: ${targetMember.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-wood-dark mb-1">Họ tên</label>
          <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-wood-dark mb-1">Giới tính</label>
          <select value={gender} onChange={e => setGender(e.target.value as 'male'|'female')} className="w-full border rounded p-2 outline-none">
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-wood-dark mb-1">Ngày/Năm sinh</label>
          <input type="text" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" placeholder="VD: 1990 hoặc 01/01/1990" />
        </div>
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
          <label className="block text-sm font-medium text-wood-dark mb-1">Tiểu sử</label>
          <textarea value={biography} onChange={e => setBiography(e.target.value)} rows={3} className="w-full border rounded p-2 focus:border-bronze outline-none" placeholder="Ghi chú thêm về thành viên..."></textarea>
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full bg-burgundy hover:bg-burgundy-dark text-white py-2 rounded font-medium transition-colors disabled:opacity-50">
          {isSubmitting ? 'Đang xử lý...' : 'Lưu Thay Đổi'}
        </button>
      </form>
    </Modal>
  );
};

