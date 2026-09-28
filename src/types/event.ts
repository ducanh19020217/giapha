export interface FamilyEvent {
  id: string;
  title: string;
  day: number;
  month: number;
  year?: number | null;
  isLunar?: boolean; // true nếu day/month là ngày Âm lịch (VD: Giỗ Tổ 10/3 Âm lịch)
  memberId?: string;
  note?: string;
  isDeleted?: boolean; // true nếu đã bị xóa (mềm) — chỉ xuất hiện trong dữ liệu "Thùng rác"
}
