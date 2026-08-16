export interface DetailedMember {
  id: string;
  name: string;
  gender: 'male' | 'female';
  birthDate: string;
  isDeceased: boolean;
  deathDate?: string;
  burialPlace?: string;
  avatarUrl?: string;       // Ảnh chân dung
  email?: string;           // Email liên hệ, dùng để gửi nhắc lịch giỗ/sinh nhật
  
  // Thông tin tiểu sử chuyên sâu
  academicLevel?: string;   // Học hàm, học vị (Tiến sĩ, Thạc sĩ...)
  career?: string;          // Sự nghiệp, chức vụ nổi bật
  achievements?: string[];  // Danh sách thành tích, đóng góp cho xã hội & dòng họ
  biography?: string;       // Tiểu sử chi tiết (dạng văn bản dài hoặc Markdown)
  
  // Quan hệ gia đình
  spouses: Array<{ id: string; order: number; isPrimary: boolean }>;
  fatherId?: string;
  motherId?: string;
  relationType?: 'BIOLOGICAL' | 'ADOPTED' | 'STEPCHILD';
  generation: number;       // Thứ tự thế hệ tính từ Cụ Tổ (Cụ Tổ = thế hệ 1)
  birthOrder: number;       // Thứ tự sinh trong gia đình (Con cả là 1, con thứ là 2...)
}

