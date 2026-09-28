import { DetailedMember } from '../types/member';

export interface GenerationCount {
  generation: number;
  count: number;
}

export interface FamilyStats {
  totalMembers: number;
  totalGenerations: number;
  aliveCount: number;
  deceasedCount: number;
  malePercent: number;
  femalePercent: number;
  maleCount: number;
  femaleCount: number;
  averageLifespan: number | null; // Tuổi thọ trung bình của người đã khuất có đủ dữ liệu năm sinh/năm mất
  byGeneration: GenerationCount[];
}

// Cố lấy ra năm (4 chữ số) từ 1 chuỗi ngày dạng tự do (VD: "12/03/1990", "1990", "1990 (Âm lịch)")
export function extractYear(dateString?: string | null): number | null {
  if (!dateString) return null;
  const match = String(dateString).match(/(\d{4})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  if (year < 1800 || year > new Date().getFullYear() + 1) return null;
  return year;
}

export function computeFamilyStats(members: DetailedMember[]): FamilyStats {
  const totalMembers = members.length;
  const totalGenerations = totalMembers > 0 ? Math.max(...members.map(m => m.generation || 1)) : 0;

  const aliveCount = members.filter(m => !m.isDeceased).length;
  const deceasedCount = totalMembers - aliveCount;

  const maleCount = members.filter(m => m.gender === 'male').length;
  const femaleCount = members.filter(m => m.gender === 'female').length;
  const malePercent = totalMembers > 0 ? Math.round((maleCount / totalMembers) * 100) : 0;
  const femalePercent = totalMembers > 0 ? 100 - malePercent : 0;

  const lifespans: number[] = [];
  members.forEach(m => {
    if (!m.isDeceased) return;
    const birthYear = extractYear(m.birthDate);
    const deathYear = extractYear(m.deathDate);
    if (birthYear && deathYear && deathYear >= birthYear) {
      lifespans.push(deathYear - birthYear);
    }
  });
  const averageLifespan = lifespans.length > 0
    ? Math.round(lifespans.reduce((a, b) => a + b, 0) / lifespans.length)
    : null;

  const byGenerationMap = new Map<number, number>();
  members.forEach(m => {
    const gen = m.generation || 1;
    byGenerationMap.set(gen, (byGenerationMap.get(gen) || 0) + 1);
  });
  const byGeneration: GenerationCount[] = Array.from(byGenerationMap.entries())
    .map(([generation, count]) => ({ generation, count }))
    .sort((a, b) => a.generation - b.generation);

  return {
    totalMembers, totalGenerations, aliveCount, deceasedCount,
    malePercent, femalePercent, maleCount, femaleCount,
    averageLifespan, byGeneration
  };
}
