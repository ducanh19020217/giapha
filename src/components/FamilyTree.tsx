import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Tree from 'react-d3-tree';
import { DetailedMember } from '../types/member';
import { calculateKinship } from '../utils/kinshipCalculator';

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
  myMemberId?: string | null;
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
  isLoading,
  myMemberId
}) => {
  const [filterLiving, setFilterLiving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Đo kích thước thực tế của khung chứa cây để căn giữa và tự thu nhỏ trên màn hình hẹp (điện thoại)
  const treeWrapperRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = treeWrapperRef.current;
    if (!el) return;
    const updateSize = () => setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Bề rộng ô lớn nhất trong toàn cây (một người + các vợ/chồng), để nodeSize không bị hẹp hơn nội dung thực tế gây đè lên nhau
  const maxNodeWidth = useMemo(() => {
    let max = 220;
    members.forEach(m => {
      const width = 220 + (m.spouses?.length || 0) * 220;
      if (width > max) max = width;
    });
    return max;
  }, [members]);

  // Trên màn hình hẹp, thu nhỏ zoom ban đầu để thấy được nhiều nhánh cây hơn thay vì cây tràn ra ngoài khung nhìn
  const initialZoom = containerSize.width > 0
    ? Math.min(1, Math.max(0.4, containerSize.width / 800))
    : 1;

  // Xưng hô của "myMemberId" (Bạn) với từng thành viên khác, tính 1 lần rồi tra cứu O(1) khi vẽ node
  const relationLabels = useMemo(() => {
    const map = new Map<string, string>();
    const myMember = myMemberId ? members.find(m => m.id === myMemberId) : undefined;
    if (!myMember) return map;
    members.forEach(m => {
      map.set(m.id, m.id === myMember.id ? 'Bạn' : calculateKinship(myMember, m, members));
    });
    return map;
  }, [members, myMemberId]);

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
    const spouses = nodeDatum.attributes?.spouses || [];
    const relationLabel = relationLabels.get(nodeDatum.memberData.id);

    const isMainMemberMatched = searchQuery.trim() !== '' && removeVietnameseTones(nodeDatum.name).includes(removeVietnameseTones(searchQuery.trim()));

    // Tính toán chiều rộng và chiều cao node dựa trên trạng thái select
    const nodeWidth = 220 + (spouses.length * 220);
    const nodeHeight = isSelected ? 280 : 220;

    const renderActionButtons = (memberId: string, isDeceased: boolean) => {
      if (!isSelected) return null;
      return (
        <div className="flex gap-1 justify-center mt-3 pt-3 w-full border-t border-wood-light/10">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/member/${memberId}`); }}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-[9px] text-wood hover:text-burgundy font-medium uppercase outline-none transition-colors group/btn"
            title="Xem hồ sơ đầy đủ"
          >
            <div className="w-7 h-7 rounded-full bg-wood/5 group-hover/btn:bg-burgundy/10 flex items-center justify-center transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            Hồ sơ
          </button>
          {isAdmin && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onAddSpouse?.(memberId); }}
                className="flex-1 flex flex-col items-center justify-center gap-1 text-[9px] text-wood hover:text-burgundy font-medium uppercase outline-none transition-colors group/btn"
                title="Thêm Phối ngẫu"
              >
                <div className="w-7 h-7 rounded-full bg-wood/5 group-hover/btn:bg-burgundy/10 flex items-center justify-center transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="16" y1="11" x2="22" y2="11"/><line x1="19" y1="8" x2="19" y2="14"/></svg>
                </div>
                +Phu/Thê
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onAddChild?.(memberId); }}
                className="flex-1 flex flex-col items-center justify-center gap-1 text-[9px] text-wood hover:text-burgundy font-medium uppercase outline-none transition-colors group/btn"
                title="Thêm Hậu duệ"
              >
                <div className="w-7 h-7 rounded-full bg-wood/5 group-hover/btn:bg-burgundy/10 flex items-center justify-center transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                +Hậu duệ
              </button>
              {!isDeceased && (
                <button
                  onClick={(e) => { e.stopPropagation(); onMarkDeceased?.(memberId); }}
                  className="flex-1 flex flex-col items-center justify-center gap-1 text-[9px] text-wood hover:text-burgundy font-medium uppercase outline-none transition-colors group/btn"
                  title="Đánh dấu báo tử"
                >
                  <div className="w-7 h-7 rounded-full bg-wood/5 group-hover/btn:bg-burgundy/10 flex items-center justify-center transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h4l2-9 5 18 2-9h5"/></svg>
                  </div>
                  Báo tử
                </button>
              )}
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
              className={`w-[190px] flex-shrink-0 p-5 bg-white/85 backdrop-blur-md border cursor-pointer transition-all duration-300 flex flex-col items-center justify-center relative rounded-2xl group ${
                nodeDatum.attributes?.relationType === 'ADOPTED' || nodeDatum.attributes?.relationType === 'STEPCHILD' ? 'border-dashed border-[2px] border-wood-light/60' : 'border-white/60'
              } ${
                isSelected 
                  ? 'shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-bronze z-10 scale-[1.03] ring-1 ring-bronze' 
                  : 'shadow-lg hover:shadow-xl hover:-translate-y-1 hover:border-bronze/40'
              } ${isMainMemberMatched ? 'ring-4 ring-yellow-400 bg-yellow-50/90 shadow-[0_0_20px_rgba(250,204,21,0.6)] z-20' : ''}`}
              title={nodeDatum.name}
            >
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-bronze/30 bg-[#f5f2eb] flex items-center justify-center shadow-inner mb-3 group-hover:border-bronze transition-colors">
                {nodeDatum.attributes?.avatarUrl ? (
                  <img src={nodeDatum.attributes.avatarUrl} alt={nodeDatum.name} className="w-full h-full object-cover" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-8 h-8 text-wood/30">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>

              {nodeDatum.attributes?.birthOrder && (
                <div className="text-[9px] text-bronze uppercase tracking-[0.2em] font-serif mb-1 font-semibold">
                  {nodeDatum.attributes.birthOrder === 1 
                    ? (nodeDatum.attributes.gender === 'male' ? 'Trưởng nam' : 'Trưởng nữ')
                    : `Con thứ ${nodeDatum.attributes.birthOrder}`}
                </div>
              )}

              <div className={`text-base font-serif font-bold text-center leading-tight mb-1.5 ${nodeDatum.attributes?.gender === 'male' ? 'text-wood-dark' : 'text-burgundy'}`}>
                {nodeDatum.name}
              </div>

              {relationLabel && (
                <div className={`text-[10px] font-serif px-2 py-0.5 rounded-full mb-1 ${relationLabel === 'Bạn' ? 'bg-burgundy text-white font-semibold' : 'bg-bronze/10 text-bronze-dark border border-bronze/20'}`}>
                  {relationLabel === 'Bạn' ? 'Bạn' : relationLabel}
                </div>
              )}

              {nodeDatum.attributes?.relationType === 'ADOPTED' && (
                <div className="text-[10px] text-wood font-serif bg-wood/10 px-2.5 py-0.5 rounded-full mb-1 border border-wood/20">Con nuôi</div>
              )}
              {nodeDatum.attributes?.relationType === 'STEPCHILD' && (
                <div className="text-[10px] text-burgundy font-serif bg-burgundy/5 px-2.5 py-0.5 rounded-full mb-1 border border-burgundy/20 text-center">
                  Con riêng {nodeDatum.attributes?.isStepchildOfSpouseName ? `(của ${nodeDatum.attributes.isStepchildOfSpouseName})` : ''}
                </div>
              )}

              {isDeceased && (
                <div className="text-[11px] italic text-gray-400 font-serif mt-1">
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
                  <div className="w-8 h-px bg-gradient-to-r from-wood-light/10 via-bronze/40 to-wood-light/10 mt-[52px] flex-shrink-0"></div> {/* Đường nối */}
                  <div 
                    style={{ opacity: (filterLiving && spouse.isDeceased) ? 0.3 : 1 }}
                    onClick={() => onSelectMember(spouse.id)}
                    className={`w-[190px] flex-shrink-0 p-5 bg-white/60 backdrop-blur-md border border-wood-light/20 border-dashed cursor-pointer transition-all duration-300 flex flex-col items-center justify-center relative rounded-2xl group ${
                      isSpouseSelected 
                        ? 'shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-bronze z-10 scale-[1.03] ring-1 ring-bronze border-solid' 
                        : 'shadow-lg hover:shadow-xl hover:-translate-y-1 hover:border-bronze/40'
                    } ${isSpouseMatched ? 'ring-4 ring-yellow-400 bg-yellow-50/90 shadow-[0_0_20px_rgba(250,204,21,0.6)] z-20 border-solid' : ''}`}
                    title={spouse.name}
                  >
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-bronze/30 bg-[#f5f2eb] flex items-center justify-center shadow-inner mb-3 group-hover:border-bronze transition-colors">
                      {spouse.avatarUrl ? (
                        <img src={spouse.avatarUrl} alt={spouse.name} className="w-full h-full object-cover" />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-8 h-8 text-wood/30">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </div>

                    <div className="text-[9px] uppercase tracking-[0.2em] text-bronze font-serif mb-1 font-semibold">
                      {spouse.gender === 'female' ? 'Con dâu' : 'Con rể'}
                    </div>
                    
                    <div className={`text-base font-serif font-bold text-center leading-tight mb-1.5 ${spouse.gender === 'male' ? 'text-wood-dark' : 'text-burgundy'}`}>
                      {spouse.name}
                    </div>

                    {relationLabels.get(spouse.id) && (
                      <div className={`text-[10px] font-serif px-2 py-0.5 rounded-full mb-1 ${relationLabels.get(spouse.id) === 'Bạn' ? 'bg-burgundy text-white font-semibold' : 'bg-bronze/10 text-bronze-dark border border-bronze/20'}`}>
                        {relationLabels.get(spouse.id)}
                      </div>
                    )}

                    {spouse.isDeceased && (
                      <div className="text-[11px] italic text-gray-400 font-serif mt-1">
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
    <div className="w-full h-full relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#fdfbf7] via-[#f7f2ea] to-[#eee4d5]">
      <div className="absolute top-6 right-6 z-40 flex flex-col md:flex-row items-end md:items-center gap-4 bg-white/70 backdrop-blur-md px-5 py-3 rounded-2xl shadow-xl border border-white/60">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wood-light" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input 
            type="text" 
            placeholder="Tìm kiếm thành viên..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-none rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-bronze/50 bg-white/80 w-full md:w-56 font-serif shadow-inner transition-shadow"
          />
        </div>
        <div className="w-px h-6 bg-wood-light/20 hidden md:block"></div>
        <div className="flex items-center gap-2 whitespace-nowrap cursor-pointer group">
          <input 
            type="checkbox" 
            id="filterLiving" 
            checked={filterLiving}
            onChange={(e) => setFilterLiving(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-burgundy focus:ring-burgundy cursor-pointer"
          />
          <label htmlFor="filterLiving" className="text-sm text-wood-dark cursor-pointer font-medium group-hover:text-burgundy transition-colors">
            Nổi bật người còn sống
          </label>
        </div>
      </div>
      <div ref={treeWrapperRef} id="treeWrapper" className="w-full h-full overflow-hidden" style={{ touchAction: 'none' }}>
        {isLoading || (treeData.length > 0 && containerSize.width === 0) ? (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-burgundy mb-4"></div>
            <p className="text-wood-dark font-serif italic animate-pulse">Đang tải mộc bản...</p>
          </div>
        ) : treeData.length > 0 ? (
          <Tree
            data={treeData}
            orientation="vertical"
            pathFunc="step"
            dimensions={containerSize}
            translate={{ x: containerSize.width / 2, y: 80 }}
            zoom={initialZoom}
            scaleExtent={{ min: 0.1, max: 2 }}
            nodeSize={{ x: maxNodeWidth + 80, y: 320 }}
            renderCustomNodeElement={renderCustomNodeElement}
            separation={{ siblings: 1.2, nonSiblings: 1.6 }}
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
