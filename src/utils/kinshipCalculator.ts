import { DetailedMember } from '../types/member';

export interface AncestorEntry {
  member: DetailedMember;
  label: string; // Cha, Mẹ, Ông Nội, Bà Nội, Ông Ngoại, Bà Ngoại, Cụ Ông, Cụ Bà...
  generationsUp: number; // 1 = cha/mẹ, 2 = ông/bà, 3+ = cụ...
}

function ancestorLabel(generationsUp: number, gender: 'male' | 'female', isPaternalLine: boolean | null): string {
  if (generationsUp === 1) return gender === 'male' ? 'Cha' : 'Mẹ';
  if (generationsUp === 2) {
    if (isPaternalLine === true) return gender === 'male' ? 'Ông Nội' : 'Bà Nội';
    if (isPaternalLine === false) return gender === 'male' ? 'Ông Ngoại' : 'Bà Ngoại';
    return gender === 'male' ? 'Ông' : 'Bà';
  }
  return gender === 'male' ? 'Cụ Ông' : 'Cụ Bà'; // Từ đời thứ 3 trở lên gộp chung thành "Cụ" (khớp quy ước ở calculateCoreKinship)
}

/**
 * Trả về TẤT CẢ tổ tiên (đi theo cả nhánh Nội lẫn Ngoại) của 1 thành viên,
 * lên tối đa `maxGenerations` đời. Dùng để hiển thị (VD: mục "Tổ Tiên" trong
 * hồ sơ), khác với getAncestors nội bộ của calculateCoreKinship (chỉ đi theo
 * 1 nhánh để tìm tổ tiên chung phục vụ tính xưng hô).
 */
export function getAncestorTree(
  member: DetailedMember,
  allMembers: DetailedMember[],
  maxGenerations = 5
): AncestorEntry[] {
  const memberMap = new Map<string, DetailedMember>();
  allMembers.forEach(m => memberMap.set(m.id, m));

  const results: AncestorEntry[] = [];

  const visit = (
    current: DetailedMember,
    depth: number,
    isPaternalLine: boolean | null
  ) => {
    if (depth >= maxGenerations) return;
    const nextDepth = depth + 1;

    const father = current.fatherId ? memberMap.get(current.fatherId) : undefined;
    if (father) {
      const line = depth === 0 ? true : isPaternalLine;
      results.push({ member: father, label: ancestorLabel(nextDepth, 'male', line), generationsUp: nextDepth });
      visit(father, nextDepth, line);
    }

    const mother = current.motherId ? memberMap.get(current.motherId) : undefined;
    if (mother) {
      const line = depth === 0 ? false : isPaternalLine;
      results.push({ member: mother, label: ancestorLabel(nextDepth, 'female', line), generationsUp: nextDepth });
      visit(mother, nextDepth, line);
    }
  };

  visit(member, 0, null);
  return results;
}

/**
 * Thuật toán tính toán xưng hô dòng họ (Kinship Calculator).
 * Quy tắc:
 * 1. Nếu diff = 0 (cùng thế hệ): 
 *    - Dựa vào branch (nhánh) và birthOrder của tổ tiên chung.
 *    - Gọi là Anh/Chị nếu nhánh của A là anh/chị của nhánh B.
 * 2. Nếu diff > 0:
 *    - Dựa vào chênh lệch thế hệ: 1 (Chú/Bác/Cô/Dì/Cậu), 2 (Ông/Bà), 3 (Cụ), 4 (Kỵ).
 *    - Xác định Nội/Ngoại dựa vào đường đi từ A lên tổ tiên chung.
 */
