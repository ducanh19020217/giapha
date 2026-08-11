import React, { useMemo, useState } from 'react';
import Tree from 'react-d3-tree';
import { DetailedMember } from '../types/member';

const removeVietnameseTones = (str: string) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase();
};

interface FamilyTreeProps {
  members: DetailedMember[];
  onSelectMember: (memberId: string) => void;
  selectedMemberId: string;
  onAddSpouse?: (memberId: string) => void;
  onAddChild?: (memberId: string) => void;
  onMarkDeceased?: (memberId: string) => void;
  onAddRoot?: () => void;
  isAdmin?: boolean;
}

interface TreeNode {
  name: string;
  attributes?: Record<string, any>;
  children?: TreeNode[];
  memberData: DetailedMember;
}

export const FamilyTree: React.FC<FamilyTreeProps> = ({ 
  members, 
  onSelectMember, 
  selectedMemberId,
  onAddSpouse,
  onAddChild,
  onMarkDeceased,
  onAddRoot,
  isAdmin
}) => {
  const [filterLiving, setFilterLiving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const treeData = useMemo(() => {
    const memberMap = new Map<string, TreeNode>();
    
    // Gắn node
    members.forEach(m => {
      // Lấy thông tin vợ/chồng (Spouses)
      const spousesData = m.spouses?.map(s => members.find(mem => mem.id === s.id)).filter(Boolean) || [];

      memberMap.set(m.id, {
        name: m.name,
        attributes: {
          generation: `Đời ${m.generation}`,
          isDeceased: m.isDeceased,
          gender: m.gender,
          avatarUrl: m.avatarUrl,
          spouses: spousesData
        },
        children: [],
        memberData: m
      });
    });

    let rootNodes: TreeNode[] = [];

    // Gắn node con vào node cha (Ưu tiên gắn vào Cha, nếu không có cha thì gắn vào Mẹ)
    members.forEach(m => {
      const node = memberMap.get(m.id)!;
      // Tránh lặp: Vợ/chồng đã được hiển thị ghép vào node của chồng/vợ, nên không cần biến họ thành node gốc nếu họ không có cha mẹ trong họ
      if (m.fatherId && memberMap.has(m.fatherId)) {
        memberMap.get(m.fatherId)!.children!.push(node);
      } else if (m.motherId && memberMap.has(m.motherId)) {
        memberMap.get(m.motherId)!.children!.push(node);
      } else {
        // Resolve who should be the main root node if they are spouses without parents
        const isSpouseMarriedIn = members.some(other => {
          if (!other.spouses?.some(s => s.id === m.id)) return false;
          // If the other person has parents, they are bloodline, so 'm' is married-in
          if (other.fatherId || other.motherId) return true;
          // If neither has parents (root couple), the one created first (appears earlier in array) is the main root
          return members.indexOf(other) < members.indexOf(m);
        });

        if (!isSpouseMarriedIn) {
          rootNodes.push(node); 
        }
      }
    });

    // Sắp xếp
    memberMap.forEach(node => {
      if (node.children) {
        node.children.sort((a, b) => a.memberData.birthOrder - b.memberData.birthOrder);
      }
    });

    const filterTree = (nodes: TreeNode[], query: string): TreeNode[] => {
      if (!query.trim()) return nodes;
      const normalizedQuery = removeVietnameseTones(query);
      
      return nodes.map(node => {
        const clonedNode = { ...node, children: node.children ? [...node.children] : [] };
        
        const isMatch = removeVietnameseTones(clonedNode.name).includes(normalizedQuery) ||
                        (clonedNode.attributes?.spouses || []).some((s: any) => removeVietnameseTones(s.name).includes(normalizedQuery));
                        
        clonedNode.children = filterTree(clonedNode.children, query);
        
        if (isMatch || clonedNode.children.length > 0) {
          return clonedNode;
        }
        return null;
      }).filter(Boolean) as TreeNode[];
    };

    return filterTree(rootNodes, searchQuery);
  }, [members, filterLiving, searchQuery]);

  const renderCustomNodeElement = ({ nodeDatum }: any) => {
    const isSelected = nodeDatum.memberData.id === selectedMemberId;
    const isDeceased = nodeDatum.attributes?.isDeceased;
    const isFilteredOut = filterLiving && isDeceased;
    const spouses = nodeDatum.attributes?.spouses || [];

    // Tính toán chiều rộng và chiều cao node dựa trên trạng thái select
    const nodeWidth = 180 + (spouses.length * 190);
    const nodeHeight = isSelected ? (isAdmin ? 220 : 170) : 170;

    const renderActionButtons = (memberId: string, isDeceased: boolean) => {
      if (!isSelected || !isAdmin) return null;
      return (
        <div className="flex gap-2 justify-center mt-3 border-t border-wood-light/30 pt-2 w-full">
          <button 
            onClick={(e) => { e.stopPropagation(); onAddSpouse?.(memberId); }}
            className="text-[9px] text-wood hover:text-burgundy font-serif uppercase tracking-wider outline-none"
            title="Thêm Phối ngẫu"
          >
            +Phu/Thê
          </button>
          <span className="text-gray-300">|</span>
          <button 
            onClick={(e) => { e.stopPropagation(); onAddChild?.(memberId); }}
            className="text-[9px] text-wood hover:text-burgundy font-serif uppercase tracking-wider outline-none"
            title="Thêm Hậu duệ"
          >
            +Hậu duệ
          </button>
          {!isDeceased && (
            <>
              <span className="text-gray-300">|</span>
              <button 
                onClick={(e) => { e.stopPropagation(); onMarkDeceased?.(memberId); }}
                className="text-[9px] text-wood hover:text-burgundy font-serif uppercase tracking-wider outline-none"
                title="Đánh dấu báo tử"
              >
                Báo tử
              </button>
            </>
          )}
        </div>
      );
    };

    return (
      <g>
        <foreignObject x={-nodeWidth/2} y={-40} width={nodeWidth} height={nodeHeight} style={{ overflow: 'visible' }}>
          <div className="flex gap-2 justify-center items-start h-full w-full px-2">
            
            {/* Thành viên chính */}
            <div 
              style={{ opacity: (filterLiving && isDeceased) ? 0.3 : 1 }}
              onClick={() => onSelectMember(nodeDatum.memberData.id)}
              className={`flex-1 min-w-[160px] p-4 bg-[#Fdfbf7] border border-wood-light/40 cursor-pointer transition-all flex flex-col items-center justify-center relative ${
                isSelected 
                  ? 'shadow-[0_0_15px_rgba(139,90,43,0.3)] border-bronze z-10 scale-[1.02]' 
                  : 'shadow-sm hover:border-bronze/60 hover:shadow-md'
              }`}
              title={nodeDatum.name}
            >
              {/* Decor corners */}
              <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-bronze/40"></div>
              <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-bronze/40"></div>
              <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-bronze/40"></div>
              <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-bronze/40"></div>

              <div className="w-14 h-16 overflow-hidden border border-wood-light/30 mb-3 bg-[#f5f2eb] flex items-center justify-center shadow-inner">
                {nodeDatum.attributes?.avatarUrl ? (
                  <img src={nodeDatum.attributes.avatarUrl} alt={nodeDatum.name} className="w-full h-full object-cover sepia-[30%]" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-8 h-8 text-wood/40">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>
              <div className={`text-sm font-serif font-bold text-center leading-tight mb-1 ${nodeDatum.attributes?.gender === 'male' ? 'text-wood-dark' : 'text-burgundy'}`}>
                {nodeDatum.name}
              </div>
              
              {isDeceased && (
                <div className="text-[10px] italic text-gray-500 font-serif">
                  (Từ trần)
                </div>
              )}
              
              {/* Nút thao tác trực tiếp trên node */}
              {isSelected && renderActionButtons(nodeDatum.memberData.id, isDeceased)}
            </div>

            {/* Các Phối ngẫu (Vợ/Chồng) */}
            {spouses.map((spouse: DetailedMember) => {
              const isSpouseSelected = selectedMemberId === spouse.id;
              return (
                <React.Fragment key={spouse.id}>
                  <div className="w-6 h-px bg-wood-light/50 mt-14"></div> {/* Đường nối */}
                  <div 
                    style={{ opacity: (filterLiving && spouse.isDeceased) ? 0.3 : 1 }}
                    onClick={() => onSelectMember(spouse.id)}
                    className={`flex-1 min-w-[160px] p-4 bg-[#Fdfbf7]/80 border border-wood-light/30 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center relative ${
                      isSpouseSelected 
                        ? 'shadow-[0_0_15px_rgba(139,90,43,0.3)] border-bronze z-10 scale-[1.02] border-solid' 
                        : 'shadow-sm hover:border-bronze/60 hover:shadow-md'
                    }`}
                    title={spouse.name}
                  >
                    <div className="w-14 h-16 overflow-hidden border border-wood-light/30 mb-3 bg-[#f5f2eb] flex items-center justify-center shadow-inner">
                      {spouse.avatarUrl ? (
                        <img src={spouse.avatarUrl} alt={spouse.name} className="w-full h-full object-cover sepia-[30%]" />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-8 h-8 text-wood/40">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </div>

                    <div className="text-[10px] uppercase tracking-widest text-wood-light font-serif mb-1">
                      Phối ngẫu
                    </div>
                    
                    <div className={`text-sm font-serif font-bold text-center leading-tight mb-1 ${spouse.gender === 'male' ? 'text-wood-dark' : 'text-burgundy'}`}>
                      {spouse.name}
                    </div>

                    {spouse.isDeceased && (
                      <div className="text-[10px] italic text-gray-500 font-serif">
                        (Từ trần)
                      </div>
                    )}
                    
                    {/* Nút thao tác trực tiếp cho Vợ/Chồng */}
                    {isSpouseSelected && renderActionButtons(spouse.id, spouse.isDeceased)}
                  </div>
                </React.Fragment>
              );
            })}

          </div>
        </foreignObject>
      </g>
    );
  };

  return (
    <div className="w-full h-full relative bg-[#F4F0EB]/50">
      <div className="absolute top-4 right-4 z-40 flex flex-col md:flex-row items-end md:items-center gap-3 bg-white/80 backdrop-blur-sm p-3 rounded-lg shadow-md border border-wood-light/20">
        <input 
          type="text" 
          placeholder="Tìm kiếm..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border border-wood-light/30 rounded-sm px-3 py-1.5 text-sm outline-none focus:border-bronze bg-white w-full md:w-48 italic font-serif"
        />
        <div className="flex items-center gap-2 whitespace-nowrap">
          <input 
            type="checkbox" 
            id="filterLiving" 
            checked={filterLiving}
            onChange={(e) => setFilterLiving(e.target.checked)}
            className="rounded border-gray-300 text-burgundy focus:ring-burgundy"
          />
          <label htmlFor="filterLiving" className="text-sm text-wood-dark cursor-pointer font-medium">
            Chỉ làm nổi bật người còn sống
          </label>
        </div>
      </div>
      <div id="treeWrapper" className="w-full h-full overflow-hidden" style={{ touchAction: 'none' }}>
        {treeData.length > 0 ? (
          <Tree
            data={treeData}
            orientation="vertical"
            pathFunc="step"
            translate={{ x: 300, y: 80 }}
            nodeSize={{ x: 300, y: 280 }}
            renderCustomNodeElement={renderCustomNodeElement}
            separation={{ siblings: 1.5, nonSiblings: 2 }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
            <p className="mb-4">Chưa có dữ liệu phả hệ</p>
            {onAddRoot && isAdmin && (
              <button 
                onClick={onAddRoot} 
                className="px-4 py-2 bg-burgundy hover:bg-burgundy-dark text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                Thêm Cụ Tổ
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
