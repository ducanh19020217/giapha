import React, { useMemo } from 'react';
import { DetailedMember } from '../types/member';
import { FamilyEvent } from '../types/event';
import { convertSolar2Lunar, lunarToSolarInYear } from '../utils/lunarCalendar';

interface EventsCalendarProps {
  members: DetailedMember[];
  events: FamilyEvent[];
  isAdmin?: boolean;
  onAddEvent?: () => void;
  onDeleteEvent?: (id: string) => void;
}

type EventType = 'BIRTHDAY' | 'DEATH' | 'CUSTOM';

interface CalendarEvent {
  id?: string;
  member?: DetailedMember;
  title: string;
  solarDay: number;
  solarMonth: number;
  lunarDay: number;
  lunarMonth: number;
  isLunar: boolean; // ngày gốc được ghi theo Âm lịch hay Dương lịch
  type: EventType;
  note: string;
}

// Quy ước có sẵn trong app: ghi chú trong ngoặc "(Âm lịch)" đánh dấu ngày sinh/mất là Âm lịch
const isLunarNote = (note: string) => /âm/i.test(note);

export const EventsCalendar: React.FC<EventsCalendarProps> = ({ members, events, isAdmin, onAddEvent, onDeleteEvent }) => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const [todayLunarDay, todayLunarMonth, todayLunarYear] = useMemo(
    () => convertSolar2Lunar(today.getDate(), today.getMonth() + 1, currentYear),
    [currentYear] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const eventsByMonth = useMemo(() => {
    const calendarEvents: CalendarEvent[] = [];

    // Helper to parse date strings like "15/08/1990 (Âm lịch)" or "1999-08-14T17:00:00.000Z"
    // Nhận cả string lẫn number vì Google Sheets có thể trả về năm sinh dạng số (VD: 1990)
    const parseDate = (rawDate: string | number, type: 'BIRTHDAY' | 'DEATH', member: DetailedMember) => {
      if (!rawDate) return;
      const dateString = String(rawDate);

      let day = 0;
      let month = 0;

      // Check for ISO format or YYYY-MM-DD first (e.g., 1999-08-14T17:00:00.000Z)
      const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        // If it's a full ISO string (with T and Z), parse it as a Date object to let the browser convert to local timezone
        if (dateString.includes('T') && dateString.includes('Z')) {
          const d = new Date(dateString);
          if (!isNaN(d.getTime())) {
            day = d.getDate();
            month = d.getMonth() + 1;
          }
        } else {
          // Just YYYY-MM-DD
          month = parseInt(isoMatch[2]);
          day = parseInt(isoMatch[3]);
        }
      } else {
        // Look for day and month: dd/mm or d/m using common separators, avoid matching start of year
        // We use \b to ensure it starts at a word boundary, so we don't match the "19" in "1990"
        const match = dateString.match(/\b(\d{1,2})[/\-.](\d{1,2})\b/);
        if (match) {
          day = parseInt(match[1]);
          month = parseInt(match[2]);
        }
      }

      if (day < 1 || day > 31 || month < 1 || month > 12) return;

      // Extract notes like "(Âm lịch)"
      const noteMatch = dateString.match(/\((.*?)\)/);
      const rawNote = noteMatch ? noteMatch[1] : '';
      const isLunar = rawNote ? isLunarNote(rawNote) : false;

      let solarDay = day, solarMonth = month, lunarDay = day, lunarMonth = month;
      if (isLunar) {
        const solar = lunarToSolarInYear(day, month, currentYear);
        solarDay = solar.day;
        solarMonth = solar.month;
      } else {
        const [ld, lm] = convertSolar2Lunar(day, month, currentYear);
        lunarDay = ld;
        lunarMonth = lm;
      }

      calendarEvents.push({
        member, type, title: member.name,
        solarDay, solarMonth, lunarDay, lunarMonth, isLunar,
        note: isLunar ? '' : rawNote, // đã thể hiện qua nhãn ÂL, không lặp lại trong ghi chú
      });
    };

    members.forEach(member => {
      if (!member.isDeceased && member.birthDate) {
        parseDate(member.birthDate, 'BIRTHDAY', member);
      }
      if (member.isDeceased && member.deathDate) {
        parseDate(member.deathDate, 'DEATH', member);
      }
    });

    // Sự kiện tùy chỉnh (chung của dòng họ hoặc gắn với 1 thành viên)
    events.forEach(ev => {
      if (!ev.day || !ev.month) return;
      const linkedMember = ev.memberId ? members.find(m => m.id === ev.memberId) : undefined;

      let solarDay = ev.day, solarMonth = ev.month, lunarDay = ev.day, lunarMonth = ev.month;
      if (ev.isLunar) {
        const solar = lunarToSolarInYear(ev.day, ev.month, currentYear);
        solarDay = solar.day;
        solarMonth = solar.month;
      } else {
        const [ld, lm] = convertSolar2Lunar(ev.day, ev.month, currentYear);
        lunarDay = ld;
        lunarMonth = lm;
      }

      calendarEvents.push({
        id: ev.id,
        member: linkedMember,
        title: ev.title + (linkedMember ? ` (${linkedMember.name})` : ''),
        solarDay, solarMonth, lunarDay, lunarMonth,
        isLunar: !!ev.isLunar,
        type: 'CUSTOM',
        note: ev.note || '',
      });
    });

    // Initialize 12 months (nhóm theo tháng Dương lịch thực tế của năm hiện tại)
    const grouped: { [key: number]: CalendarEvent[] } = {};
    for (let i = 1; i <= 12; i++) {
      grouped[i] = [];
    }

    calendarEvents.forEach(ev => {
      grouped[ev.solarMonth].push(ev);
    });

    for (let i = 1; i <= 12; i++) {
      grouped[i].sort((a, b) => a.solarDay - b.solarDay);
    }

    return grouped;
  }, [members, events, currentYear]);

  // Current month highlight
  const currentMonth = today.getMonth() + 1;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <h2 className="text-3xl md:text-4xl font-serif text-burgundy mb-3 text-center font-bold tracking-wide">
        Lịch Sự Kiện Gia Phả
      </h2>
      <p className="text-center text-sm text-wood-dark/80 mb-8 font-serif italic">
        Hôm nay: {today.getDate()}/{today.getMonth() + 1}/{currentYear} (Dương lịch) — Ngày {todayLunarDay} tháng {todayLunarMonth} năm {todayLunarYear} (Âm lịch)
      </p>

      <div className="flex flex-wrap justify-center items-center gap-6 mb-10 text-sm md:text-base font-medium">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-orange-100 border border-orange-200 shadow-sm"></span>
          <span className="text-wood-dark">Sinh nhật</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-wood-light border border-wood shadow-sm"></span>
          <span className="text-wood-dark">Ngày Giỗ</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-burgundy/10 border border-burgundy/30 shadow-sm"></span>
          <span className="text-wood-dark">Sự kiện khác</span>
        </div>
        {isAdmin && (
          <button
            onClick={onAddEvent}
            className="bg-burgundy hover:bg-burgundy-dark text-white px-4 py-1.5 rounded text-sm font-medium transition-colors shadow-sm"
          >
            + Thêm Sự Kiện
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(12)].map((_, index) => {
          const month = index + 1;
          const monthEvents = eventsByMonth[month];
          const isCurrentMonth = month === currentMonth;

          return (
            <div
              key={month}
              className={`rounded-xl shadow-md overflow-hidden border ${isCurrentMonth ? 'border-burgundy ring-1 ring-burgundy/20' : 'border-wood/20'} bg-white flex flex-col h-full`}
            >
              <div className={`${isCurrentMonth ? 'bg-burgundy text-white' : 'bg-wood text-white'} px-4 py-3 text-center border-b border-white/10`}>
                <h3 className="text-xl font-serif font-bold">Tháng {month}</h3>
                {isCurrentMonth && <span className="text-xs uppercase tracking-wider opacity-80">(Tháng hiện tại)</span>}
              </div>

              <div className="p-4 flex-1 overflow-y-auto bg-stone-50/50">
                {monthEvents.length === 0 ? (
                  <p className="text-gray-400 text-center text-sm py-8 italic font-serif">
                    Không có sự kiện
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {monthEvents.map((ev, i) => (
                      <li key={ev.id || i} className={`p-3 rounded-lg border flex gap-3 ${ev.type === 'DEATH' ? 'bg-wood-light/10 border-wood/20' : ev.type === 'CUSTOM' ? 'bg-burgundy/5 border-burgundy/20' : 'bg-orange-50 border-orange-200/50'}`}>
                        <div className={`font-bold text-lg flex flex-col items-center justify-center min-w-[3rem] ${ev.type === 'DEATH' ? 'text-wood-dark' : ev.type === 'CUSTOM' ? 'text-burgundy' : 'text-orange-600'}`}>
                          <span>{ev.solarDay}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800 text-sm">
                            {ev.type === 'DEATH' ? 'Giỗ: ' : ev.type === 'BIRTHDAY' ? 'SN: ' : ''}
                            {ev.type === 'CUSTOM' ? ev.title : ev.member?.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                            <span className={ev.isLunar ? 'font-semibold text-burgundy' : ''}>ÂL {ev.lunarDay}/{ev.lunarMonth}</span>
                            <span className={!ev.isLunar ? 'font-semibold text-burgundy' : ''}>DL {ev.solarDay}/{ev.solarMonth}</span>
                            {ev.type === 'DEATH' && ev.member && <span>· Đời thứ {ev.member.generation}</span>}
                            {ev.type === 'BIRTHDAY' && ev.member?.birthDate && <span>· Sinh năm {String(ev.member.birthDate).match(/\d{4}/)?.[0] || '?'}</span>}
                            {ev.note && <span className="text-burgundy/80 font-medium italic">({ev.note})</span>}
                          </p>
                        </div>
                        {isAdmin && ev.type === 'CUSTOM' && ev.id && (
                          <button
                            onClick={() => onDeleteEvent?.(ev.id!)}
                            className="text-gray-400 hover:text-red-500 text-lg leading-none self-start"
                            title="Xóa sự kiện"
                          >
                            &times;
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
