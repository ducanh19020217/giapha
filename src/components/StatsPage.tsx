import React, { useMemo, useState } from 'react';
import { DetailedMember } from '../types/member';
import { computeFamilyStats } from '../utils/stats';

interface StatsPageProps {
  members: DetailedMember[];
}

// Màu dùng riêng cho các biểu đồ trong trang này — đã kiểm tra qua công cụ chấm điểm
// an toàn cho người mù màu (dataviz skill / validate_palette.js), KHÔNG dùng màu
// thương hiệu (burgundy/wood/bronze) cho phần mã hóa dữ liệu vì các tông đó quá gần
// nhau về sắc độ để phân biệt được giữa 2 chuỗi số liệu.
const CHART_COLOR_MALE = '#2a78d6';   // xanh dương
const CHART_COLOR_FEMALE = '#eb6834'; // cam
const CHART_COLOR_GENERATION = '#2a78d6';

function StatTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-wood/10 p-5 text-center flex flex-col items-center justify-center gap-1">
      <div className="text-3xl md:text-4xl font-bold text-burgundy font-serif">{value}</div>
      <div className="text-sm text-wood-dark font-medium">{label}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

// Thanh 2 đoạn (VD: Nam/Nữ, Còn sống/Đã khuất) — luôn có chú giải (legend) và nhãn trực
// tiếp trên từng đoạn vì đây là biểu đồ có từ 2 chuỗi số liệu trở lên.
function SplitBar({
  segments,
}: {
  segments: Array<{ label: string; count: number; percent: number; color: string }>;
}) {
  return (
    <div>
      <div className="flex w-full h-8 rounded-full overflow-hidden border border-wood/10 bg-gray-100">
        {segments.map((s, i) => (
          <div
            key={s.label}
            title={`${s.label}: ${s.count} người (${s.percent}%)`}
            style={{ width: `${s.percent}%`, backgroundColor: s.color }}
            className={`h-full flex items-center justify-center transition-all ${i === 0 ? 'rounded-l-full' : ''} ${i === segments.length - 1 ? 'rounded-r-full' : ''}`}
          >
            {s.percent >= 12 && (
              <span className="text-[11px] font-semibold text-white drop-shadow-sm">{s.percent}%</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 justify-center">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-1.5 text-sm text-wood-dark">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            {s.label}: <span className="font-semibold">{s.count}</span>
            <span className="text-gray-400">({s.percent}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Biểu đồ cột ngang: số thành viên theo từng thế hệ. Dùng 1 màu duy nhất (magnitude =
// độ dài cột), kèm tooltip khi hover/focus vào từng cột.
function GenerationBarChart({ data }: { data: Array<{ generation: number; count: number }> }) {
  const [hoverGen, setHoverGen] = useState<number | null>(null);
  const maxCount = Math.max(1, ...data.map(d => d.count));

  return (
    <div className="space-y-2.5">
      {data.map(d => {
        const widthPercent = Math.max(4, Math.round((d.count / maxCount) * 100));
        return (
          <div key={d.generation} className="flex items-center gap-3 relative">
            <div className="w-16 flex-shrink-0 text-sm text-wood-dark font-medium text-right">Đời {d.generation}</div>
            <div className="flex-1 h-4 bg-gray-100 rounded-full relative">
              <div
                role="img"
                aria-label={`Đời ${d.generation}: ${d.count} thành viên`}
                onMouseEnter={() => setHoverGen(d.generation)}
                onMouseLeave={() => setHoverGen(null)}
                onFocus={() => setHoverGen(d.generation)}
                onBlur={() => setHoverGen(null)}
                tabIndex={0}
                className="h-4 rounded-full outline-none focus:ring-2 focus:ring-burgundy/40"
                style={{ width: `${widthPercent}%`, backgroundColor: CHART_COLOR_GENERATION }}
              />
              {hoverGen === d.generation && (
                <div className="absolute -top-8 left-0 bg-wood-dark text-white text-xs px-2 py-1 rounded shadow-md whitespace-nowrap z-10">
                  Đời {d.generation}: {d.count} thành viên
                </div>
              )}
            </div>
            <div className="w-8 flex-shrink-0 text-sm text-wood-dark font-semibold">{d.count}</div>
          </div>
        );
      })}
    </div>
  );
}

export const StatsPage: React.FC<StatsPageProps> = ({ members }) => {
  const stats = useMemo(() => computeFamilyStats(members), [members]);

  if (members.length === 0) {
    return (
      <div className="mt-8 text-center text-wood-dark/70 py-16">
        Chưa có dữ liệu thành viên để thống kê.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-8 pb-16">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Tổng thành viên" value={stats.totalMembers} />
        <StatTile label="Số đời truyền thừa" value={stats.totalGenerations} />
        <StatTile label="Còn sống" value={stats.aliveCount} sub={`${stats.deceasedCount} đã khuất`} />
        <StatTile
          label="Tuổi thọ trung bình"
          value={stats.averageLifespan !== null ? stats.averageLifespan : '—'}
          sub={stats.averageLifespan !== null ? 'tuổi (người đã khuất)' : 'Chưa đủ dữ liệu'}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-wood/10 p-5 md:p-6">
        <h2 className="text-lg font-serif font-bold text-burgundy mb-4">Tỷ lệ Nam / Nữ</h2>
        <SplitBar
          segments={[
            { label: 'Nam', count: stats.maleCount, percent: stats.malePercent, color: CHART_COLOR_MALE },
            { label: 'Nữ', count: stats.femaleCount, percent: stats.femalePercent, color: CHART_COLOR_FEMALE },
          ]}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-wood/10 p-5 md:p-6">
        <h2 className="text-lg font-serif font-bold text-burgundy mb-5">Số thành viên theo từng thế hệ</h2>
        <GenerationBarChart data={stats.byGeneration} />
      </div>
    </div>
  );
};
