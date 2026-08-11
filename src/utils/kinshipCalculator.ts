import { DetailedMember } from '../types/member';

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

  // Hàm đệ quy tìm tổ tiên
  const getAncestors = (member: DetailedMember): { id: string, path: string[], isMaternal: boolean }[] => {
    let ancestors: { id: string, path: string[], isMaternal: boolean }[] = [];
    let currentId = member.id;
    let path = [currentId];
    
    // Đơn giản hóa: chỉ lấy nhánh nội (fatherId) để tìm tổ tiên chung cho demo này
    // Trong thực tế cần cả fatherId và motherId. Ở đây ta ưu tiên father.
    let curr = memberMap.get(currentId);
    let isMaternal = false;

    while (curr && (curr.fatherId || curr.motherId)) {
      // Ưu tiên đi theo cha. Nếu không có cha thì đi theo mẹ và đánh dấu là nhánh ngoại
      if (curr.fatherId) {
        currentId = curr.fatherId;
      } else if (curr.motherId) {
        currentId = curr.motherId;
        isMaternal = true;
      } else {
        break;
      }
      
      path.push(currentId);
      ancestors.push({ id: currentId, path: [...path], isMaternal });
      curr = memberMap.get(currentId);
    }
    return ancestors;
  };

  const ancestorsA = getAncestors(personA);
  const ancestorsB = getAncestors(personB);

  // Tìm tổ tiên chung gần nhất (LCA)
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

  // Trường hợp không có tổ tiên chung, hoặc là quan hệ trực hệ
  if (!lcaId) {
    // Kiểm tra trực hệ
    const idxB = ancestorsA.findIndex(a => a.id === personB.id);
    if (idxB !== -1) {
      const diff = idxB + 1;
      if (diff === 1) return personB.gender === 'male' ? 'Cha' : 'Mẹ';
      if (diff === 2) return personB.gender === 'male' ? 'Ông' : 'Bà';
      if (diff === 3) return personB.gender === 'male' ? 'Cụ Ông' : 'Cụ Bà';
      return 'Tổ Tiên';
    }

    const idxA = ancestorsB.findIndex(b => b.id === personA.id);
    if (idxA !== -1) {
      const diff = idxA + 1;
      if (diff === 1) return personB.gender === 'male' ? 'Con trai' : 'Con gái';
      if (diff === 2) return personB.gender === 'male' ? 'Cháu trai' : 'Cháu gái';
      if (diff === 3) return personB.gender === 'male' ? 'Chắt trai' : 'Chắt gái';
      return 'Hậu duệ';
    }

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
      return personB.gender === 'male' ? (isMaternalA ? 'Ông Ngoại' : 'Ông Nội') : (isMaternalA ? 'Bà Ngoại' : 'Bà Nội'); // Bàng hệ thì vẫn gọi là Ông/Bà
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

  // Find if personA or personB are spouses of a blood member
  const partnerA = allMembers.find(m => m.spouses?.some(s => s.id === personA.id));
  const partnerB = allMembers.find(m => m.spouses?.some(s => s.id === personB.id));

  const effA = partnerA || personA;
  const effB = partnerB || personB;

  if (effA.id === effB.id) {
    if (personA.gender === personB.gender) return personA.gender === 'female' ? 'Chị em dâu (cùng chồng)' : 'Anh em cọc chèo (cùng vợ)';
    return 'Vợ chồng';
  }

  // Calculate the core relationship between the blood members
  let coreRelation = calculateCoreKinship(effA, effB, allMembers);

  // If both are blood members, return exactly what was calculated
  if (!partnerA && !partnerB) return coreRelation;

  // Helper to adjust the term if B is a spouse
  const adjustForSpouseB = (relation: string, b: DetailedMember) => {
    if (relation === 'Anh' && b.gender === 'female') return 'Chị dâu';
    if (relation === 'Anh' && b.gender === 'male') return 'Anh rể';
    if (relation.startsWith('Em ') && b.gender === 'female') return 'Em dâu';
    if (relation.startsWith('Em ') && b.gender === 'male') return 'Em rể';
    if (relation === 'Chú' && b.gender === 'female') return 'Thím';
    if (relation === 'Cậu' && b.gender === 'female') return 'Mợ';
    if ((relation === 'Cô' || relation === 'Dì') && b.gender === 'male') return 'Dượng';
    if (relation === 'Bác trai' && b.gender === 'female') return 'Bác gái';
    if (relation === 'Bác gái' && b.gender === 'male') return 'Bác trai';
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
