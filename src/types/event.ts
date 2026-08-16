export interface FamilyEvent {
  id: string;
  title: string;
  day: number;
  month: number;
  year?: number | null;
  memberId?: string;
  note?: string;
}
