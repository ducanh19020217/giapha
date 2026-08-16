import React, { useMemo } from 'react';
import { DetailedMember } from '../types/member';
import { FamilyEvent } from '../types/event';

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
  day: number;
  month: number;
  type: EventType;
  note: string;
}

export const EventsCalendar: React.FC<EventsCalendarProps> = ({ members, events, isAdmin, onAddEvent, onDeleteEvent }) => {
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
        const match = dateString.match(/\b(\d{1,2})[\/\-\.](\d{1,2})\b/);
        if (match) {
          day = parseInt(match[1]);
          month = parseInt(match[2]);
        }
      }

      if (day > 0 && month > 0) {
        // Extract notes like "(Âm lịch)"
        const noteMatch = dateString.match(/\((.*?)\)/);
        const note = noteMatch ? noteMatch[1] : '';

        // Validate day and month
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
          calendarEvents.push({ member, day, month, type, note, title: member.name });
        }
      }
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
      calendarEvents.push({
        id: ev.id,
        member: linkedMember,
        title: ev.title + (linkedMember ? ` (${linkedMember.name})` : ''),
        day: ev.day,
        month: ev.month,
        type: 'CUSTOM',
        note: ev.note || '',
      });
    });

    // Initialize 12 months
    const grouped: { [key: number]: CalendarEvent[] } = {};
    for (let i = 1; i <= 12; i++) {
      grouped[i] = [];
    }

    // Group and sort
    calendarEvents.forEach(ev => {
      grouped[ev.month].push(ev);
    });

    for (let i = 1; i <= 12; i++) {
      grouped[i].sort((a, b) => a.day - b.day);
    }

    return grouped;
  }, [members, events]);

  // Current month highlight
  const currentMonth = new Date().getMonth() + 1;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <h2 className="text-3xl md:text-4xl font-serif text-burgundy mb-8 text-center font-bold tracking-wide">
        Lịch Sự Kiện Gia Phả
      </h2>

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
                          <span>{ev.day}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800 text-sm">
                            {ev.type === 'DEATH' ? 'Giỗ: ' : ev.type === 'BIRTHDAY' ? 'SN: ' : ''}
                            {ev.type === 'CUSTOM' ? ev.title : ev.member?.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {ev.type === 'DEATH' && ev.member ? 'Đời thứ ' + ev.member.generation : ''}
                            {ev.type === 'BIRTHDAY' && ev.member?.birthDate ? 'Sinh năm ' + (String(ev.member.birthDate).match(/\d{4}/)?.[0] || '?') : ''}
                            {ev.note && <span className="ml-1 text-burgundy/80 font-medium italic">({ev.note})</span>}
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
