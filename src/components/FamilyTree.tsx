import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Tree from 'react-d3-tree';
import { DetailedMember } from '../types/member';
import { calculateKinship } from '../utils/kinshipCalculator';
import { extractYear } from '../utils/stats';

const removeVietnameseTones = (str: string) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase();
};

// Lưu ý: Safari/WebKit (kể cả mọi trình duyệt trên iOS) tính sai vị trí nội dung HTML lồng trong
// SVG <foreignObject> khi nội dung đó dùng position/transform/transition — nội dung bị dồn về
// góc (0,0) của cả SVG, gây "vỡ giao diện". Vì vậy thẻ thành viên trên cây chỉ dùng flex thuần,
// KHÔNG dùng relative/absolute/translate/scale/transition bên trong foreignObject.
// https://github.com/bkrem/react-d3-tree/issues/284

interface FamilyTreeProps {
  members: DetailedMember[];
  onSelectMember: (memberId: string) => void;
  selectedMemberId: string;
  onAddSpouse?: (memberId: string) => void;
  onAddChild?: (memberId: string) => void;
  onMarkDeceased?: (memberId: string) => void;
  onSetRootGeneration?: (memberId: string) => void;
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

interface ViewState {
  zoom: number;
  translate: { x: number; y: number };
}

// Kích thước thẻ trên cây. Vợ/chồng xếp DỌC bên dưới người chính (thay vì dàn ngang)
// nên mọi node có cùng bề rộng -> cây gọn hơn nhiều theo chiều ngang.
const CARD_WIDTH = 184;
const MAIN_CARD_HEIGHT = 68;
const SPOUSE_ROW_HEIGHT = 50;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2;

const GENDER_STYLE = {
  male: {
    border: 'border-l-[#2f5f9e]',
    avatarBg: 'bg-[#e6eef8]',
    avatarIcon: 'text-[#2f5f9e]/50',
    symbolColor: 'text-[#2f5f9e]',
    symbol: '♂',
  },
  female: {
    border: 'border-l-[#b83b67]',
    avatarBg: 'bg-[#fbe8ee]',
    avatarIcon: 'text-[#b83b67]/50',
    symbolColor: 'text-[#b83b67]',
    symbol: '♀',
  },
} as const;

const lifeSpan = (m: DetailedMember) => {
  const birth = extractYear(m.birthDate);
  const death = extractYear(m.deathDate);
  if (m.isDeceased) return `${birth ?? '?'} – ${death ?? '?'}`;
  return birth ? `s. ${birth}` : '';
};

const Avatar: React.FC<{ member: DetailedMember; size: number }> = ({ member, size }) => {
  const g = GENDER_STYLE[member.gender] || GENDER_STYLE.male;
  return (
    <div
      className={`rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center border border-white shadow-sm ${g.avatarBg} ${member.isDeceased ? 'grayscale' : ''}`}
      style={{ width: size, height: size }}
    >
      {member.avatarUrl ? (
        <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className={g.avatarIcon} style={{ width: size * 0.6, height: size * 0.6 }}>
          <circle cx="12" cy="8" r="4.2" />
          <path d="M3.5 21c0-4.4 3.8-7.5 8.5-7.5s8.5 3.1 8.5 7.5z" />
        </svg>
      )}
    </div>
  );
};

export const FamilyTree: React.FC<FamilyTreeProps> = ({
  members,
  onSelectMember,
  selectedMemberId,
  onAddSpouse,
  onAddChild,
  onMarkDeceased,
  onSetRootGeneration,
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

  // Số vợ/chồng nhiều nhất của 1 người -> quyết định khoảng cách giữa các đời để thẻ không đè nhau
  const maxSpouses = useMemo(
    () => members.reduce((max, m) => Math.max(max, m.spouses?.length || 0), 0),
    [members]
  );
  const nodeBlockHeight = MAIN_CARD_HEIGHT + maxSpouses * SPOUSE_ROW_HEIGHT;

  // Điện thoại: không thu nhỏ quá mức để chữ còn đọc được, và đẩy cây xuống dưới thanh tìm kiếm
  const isNarrow = containerSize.width > 0 && containerSize.width < 768;
  const initialView: ViewState = {
    zoom: containerSize.width > 0 ? Math.min(1, Math.max(0.7, containerSize.width / 700)) : 1,
    translate: { x: containerSize.width / 2, y: isNarrow ? 200 : 110 },
  };

  // Zoom/di chuyển do nút bấm điều khiển. null = dùng góc nhìn ban đầu.
  // liveView lưu góc nhìn hiện tại (kể cả khi người dùng tự kéo/zoom) để nút +/− zoom quanh tâm màn hình.
  const [view, setView] = useState<ViewState | null>(null);
  const liveView = useRef<ViewState>(initialView);
  const resetCount = useRef(0);

  const zoomBy = (factor: number) => {
    const { zoom, translate } = liveView.current;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    const cx = containerSize.width / 2;
    const cy = containerSize.height / 2;
    const ratio = nextZoom / zoom;
    setView({
      zoom: nextZoom,
      translate: { x: cx - (cx - translate.x) * ratio, y: cy - (cy - translate.y) * ratio },
    });
  };

  const resetView = () => {
    // react-d3-tree chỉ áp lại zoom/translate khi prop thay đổi; lệch 1 lượng rất nhỏ để lần
    // "Về giữa" thứ 2 liên tiếp (sau khi người dùng tự kéo) vẫn có tác dụng.
    resetCount.current += 1;
    setView({
      zoom: initialView.zoom,
      translate: { x: initialView.translate.x + (resetCount.current % 2) * 0.01, y: initialView.translate.y },
    });
  };

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

    const rootNodes: TreeNode[] = [];
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
                        (clonedNode.attributes?.spouses || []).some((s: DetailedMember) => removeVietnameseTones(s.name).includes(normalizedQuery));

        clonedNode.children = filterTree(clonedNode.children, query);

        if (isMatch || clonedNode.children.length > 0) {
          return clonedNode;
        }
        return null;
      }).filter(Boolean) as TreeNode[];
    };

    return filterTree(rootNodes, searchQuery);
  }, [members, searchQuery]);

  const normalizedSearch = removeVietnameseTones(searchQuery.trim());
  const matchesSearch = (name: string) => normalizedSearch !== '' && removeVietnameseTones(name).includes(normalizedSearch);

  const selectedMember = selectedMemberId ? members.find(m => m.id === selectedMemberId) : undefined;
  // Người đứng đầu cây (gốc) — được đánh dấu "Người đầu tiên" và cho admin đặt lại là đời thứ mấy
  const rootIds = useMemo(() => new Set(treeData.map(n => n.memberData.id)), [treeData]);
  const isSelectedRoot = Boolean(selectedMember && rootIds.has(selectedMember.id));

  const renderCustomNodeElement = ({ nodeDatum }: any) => {
    const member: DetailedMember = nodeDatum.memberData;
    const spouses: DetailedMember[] = nodeDatum.attributes?.spouses || [];
    const nodeHeight = MAIN_CARD_HEIGHT + spouses.length * SPOUSE_ROW_HEIGHT + 8;
    const relationType = nodeDatum.attributes?.relationType;
    const isNonBiological = relationType === 'ADOPTED' || relationType === 'STEPCHILD';

    // Nhãn nhỏ phía trên tên: ưu tiên xưng hô với "Bạn", rồi con nuôi/con riêng, rồi thứ tự sinh
    const tags: { text: string; className: string }[] = [];
    const relationLabel = relationLabels.get(member.id);
    if (rootIds.has(member.id)) {
      tags.push({ text: `Người đầu tiên · Đời ${member.generation}`, className: 'bg-bronze text-white' });
    }
    if (relationLabel) {
      tags.push({
        text: relationLabel,
        className: relationLabel === 'Bạn' ? 'bg-burgundy text-white' : 'bg-bronze/10 text-bronze-dark',
      });
    }
    if (relationType === 'ADOPTED') tags.push({ text: 'Con nuôi', className: 'bg-wood/10 text-wood' });
    if (relationType === 'STEPCHILD') {
      const of = nodeDatum.attributes?.isStepchildOfSpouseName;
      tags.push({ text: of ? `Con riêng của ${of}` : 'Con riêng', className: 'bg-burgundy/10 text-burgundy' });
    }
    if (member.birthOrder === 1 && !relationLabel && !rootIds.has(member.id)) {
      tags.push({ text: member.gender === 'male' ? 'Trưởng nam' : 'Trưởng nữ', className: 'bg-bronze/10 text-bronze-dark' });
    }

    const cardState = (m: DetailedMember) => {
      const isSelected = m.id === selectedMemberId;
      const isMatched = matchesSearch(m.name);
      const dimmed = filterLiving && m.isDeceased;
      return [
        isSelected ? 'ring-2 ring-bronze shadow-lg' : 'shadow-md hover:shadow-lg',
        isMatched ? 'ring-[3px] ring-yellow-400 !bg-yellow-50' : '',
        m.isDeceased ? 'bg-[#f6f3ee]' : 'bg-white',
        // Chỉ làm mờ NỘI DUNG, nền thẻ vẫn đục — nếu làm mờ cả thẻ, đường nối cha→con chạy phía
        // sau sẽ lộ xuyên qua thẻ thành 1 nét dọc.
        dimmed ? '[&>*]:opacity-30 !border-l-gray-300 shadow-none' : '',
      ].join(' ');
    };

    const g = GENDER_STYLE[member.gender] || GENDER_STYLE.male;
    const span = lifeSpan(member);

    return (
      <g>
        <foreignObject x={-CARD_WIDTH / 2} y={-MAIN_CARD_HEIGHT / 2} width={CARD_WIDTH} height={nodeHeight} style={{ overflow: 'visible' }}>
          <div className="flex flex-col w-full">
            {/* Thành viên chính */}
            <div
              onClick={() => onSelectMember(member.id)}
              title={member.name}
              style={{ height: MAIN_CARD_HEIGHT }}
              className={`w-full flex items-center gap-2 pl-2 pr-2 rounded-xl border-l-4 cursor-pointer ${g.border} ${
                isNonBiological ? 'border-y border-r border-dashed border-y-wood-light/50 border-r-wood-light/50' : ''
              } ${cardState(member)}`}
            >
              <Avatar member={member} size={40} />
              <div className="min-w-0 flex-1">
                {tags.length > 0 && (
                  <div className="flex gap-1 mb-0.5 overflow-hidden">
                    {tags.slice(0, 2).map(t => (
                      <span key={t.text} className={`text-[9px] leading-none px-1.5 py-[3px] rounded-full font-semibold whitespace-nowrap truncate ${t.className}`}>
                        {t.text}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-[13px] font-serif font-bold text-wood-dark leading-tight line-clamp-2">
                  <span className={`${g.symbolColor} mr-0.5`}>{g.symbol}</span>
                  {member.name}
                </div>
                <div className="text-[10px] text-wood/60 leading-tight mt-0.5 whitespace-nowrap">
                  Đời {member.generation}{span && ` · ${span}`}
                </div>
              </div>
            </div>

            {/* Vợ/Chồng: xếp dọc, thụt lề, nối bằng đường chấm */}
            {spouses.map(spouse => {
              const sg = GENDER_STYLE[spouse.gender] || GENDER_STYLE.male;
              const sSpan = lifeSpan(spouse);
              return (
                <div key={spouse.id} className="flex items-stretch" style={{ height: SPOUSE_ROW_HEIGHT }}>
                  <div className="w-4 ml-3 flex-shrink-0 border-l-2 border-b-2 border-dotted border-bronze/50 rounded-bl-lg mb-[21px]" />
                  <div
                    onClick={() => onSelectMember(spouse.id)}
                    title={spouse.name}
                    className={`flex-1 min-w-0 mt-1.5 flex items-center gap-1.5 px-1.5 rounded-lg border-l-4 cursor-pointer ${sg.border} ${cardState(spouse)}`}
                  >
                    <Avatar member={spouse} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11.5px] font-serif font-semibold text-wood-dark leading-tight truncate">
                        <span className={`${sg.symbolColor} mr-0.5`}>{sg.symbol}</span>
                        {spouse.name}
                      </div>
                      <div className="text-[9.5px] text-wood/60 leading-tight truncate">
                        {relationLabels.get(spouse.id) || (spouse.gender === 'female' ? 'Vợ' : 'Chồng')}
                        {sSpan && ` · ${sSpan}`}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </foreignObject>
      </g>
    );
  };

  const currentView = view ?? initialView;

  return (
    <div className="w-full h-full relative bg-[#faf6ef] overflow-hidden">
      {/* Hình nền Long Phượng mờ, cố định (không chạy theo khi kéo cây) */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.08] bg-center bg-cover bg-no-repeat"
        style={{ backgroundImage: "url('/bg-long-phuong.svg')" }}
      />
      <div aria-hidden className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(184,115,51,0.10))]" />

      {/* Thanh công cụ: tìm kiếm + lọc + chú thích */}
      <div className="absolute top-16 left-3 right-3 md:top-4 md:left-auto md:right-4 md:w-auto z-40 flex flex-col gap-2 bg-white/85 backdrop-blur-md p-2 rounded-2xl shadow-lg border border-white/70">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0 md:w-60 md:flex-none">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-wood-light" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input
              type="text"
              placeholder="Tìm thành viên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl pl-8 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-bronze/50 bg-[#f7f2ea] font-serif"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa tìm kiếm"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-wood/60 hover:bg-wood/10 flex items-center justify-center"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setFilterLiving(v => !v)}
            aria-pressed={filterLiving}
            title="Làm mờ người đã khuất"
            className={`flex-shrink-0 text-xs font-medium px-3 py-2 rounded-xl border transition-colors whitespace-nowrap ${
              filterLiving ? 'bg-burgundy text-white border-burgundy' : 'bg-white text-wood-dark border-wood/15 hover:border-bronze'
            }`}
          >
            Người còn sống
          </button>
        </div>
        <div className="flex items-center gap-3 px-1 text-[11px] text-wood/70">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#2f5f9e]" />Nam</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#b83b67]" />Nữ</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm border border-dashed border-wood-light" />Con nuôi/riêng</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#e5dfd5]" />Đã mất</span>
        </div>
      </div>

      <div ref={treeWrapperRef} id="treeWrapper" className="relative w-full h-full overflow-hidden" style={{ touchAction: 'none' }}>
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
            pathClassFunc={() => 'tree-link'}
            dimensions={containerSize}
            translate={currentView.translate}
            zoom={currentView.zoom}
            onUpdate={({ zoom, translate }) => { liveView.current = { zoom, translate }; }}
            scaleExtent={{ min: MIN_ZOOM, max: MAX_ZOOM }}
            nodeSize={{ x: CARD_WIDTH + 16, y: nodeBlockHeight + 56 }}
            renderCustomNodeElement={renderCustomNodeElement}
            separation={{ siblings: 1, nonSiblings: 1.15 }}
          />
        ) : searchQuery.trim() ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-wood/70 font-serif">
            <p className="mb-3">Không tìm thấy ai tên "{searchQuery.trim()}"</p>
            <button onClick={() => setSearchQuery('')} className="text-sm text-burgundy underline">Xóa tìm kiếm</button>
          </div>
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

      {/* Nút zoom */}
      {treeData.length > 0 && (
        <div className={`absolute right-3 z-40 flex flex-col bg-white/90 backdrop-blur-md rounded-xl shadow-lg border border-white/70 overflow-hidden ${selectedMember ? 'bottom-44 md:bottom-4' : 'bottom-4'}`}>
          <button type="button" onClick={() => zoomBy(1.25)} aria-label="Phóng to" className="w-10 h-10 text-lg text-wood-dark hover:bg-bronze/10">+</button>
          <button type="button" onClick={() => zoomBy(0.8)} aria-label="Thu nhỏ" className="w-10 h-10 text-lg text-wood-dark hover:bg-bronze/10 border-t border-wood/10">−</button>
          <button type="button" onClick={resetView} aria-label="Về vị trí ban đầu" title="Về vị trí ban đầu" className="w-10 h-10 flex items-center justify-center text-wood-dark hover:bg-bronze/10 border-t border-wood/10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/></svg>
          </button>
        </div>
      )}

      {/* Bảng thao tác cho người đang chọn — cố định ở đáy màn hình, nút to dễ bấm trên điện thoại */}
      {selectedMember && (
        <div className="absolute bottom-3 left-3 right-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[440px] z-40 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/70 p-3">
          <div className="flex items-center gap-3">
            <Avatar member={selectedMember} size={44} />
            <div className="min-w-0 flex-1">
              <div className="font-serif font-bold text-wood-dark truncate">
                <span className={`${(GENDER_STYLE[selectedMember.gender] || GENDER_STYLE.male).symbolColor} mr-1`}>
                  {(GENDER_STYLE[selectedMember.gender] || GENDER_STYLE.male).symbol}
                </span>
                {selectedMember.name}
              </div>
              <div className="text-xs text-wood/60 truncate">
                Đời {selectedMember.generation}
                {lifeSpan(selectedMember) && ` · ${lifeSpan(selectedMember)}`}
                {selectedMember.isDeceased && ' · Đã mất'}
                {relationLabels.get(selectedMember.id) && ` · ${relationLabels.get(selectedMember.id)}`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectMember('')}
              aria-label="Đóng"
              className="w-8 h-8 flex-shrink-0 rounded-full text-wood/60 hover:bg-wood/10 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <ActionButton label="Hồ sơ" primary onClick={() => navigate(`/member/${selectedMember.id}`)}
              icon={<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>} />
            {isAdmin && (
              <>
                <ActionButton label="+ Vợ/Chồng" onClick={() => onAddSpouse?.(selectedMember.id)}
                  icon={<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>} />
                <ActionButton label="+ Con" onClick={() => onAddChild?.(selectedMember.id)}
                  icon={<><circle cx="9" cy="7" r="4"/><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><path d="M19 8v6M16 11h6"/></>} />
                {isSelectedRoot && onSetRootGeneration && (
                  <ActionButton label="Đặt số đời" onClick={() => onSetRootGeneration(selectedMember.id)}
                    icon={<><path d="M4 6h16M4 12h10M4 18h6"/><path d="M18 14l3 3-3 3"/></>} />
                )}
                {!selectedMember.isDeceased && (
                  <ActionButton label="Báo tử" onClick={() => onMarkDeceased?.(selectedMember.id)}
                    icon={<path d="M2 12h4l2-9 5 18 2-9h5"/>} />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ActionButton: React.FC<{ label: string; icon: React.ReactNode; onClick: () => void; primary?: boolean }> = ({ label, icon, onClick, primary }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-medium transition-colors ${
      primary ? 'bg-burgundy text-white hover:bg-burgundy-dark' : 'bg-[#f7f2ea] text-wood-dark hover:bg-bronze/15'
    }`}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
    <span className="truncate max-w-full">{label}</span>
  </button>
);
