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
export const calculateKinship = (
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