export const calculateCoreKinship = (
  personA: DetailedMember,
  personB: DetailedMember,
  allMembers: DetailedMember[]
): string => {
  if (personA.id === personB.id) return 'Bản thân';

  const memberMap = new Map<string, DetailedMember>();
  allMembers.forEach(m => memberMap.set(m.id, m));

  // Tìm TẤT CẢ tổ tiên theo cả nhánh cha lẫn nhánh mẹ (duyệt theo từng đời, gần trước xa sau).
  // Không được chỉ đi theo cha: VD con của bác gái có cha là người lấy vào họ (không có tổ tiên
  // trên cây), phải đi theo mẹ mới gặp được ông bà chung.
  // isMaternal = bước đầu tiên đi qua mẹ (dùng để phân biệt Nội/Ngoại, Chú/Cậu...).
  const getAncestors = (member: DetailedMember): { id: string, path: string[], isMaternal: boolean }[] => {
    const ancestors: { id: string, path: string[], isMaternal: boolean }[] = [];
    const visited = new Set<string>([member.id]);
    let frontier: { member: DetailedMember, path: string[], isMaternal: boolean | null }[] = [{ member, path: [member.id], isMaternal: null }];

    while (frontier.length > 0) {
      const next: typeof frontier = [];
      frontier.forEach(({ member: curr, path, isMaternal }) => {
        const parents: Array<[string | undefined, boolean]> = [[curr.fatherId, false], [curr.motherId, true]];
        parents.forEach(([parentId, viaMother]) => {
          if (!parentId || visited.has(parentId)) return;
          const parent = memberMap.get(parentId);
          if (!parent) return;
          visited.add(parentId);
          const entry = { id: parentId, path: [...path, parentId], isMaternal: isMaternal ?? viaMother };
          ancestors.push(entry);
          next.push({ member: parent, path: entry.path, isMaternal: entry.isMaternal });
        });
      });
      frontier = next;
    }
    return ancestors;
  };

  const ancestorsA = getAncestors(personA);
  const ancestorsB = getAncestors(personB);

  // Kiểm tra quan hệ trực hệ TRƯỚC khi tìm tổ tiên chung. Bắt buộc phải làm trước,
  // vì nếu B là tổ tiên trực tiếp của A (VD: cha) và B lại có tổ tiên riêng (VD: ông),
  // thì tổ tiên đó của B cũng nằm trong đường tổ tiên của A (qua chính B) — vòng lặp
  // tìm tổ tiên chung bên dưới sẽ "tìm thấy" tổ tiên chung giả này và tính nhầm B
  // thành quan hệ bàng hệ (VD: Chú) thay vì trực hệ (Cha).
  const entryB = ancestorsA.find(a => a.id === personB.id);
  if (entryB) {
    const diff = entryB.path.length - 1;
    if (diff === 1) return personB.gender === 'male' ? 'Cha' : 'Mẹ';
    if (diff === 2) {
      const side = entryB.isMaternal ? 'Ngoại' : 'Nội';
      return personB.gender === 'male' ? `Ông ${side}` : `Bà ${side}`;
    }
    if (diff === 3) return personB.gender === 'male' ? 'Cụ Ông' : 'Cụ Bà';
    return 'Tổ Tiên';
  }

  const entryA = ancestorsB.find(b => b.id === personA.id);
  if (entryA) {
    const diff = entryA.path.length - 1;
    if (diff === 1) return personB.gender === 'male' ? 'Con trai' : 'Con gái';
    if (diff === 2) return personB.gender === 'male' ? 'Cháu trai' : 'Cháu gái';
    if (diff === 3) return personB.gender === 'male' ? 'Chắt trai' : 'Chắt gái';
    return 'Hậu duệ';
  }

  // Tìm tổ tiên chung gần nhất (LCA) cho quan hệ bàng hệ (anh/chị/em, chú/bác/cô/dì...)
  let lcaId: string | null = null;
  let pathA: string[] = [];
  let pathB: string[] = [];
  let isMaternalA = false;

  for (const a of ancestorsA) {
    const matchB = ancestorsB.find(b => b.id === a.id);
    if (matchB) {
      lcaId = a.id;
      pathA = a.path;
      pathB = matchB.path;
      isMaternalA = a.isMaternal;
      break;
    }
  }

  if (!lcaId) {
    // Nếu có spouse (vợ/chồng)
    if (personA.spouses?.find(s => s.id === personB.id)) {
      return personB.gender === 'male' ? 'Chồng' : 'Vợ';
    }

    return 'Không có quan hệ họ hàng gần';
  }

  // Nếu có tổ tiên chung (Quan hệ bàng hệ)
  const genDiff = personA.generation - personB.generation;
  
  // Nút con trực tiếp của LCA trên đường đi của A và B để so sánh vai vế
  const childOfLcaA = memberMap.get(pathA[pathA.length - 2]); 
  const childOfLcaB = memberMap.get(pathB[pathB.length - 2]);

  const isBBranchSenior = childOfLcaA && childOfLcaB && childOfLcaB.birthOrder < childOfLcaA.birthOrder;

  if (genDiff === 0) {
    if (isBBranchSenior) {
      return personB.gender === 'male' ? 'Anh' : 'Chị';
    } else {
      return personB.gender === 'male' ? 'Em trai' : 'Em gái';
    }
  }

  if (genDiff > 0) {
    // B thuộc thế hệ trên A (A gọi B là gì)
    if (genDiff === 1) {
      if (isMaternalA) {
        return personB.gender === 'male' ? 'Cậu' : 'Dì';
      } else {
        if (isBBranchSenior) {
          return personB.gender === 'male' ? 'Bác trai' : 'Bác gái';
        } else {
          return personB.gender === 'male' ? 'Chú' : 'Cô';
        }
      }
    }
    if (genDiff === 2) {
      // B là anh/chị/em của ông hoặc bà của A (childOfLcaA chính là ông/bà đó).
      // Anh chị em của ông: Ông Bác / Ông Chú / Bà Cô (chị của ông: Bà Bác).
      // Anh chị em của bà: Ông Bác / Ông Cậu / Bà Bác / Bà Dì.
      const grandparentIsMale = childOfLcaA?.gender === 'male';
      if (personB.gender === 'male') {
        if (isBBranchSenior) return 'Ông Bác';
        return grandparentIsMale ? 'Ông Chú' : 'Ông Cậu';
      }
      if (isBBranchSenior) return 'Bà Bác';
      return grandparentIsMale ? 'Bà Cô' : 'Bà Dì';
    }
    if (genDiff >= 3) {
      return personB.gender === 'male' ? 'Cụ Ông' : 'Cụ Bà';
    }
  } else {
    // B thuộc thế hệ dưới A (A gọi B là Cháu/Chắt...)
    const absDiff = Math.abs(genDiff);
    if (absDiff === 1) {
      return personB.gender === 'male' ? 'Cháu trai' : 'Cháu gái';
    }
    if (absDiff >= 2) {
      return personB.gender === 'male' ? 'Chắt trai' : 'Chắt gái';
    }
  }

  return 'Họ hàng';
};

