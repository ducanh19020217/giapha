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
  isLoading?: boolean;
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
  isAdmin,
  isLoading
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
          relationType: m.relationType,
          birthOrder: m.birthOrder,
          spouses: spousesData
        },
        children: [],
        memberData: m
      });
    });

    let rootNodes: TreeNode[] = [];
    const marriedInSpouses = new Set<string>();

    // Xác định ai là người ghép vào họ (vợ/chồng của người có máu mủ)
    members.forEach(m => {
        const isSpouseMarriedIn = members.some(other => {
          if (!other.spouses?.some(s => s.id === m.id)) return false;
          if (other.fatherId || other.motherId) return true;
          return members.indexOf(other) < members.indexOf(m);
        });
        if (isSpouseMarriedIn) {
            marriedInSpouses.add(m.id);
        }
    });

    // Gắn node con vào node cha
    members.forEach(m => {
      const node = memberMap.get(m.id)!;
      
      let attached = false;
      if (m.fatherId && memberMap.has(m.fatherId)) {
        memberMap.get(m.fatherId)!.children!.push(node);
        attached = true;
      } else if (m.motherId && memberMap.has(m.motherId)) {
        memberMap.get(m.motherId)!.children!.push(node);
        attached = true;
      } 
      
      if (!attached && !marriedInSpouses.has(m.id)) {
         rootNodes.push(node); 
      }
    });

    // Xử lý Con riêng của Vợ/Chồng lấy vào họ (vì họ không nằm trên cây chính)
    members.forEach(m => {
       if (marriedInSpouses.has(m.id)) {
           const spouseNode = memberMap.get(m.id)!;
           if (spouseNode.children && spouseNode.children.length > 0) {
               // Tìm người chồng/vợ là người máu mủ (nằm trên cây)
               const bloodlineSpouse = members.find(other => other.spouses?.some(s => s.id === m.id) && !marriedInSpouses.has(other.id));
               if (bloodlineSpouse) {
                   const bloodlineNode = memberMap.get(bloodlineSpouse.id)!;
                   // Chuyển các con riêng sang node của người máu mủ để vẽ được
                   spouseNode.children.forEach(child => {
                       if (!child.attributes) child.attributes = {};
                       child.attributes.isStepchildOfSpouseName = m.name;
                       bloodlineNode.children!.push(child);
                   });
                   spouseNode.children = [];
               }
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

    const isMainMemberMatched = searchQuery.trim() !== '' && removeVietnameseTones(nodeDatum.name).includes(removeVietnameseTones(searchQuery.trim()));

    // Tính toán chiều rộng và chiều cao node dựa trên trạng thái select
    const nodeWidth = 180 + (spouses.length * 190);
    const nodeHeight = isSelected ? (isAdmin ? 260 : 200) : 200;

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
              className={`flex-1 min-w-[160px] p-4 bg-[#Fdfbf7] border cursor-pointer transition-all flex flex-col items-center justify-center relative ${
                nodeDatum.attributes?.relationType === 'ADOPTED' || nodeDatum.attributes?.relationType === 'STEPCHILD' ? 'border-dashed border-[2px] border-wood-light/60' : 'border-wood-light/40'
              } ${
                isSelected 
                  ? 'shadow-[0_0_15px_rgba(139,90,43,0.3)] border-bronze z-10 scale-[1.02]' 
                  : 'shadow-sm hover:border-bronze/60 hover:shadow-md'
              } ${isMainMemberMatched ? 'ring-4 ring-yellow-400 bg-yellow-50/50 shadow-[0_0_20px_rgba(250,204,21,0.6)] z-20' : ''}`}
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

              {nodeDatum.attributes?.birthOrder && (
                <div className="text-[10px] text-wood-light uppercase tracking-wider font-serif mb-0.5">
                  {nodeDatum.attributes.birthOrder === 1 
                    ? (nodeDatum.attributes.gender === 'male' ? 'Trưởng nam' : 'Trưởng nữ')
                    : `Con thứ ${nodeDatum.attributes.birthOrder}`}
                </div>
              )}

              <div className={`text-sm font-serif font-bold text-center leading-tight mb-1 ${nodeDatum.attributes?.gender === 'male' ? 'text-wood-dark' : 'text-burgundy'}`}>
                {nodeDatum.name}
              </div>
              
              {nodeDatum.attributes?.relationType === 'ADOPTED' && (
                <div className="text-[10px] text-wood font-serif bg-wood/10 px-2 py-0.5 rounded-full mb-1 border border-wood/20">Con nuôi</div>
              )}
              {nodeDatum.attributes?.relationType === 'STEPCHILD' && (
                <div className="text-[10px] text-burgundy font-serif bg-burgundy/5 px-2 py-0.5 rounded-full mb-1 border border-burgundy/20 text-center">
                  Con riêng {nodeDatum.attributes?.isStepchildOfSpouseName ? `(của ${nodeDatum.attributes.isStepchildOfSpouseName})` : ''}
                </div>
              )}

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
              const isSpouseMatched = searchQuery.trim() !== '' && removeVietnameseTones(spouse.name).includes(removeVietnameseTones(searchQuery.trim()));
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
                    } ${isSpouseMatched ? 'ring-4 ring-yellow-400 bg-yellow-50/50 shadow-[0_0_20px_rgba(250,204,21,0.6)] z-20 border-solid' : ''}`}
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
                      {spouse.gender === 'female' ? 'Con dâu' : 'Con rể'}
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
        {isLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-burgundy mb-4"></div>
            <p className="text-wood-dark font-serif italic animate-pulse">Đang tải mộc bản...</p>
          </div>
        ) : treeData.length > 0 ? (
          <Tree
            data={treeData}
            orientation="vertical"
            pathFunc="step"
            translate={{ x: 300, y: 80 }}
            nodeSize={{ x: 300, y: 320 }}
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
