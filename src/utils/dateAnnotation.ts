// Quy ước có sẵn trong app: ngày Âm lịch được đánh dấu bằng hậu tố "(Âm lịch)"
// ngay trong chuỗi ngày sinh/ngày mất, ví dụ "15/08/1990 (Âm lịch)".

const LUNAR_SUFFIX_RE = /\s*\(\s*Âm\s*lịch\s*\)\s*/gi;

export function isLunarDateString(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return /\(\s*Âm\s*lịch\s*\)/i.test(dateStr);
}

export function stripLunarAnnotation(dateStr: string): string {
  return dateStr.replace(LUNAR_SUFFIX_RE, ' ').trim();
}

export function withLunarAnnotation(dateStr: string, isLunar: boolean): string {
  const stripped = stripLunarAnnotation(dateStr);
  if (!stripped) return stripped;
  return isLunar ? `${stripped} (Âm lịch)` : stripped;
}