export const calculateKinship = (
  personA: DetailedMember,
  personB: DetailedMember,
  allMembers: DetailedMember[]
): string => {
  if (personA.id === personB.id) return 'Bản thân';

  // Check direct spouse relation first
  if (personA.spouses?.some(s => s.id === personB.id) || personB.spouses?.some(s => s.id === personA.id)) {
    return personB.gender === 'male' ? 'Chồng' : 'Vợ';
  }

  // Nếu A/B là người "lấy vào họ" thì trả về người máu mủ mà họ kết hôn cùng. Quan hệ vợ/chồng
  // được lưu 2 chiều (cả 2 người đều có nhau trong `spouses`), nên KHÔNG được coi mọi người có
  // vợ/chồng là người lấy vào họ — nếu không, chính người máu mủ (VD: bố, bản thân) sẽ bị tính
  // qua vợ/chồng của họ và ra "Không có quan hệ họ hàng gần". Dùng cùng quy tắc với cây gia phả:
  // người lấy vào họ là người có vợ/chồng đã có cha/mẹ trên cây, hoặc (khi cả 2 đều không có
  // cha/mẹ, VD: cụ tổ) là người đứng sau trong danh sách.
  const hasParents = (m: DetailedMember) => Boolean(m.fatherId || m.motherId);
  const findBloodPartner = (person: DetailedMember): DetailedMember | undefined => {
    if (hasParents(person)) return undefined;
    const personIndex = allMembers.findIndex(m => m.id === person.id);
    return allMembers.find((other, otherIndex) => {
      if (other.id === person.id) return false;
      const isSpouse = other.spouses?.some(s => s.id === person.id) || person.spouses?.some(s => s.id === other.id);
      if (!isSpouse) return false;
      return hasParents(other) || otherIndex < personIndex;
    });
  };

  const partnerA = findBloodPartner(personA);
  const partnerB = findBloodPartner(personB);

  const effA = partnerA || personA;
  const effB = partnerB || personB;

  if (effA.id === effB.id) {
    if (personA.gender === personB.gender) return personA.gender === 'female' ? 'Chị em dâu (cùng chồng)' : 'Anh em cọc chèo (cùng vợ)';
    return 'Vợ chồng';
  }

  // Calculate the core relationship between the blood members
  const coreRelation = calculateCoreKinship(effA, effB, allMembers);

  // If both are blood members, return exactly what was calculated
  if (!partnerA && !partnerB) return coreRelation;

  // Helper to adjust the term if B is a spouse
  const adjustForSpouseB = (relation: string, b: DetailedMember) => {
    if (relation === 'Cha' || relation === 'Mẹ') return b.gender === 'male' ? 'Cha' : 'Mẹ';
    if (relation === 'Anh' && b.gender === 'female') return 'Chị dâu';
    if (relation === 'Anh' && b.gender === 'male') return 'Anh rể';
    if (relation.startsWith('Em ') && b.gender === 'female') return 'Em dâu';
    if (relation.startsWith('Em ') && b.gender === 'male') return 'Em rể';
    if (relation === 'Chú' && b.gender === 'female') return 'Thím';
    if (relation === 'Cậu' && b.gender === 'female') return 'Mợ';
    if (relation === 'Cô' && b.gender === 'male') return 'Chú'; // Chồng của cô (em gái bố) gọi là Chú
    if (relation === 'Dì' && b.gender === 'male') return 'Dượng';
    if (relation === 'Bác trai' && b.gender === 'female') return 'Bác gái';
    if (relation === 'Bác gái' && b.gender === 'male') return 'Bác trai';
    if (relation === 'Ông Chú') return 'Bà Thím';
    if (relation === 'Ông Cậu') return 'Bà Mợ';
    if (relation === 'Bà Cô' || relation === 'Bà Dì') return 'Ông Dượng';
    if (relation.includes('Ông')) return relation.replace('Ông', 'Bà');
    if (relation.includes('Bà')) return relation.replace('Bà', 'Ông');
    if (relation.includes('Cụ Ông')) return 'Cụ Bà';
    if (relation.includes('Cụ Bà')) return 'Cụ Ông';
    if (relation.startsWith('Con ') && b.gender === 'female') return 'Con dâu';
    if (relation.startsWith('Con ') && b.gender === 'male') return 'Con rể';
    if (relation.startsWith('Cháu ') && b.gender === 'female') return 'Cháu dâu';
    if (relation.startsWith('Cháu ') && b.gender === 'male') return 'Cháu rể';
    if (relation.startsWith('Chắt ') && b.gender === 'female') return 'Chắt dâu';
    if (relation.startsWith('Chắt ') && b.gender === 'male') return 'Chắt rể';
    return `${b.gender === 'male' ? 'Người nam' : 'Người nữ'} (vợ/chồng của ${relation})`;
  };

  // Bố/mẹ của vợ/chồng mình: gọi là Bố chồng/Mẹ chồng hoặc Bố vợ/Mẹ vợ
  if (partnerA && (coreRelation === 'Cha' || coreRelation === 'Mẹ')) {
    const side = effA.gender === 'male' ? 'chồng' : 'vợ';
    return `${personB.gender === 'male' ? 'Bố' : 'Mẹ'} ${side}`;
  }

  if (partnerA && partnerB) {
    if (effA.generation === effB.generation) {
      if (coreRelation === 'Anh' || coreRelation === 'Chị') return personB.gender === 'male' ? 'Anh cọc chèo' : 'Chị dâu';
      if (coreRelation.startsWith('Em ')) return personB.gender === 'male' ? 'Em cọc chèo' : 'Em dâu';
    }
    // Cross-generation: Mother-in-law calling Daughter-in-law is the same as Father calling Daughter-in-law
    return adjustForSpouseB(coreRelation, personB);
  }

  if (!partnerA && partnerB) {
    return adjustForSpouseB(coreRelation, personB);
  }

  if (partnerA && !partnerB) {
    const side = effA.gender === 'male' ? 'chồng' : 'vợ';
    if (coreRelation === 'Em gái' && side === 'chồng') return 'Cô (em chồng)';
    if (coreRelation === 'Em trai' && side === 'chồng') return 'Chú (em chồng)';
    if (coreRelation === 'Em gái' && side === 'vợ') return 'Dì (em vợ)';
    if (coreRelation === 'Em trai' && side === 'vợ') return 'Cậu (em vợ)';
    if (coreRelation === 'Anh') return 'Anh ' + side;
    if (coreRelation === 'Chị') return 'Chị ' + side;
    // Don't add suffix for direct descendants
    if (coreRelation.startsWith('Con ') || coreRelation.startsWith('Cháu ') || coreRelation.startsWith('Chắt ')) {
      return coreRelation;
    }
    return `${coreRelation} (bên ${side})`;
  }

  return coreRelation;
};
