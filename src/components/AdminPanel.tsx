import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { AppUser, AuditLogEntry, PendingEdit, TrashData, NotificationPreview, NotificationResult, NotificationTarget, ScheduledNotification } from '../types/admin';
import * as api from '../services/api';
import { DetailedMember } from '../types/member';

type Tab = 'pending' | 'notify' | 'trash' | 'users' | 'audit' | 'generation' | 'account';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'pending', label: 'Đề xuất chờ duyệt' },
  { key: 'notify', label: 'Gửi thông báo' },
  { key: 'trash', label: 'Thùng rác' },
  { key: 'users', label: 'Tài khoản' },
  { key: 'audit', label: 'Nhật ký thao tác' },
  { key: 'generation', label: 'Số đời' },
  { key: 'account', label: 'Đổi mật khẩu' },
];

const FIELD_LABELS: Record<string, string> = {
  name: 'Họ tên', birthDate: 'Ngày sinh', deathDate: 'Ngày mất', career: 'Nghề nghiệp',
  academicLevel: 'Học vị', biography: 'Tiểu sử', email: 'Email', telegramChatId: 'Telegram Chat ID',
  gender: 'Giới tính', isDeceased: 'Đã khuất',
};

interface AdminPanelProps {
  members: DetailedMember[];
  onDataChanged: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ members, onDataChanged }) => {
  const [tab, setTab] = useState<Tab>('pending');

  return (
    <div className="mt-4 pb-16">
      <h1 className="text-2xl font-serif font-bold text-burgundy mb-6 text-center">Trang Quản Trị</h1>

      <div className="flex flex-wrap gap-2 justify-center mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
              tab === t.key
                ? 'bg-burgundy text-white border-burgundy'
                : 'bg-white text-wood-dark border-wood/20 hover:bg-wood/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-wood/10 p-5 md:p-6 max-w-3xl mx-auto">
        {tab === 'pending' && <PendingEditsTab onDataChanged={onDataChanged} />}
        {tab === 'notify' && <NotifyTab members={members} />}
        {tab === 'trash' && <TrashTab onDataChanged={onDataChanged} />}
        {tab === 'users' && <UsersTab />}
        {tab === 'audit' && <AuditLogTab />}
        {tab === 'generation' && <GenerationTab members={members} onDataChanged={onDataChanged} />}
        {tab === 'account' && <AccountTab />}
      </div>
    </div>
  );
};

// ==========================================
// ĐỀ XUẤT CHỜ DUYỆT
// ==========================================
function PendingEditsTab({ onDataChanged }: { onDataChanged: () => void }) {
  const [items, setItems] = useState<PendingEdit[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.getPendingEdits().then(setItems).catch(err => setError(String(err)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: string) => {
    setBusyId(id);
    try {
      await api.approvePendingEdit(id);
      load();
      onDataChanged();
    } catch (err) {
      alert('Lỗi: ' + err);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm('Từ chối đề xuất này?')) return;
    setBusyId(id);
    try {
      await api.rejectPendingEdit(id);
      load();
    } catch (err) {
      alert('Lỗi: ' + err);
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (items === null) return <p className="text-gray-500 text-sm">Đang tải...</p>;
  if (items.length === 0) return <p className="text-gray-500 text-sm italic">Không có đề xuất nào đang chờ duyệt.</p>;

  return (
    <div className="space-y-4">
      {items.map(item => (
        <div key={item.id} className="border border-wood/10 rounded-lg p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <p className="font-semibold text-wood-dark">{item.memberName}</p>
            <span className="text-xs text-gray-400">{item.createdAt}</span>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Người gửi: {item.submitterName || 'Ẩn danh'}{item.submitterContact ? ` (${item.submitterContact})` : ''}
          </p>
          <ul className="text-sm space-y-1 mb-3 bg-orange-50/50 rounded p-3">
            {Object.entries(item.changes).map(([key, value]) => (
              <li key={key}>
                <span className="font-medium text-wood">{FIELD_LABELS[key] || key}:</span> {String(value)}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              disabled={busyId === item.id}
              onClick={() => handleApprove(item.id)}
              className="bg-burgundy hover:bg-burgundy-dark text-white px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
            >
              Duyệt & Áp dụng
            </button>
            <button
              disabled={busyId === item.id}
              onClick={() => handleReject(item.id)}
              className="bg-gray-100 hover:bg-gray-200 text-wood-dark px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
            >
              Từ chối
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ==========================================
// THÙNG RÁC
// ==========================================
function TrashTab({ onDataChanged }: { onDataChanged: () => void }) {
  const [data, setData] = useState<TrashData | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.getTrash().then(setData).catch(err => setError(String(err)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRestoreMember = async (id: string) => {
    setBusyId(id);
    try { await api.restoreMember(id); load(); onDataChanged(); }
    catch (err) { alert('Lỗi: ' + err); }
    finally { setBusyId(null); }
  };

  const handlePurgeMember = async (id: string, name: string) => {
    if (!window.confirm(`Xóa VĨNH VIỄN "${name}"? Thao tác này KHÔNG THỂ hoàn tác.`)) return;
    setBusyId(id);
    try { await api.purgeMember(id); load(); onDataChanged(); }
    catch (err) { alert('Lỗi: ' + err); }
    finally { setBusyId(null); }
  };

  const handleRestoreEvent = async (id: string) => {
    setBusyId(id);
    try { await api.restoreEvent(id); load(); onDataChanged(); }
    catch (err) { alert('Lỗi: ' + err); }
    finally { setBusyId(null); }
  };

  const handlePurgeEvent = async (id: string, title: string) => {
    if (!window.confirm(`Xóa VĨNH VIỄN sự kiện "${title}"? Thao tác này KHÔNG THỂ hoàn tác.`)) return;
    setBusyId(id);
    try { await api.purgeEvent(id); load(); onDataChanged(); }
    catch (err) { alert('Lỗi: ' + err); }
    finally { setBusyId(null); }
  };

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (data === null) return <p className="text-gray-500 text-sm">Đang tải...</p>;

  return (
    <div className="space-y-8">
      <section>
        <h3 className="font-semibold text-wood-dark mb-3">Thành viên đã xóa ({data.members.length})</h3>
        {data.members.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Trống</p>
        ) : (
          <ul className="space-y-2">
            {data.members.map(m => (
              <li key={m.id} className="flex items-center justify-between gap-2 border-b border-wood/10 pb-2">
                <span className="text-sm text-wood-dark">{m.name}</span>
                <div className="flex gap-2 flex-shrink-0">
                  <button disabled={busyId === m.id} onClick={() => handleRestoreMember(m.id)} className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-2.5 py-1 rounded font-medium disabled:opacity-50">Khôi phục</button>
                  <button disabled={busyId === m.id} onClick={() => handlePurgeMember(m.id, m.name)} className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1 rounded font-medium disabled:opacity-50">Xóa vĩnh viễn</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-semibold text-wood-dark mb-3">Sự kiện đã xóa ({data.events.length})</h3>
        {data.events.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Trống</p>
        ) : (
          <ul className="space-y-2">
            {data.events.map(ev => (
              <li key={ev.id} className="flex items-center justify-between gap-2 border-b border-wood/10 pb-2">
                <span className="text-sm text-wood-dark">{ev.title}</span>
                <div className="flex gap-2 flex-shrink-0">
                  <button disabled={busyId === ev.id} onClick={() => handleRestoreEvent(ev.id)} className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-2.5 py-1 rounded font-medium disabled:opacity-50">Khôi phục</button>
                  <button disabled={busyId === ev.id} onClick={() => handlePurgeEvent(ev.id, ev.title)} className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1 rounded font-medium disabled:opacity-50">Xóa vĩnh viễn</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ==========================================
// TÀI KHOẢN
// ==========================================
function UsersTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(() => {
    api.getUsers().then(setUsers).catch(err => setError(String(err)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.addUser({ username, password, displayName: displayName || undefined });
      setUsername(''); setPassword(''); setDisplayName('');
      load();
    } catch (err) {
      alert('Lỗi: ' + err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Xóa tài khoản "${name}"?`)) return;
    try {
      await api.deleteUser(id);
      load();
    } catch (err) {
      alert('Lỗi: ' + err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-wood-dark mb-3">Danh sách tài khoản quản trị</h3>
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        {users === null ? (
          <p className="text-gray-500 text-sm">Đang tải...</p>
        ) : (
          <ul className="space-y-2">
            {users.map(u => (
              <li key={u.id} className="flex items-center justify-between gap-2 border-b border-wood/10 pb-2">
                <div className="text-sm">
                  <span className="font-medium text-wood-dark">{u.displayName || u.username}</span>
                  <span className="text-gray-400 ml-2">@{u.username}</span>
                </div>
                {u.id !== currentUser?.id && (
                  <button onClick={() => handleDelete(u.id, u.displayName || u.username)} className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1 rounded font-medium">
                    Xóa
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleAdd} className="border-t border-wood/10 pt-5 space-y-3">
        <h3 className="font-semibold text-wood-dark">Thêm tài khoản mới</h3>
        <p className="text-xs text-gray-500">Mỗi chi/nhánh trong họ có thể được cấp 1 tài khoản riêng thay vì dùng chung 1 mật khẩu.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input required placeholder="Tài khoản" value={username} onChange={e => setUsername(e.target.value)} className="border rounded p-2 text-sm focus:border-bronze outline-none" />
          <input required type="password" placeholder="Mật khẩu (>= 4 ký tự)" value={password} onChange={e => setPassword(e.target.value)} className="border rounded p-2 text-sm focus:border-bronze outline-none" />
          <input placeholder="Tên hiển thị (tùy chọn)" value={displayName} onChange={e => setDisplayName(e.target.value)} className="border rounded p-2 text-sm focus:border-bronze outline-none" />
        </div>
        <button type="submit" disabled={isSubmitting} className="bg-burgundy hover:bg-burgundy-dark text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50">
          {isSubmitting ? 'Đang thêm...' : 'Thêm tài khoản'}
        </button>
      </form>
    </div>
  );
}

// ==========================================
// NHẬT KÝ THAO TÁC
// ==========================================
function AuditLogTab() {
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAuditLog().then(setLogs).catch(err => setError(String(err)));
  }, []);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (logs === null) return <p className="text-gray-500 text-sm">Đang tải...</p>;
  if (logs.length === 0) return <p className="text-gray-500 text-sm italic">Chưa có hoạt động nào được ghi lại.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-wood-dark border-b border-wood/20">
            <th className="py-2 pr-3 font-semibold">Thời gian</th>
            <th className="py-2 pr-3 font-semibold">Hành động</th>
            <th className="py-2 pr-3 font-semibold">Đối tượng</th>
            <th className="py-2 font-semibold">Người thực hiện</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} className="border-b border-wood/5">
              <td className="py-2 pr-3 whitespace-nowrap text-gray-500">{log.timestamp}</td>
              <td className="py-2 pr-3 whitespace-nowrap">{log.action}</td>
              <td className="py-2 pr-3">{log.targetName || log.targetId || '—'}</td>
              <td className="py-2">{log.actor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ==========================================
// ĐỔI MẬT KHẨU
// ==========================================
// --- GỬI THÔNG BÁO: cả dòng họ (nhóm Telegram) hoặc theo nhánh, gửi ngay hoặc hẹn giờ ---
const MESSAGE_TEMPLATES: Array<{ label: string; text: string }> = [
  { label: 'Họp họ', text: 'Kính mời các thành viên về dự buổi họp họ lúc 8h00 sáng Chủ Nhật ngày .../.../... tại nhà thờ họ.\nNội dung: ...\nRất mong mọi người thu xếp tham dự đông đủ.' },
  { label: 'Giỗ Tổ', text: 'Ngày .../... (Âm lịch) là ngày Giỗ Tổ của dòng họ. Kính mời con cháu các chi về dâng hương lúc ...h tại ...' },
  { label: 'Báo hiếu', text: 'Dòng họ xin báo tin: Cụ/Ông/Bà ... đã từ trần lúc ...h ngày .../.../..., hưởng thọ ... tuổi.\nLễ viếng từ ...h ngày ..., lễ truy điệu lúc ...h ngày ..., an táng tại ...' },
  { label: 'Chúc mừng', text: 'Dòng họ xin chúc mừng ... nhân dịp ... Chúc ... luôn mạnh khỏe, hạnh phúc và thành công!' },
];

const STATUS_LABEL: Record<ScheduledNotification['status'], { text: string; className: string }> = {
  PENDING: { text: 'Chờ gửi', className: 'bg-amber-100 text-amber-800' },
  SENT: { text: 'Đã gửi', className: 'bg-green-100 text-green-800' },
  FAILED: { text: 'Lỗi', className: 'bg-red-100 text-red-700' },
  CANCELLED: { text: 'Đã hủy', className: 'bg-gray-100 text-gray-600' },
};

// Giá trị mặc định cho ô hẹn giờ: 1 tiếng nữa, theo giờ máy người dùng (định dạng datetime-local)
const defaultScheduleValue = () => {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function NotifyTab({ members }: { members: DetailedMember[] }) {
  const [target, setTarget] = useState<NotificationTarget>('ALL');
  const [branchMemberId, setBranchMemberId] = useState('');
  const [alsoIndividuals, setAlsoIndividuals] = useState(false);
  const [telegram, setTelegram] = useState(true);
  const [email, setEmail] = useState(false);
  const [message, setMessage] = useState('');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [sendAtLocal, setSendAtLocal] = useState(defaultScheduleValue);
  const [preview, setPreview] = useState<NotificationPreview | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<NotificationResult | null>(null);
  const [error, setError] = useState('');
  const [scheduled, setScheduled] = useState<ScheduledNotification[]>([]);

  // Chỉ người máu mủ (có cha/mẹ trên cây) hoặc người gốc mới đứng đầu nhánh được; sắp theo đời
  const branchHeads = [...members]
    .filter(m => m.fatherId || m.motherId || !members.some(o => o.spouses?.some(s => s.id === m.id) && (o.fatherId || o.motherId)))
    .sort((a, b) => a.generation - b.generation || a.birthOrder - b.birthOrder);
  const memberName = (id?: string) => members.find(m => m.id === id)?.name || '';

  const loadScheduled = useCallback(() => {
    api.getScheduledNotifications().then(setScheduled).catch(() => setScheduled([]));
  }, []);
  useEffect(() => { loadScheduled(); }, [loadScheduled]);

  // Xem trước người nhận mỗi khi đổi nơi gửi / kênh
  useEffect(() => {
    if (target === 'BRANCH' && !branchMemberId) { setPreview(null); return; }
    let cancelled = false;
    setPreviewError('');
    api.previewNotificationRecipients({ target, branchMemberId, alsoIndividuals, channels: { telegram, email } })
      .then(p => { if (!cancelled) setPreview(p); })
      .catch(err => { if (!cancelled) { setPreview(null); setPreviewError(err instanceof Error ? err.message : String(err)); } });
    return () => { cancelled = true; };
  }, [target, branchMemberId, alsoIndividuals, telegram, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setResult(null);
    if (!telegram && !email) { setError('Chọn ít nhất 1 kênh gửi'); return; }
    if (target === 'BRANCH' && !branchMemberId) { setError('Chọn người đứng đầu nhánh'); return; }
    const sendAt = when === 'later' ? new Date(sendAtLocal) : null;
    if (sendAt && (isNaN(sendAt.getTime()) || sendAt.getTime() < Date.now() + 60 * 1000)) {
      setError('Thời điểm hẹn phải ở tương lai'); return;
    }
    const where = target === 'ALL' ? 'cả dòng họ' : `nhánh ${memberName(branchMemberId)}`;
    const confirmText = sendAt
      ? `Hẹn gửi thông báo tới ${where} lúc ${sendAt.toLocaleString('vi-VN')}?`
      : `Gửi ngay thông báo tới ${where}?`;
    if (!window.confirm(confirmText)) return;

    setIsSending(true);
    try {
      const res = await api.sendNotification({
        target, branchMemberId: target === 'BRANCH' ? branchMemberId : undefined,
        alsoIndividuals, channels: { telegram, email }, message,
        sendAt: sendAt ? sendAt.toISOString() : undefined,
      });
      setResult(res);
      setMessage('');
      loadScheduled();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSending(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Hủy thông báo đã hẹn này?')) return;
    try {
      await api.cancelScheduledNotification(id);
      loadScheduled();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const radio = (active: boolean) =>
    `flex-1 text-left border rounded-lg p-3 cursor-pointer transition-colors ${active ? 'border-burgundy bg-burgundy/5' : 'border-gray-200 hover:border-bronze'}`;

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 p-2.5 rounded text-sm border border-red-200">{error}</div>}
        {result && (
          <div className="bg-green-50 text-green-800 p-3 rounded text-sm border border-green-200 space-y-1">
            {result.scheduled ? (
              <p>Đã hẹn gửi lúc <strong>{new Date(result.sendAt || '').toLocaleString('vi-VN')}</strong>. Xem ở danh sách bên cạnh.</p>
            ) : (
              <>
                <p><strong>Đã gửi — {result.label}.</strong></p>
                {!!result.groupsSent?.length && <p>Nhóm: {result.groupsSent.join(', ')}</p>}
                <p>Gửi riêng: {result.telegramSent || 0} qua Telegram, {result.emailSent || 0} qua email.</p>
                {!!result.groupsFailed?.length && <p className="text-red-700">Nhóm gửi lỗi: {result.groupsFailed.join(', ')}</p>}
                {!!result.failed?.length && <p className="text-red-700">Gửi lỗi: {result.failed.join(', ')}</p>}
              </>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-wood-dark mb-2">Gửi tới</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <label className={radio(target === 'ALL')}>
              <input type="radio" className="sr-only" checked={target === 'ALL'} onChange={() => setTarget('ALL')} />
              <div className="font-medium text-sm">Cả dòng họ</div>
              <div className="text-xs text-gray-500">Vào nhóm Telegram chung</div>
            </label>
            <label className={radio(target === 'BRANCH')}>
              <input type="radio" className="sr-only" checked={target === 'BRANCH'} onChange={() => setTarget('BRANCH')} />
              <div className="font-medium text-sm">Theo nhánh</div>
              <div className="text-xs text-gray-500">Con cháu + vợ/chồng của 1 người</div>
            </label>
          </div>
        </div>

        {target === 'BRANCH' ? (
          <div>
            <label className="block text-sm font-medium text-wood-dark mb-1">Người đứng đầu nhánh</label>
            <select value={branchMemberId} onChange={e => setBranchMemberId(e.target.value)} className="w-full border rounded p-2 outline-none bg-white">
              <option value="">— Chọn —</option>
              {branchHeads.map(m => <option key={m.id} value={m.id}>Đời {m.generation} · {m.name}</option>)}
            </select>
          </div>
        ) : (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={alsoIndividuals} onChange={e => setAlsoIndividuals(e.target.checked)} className="rounded text-burgundy" />
            Gửi thêm riêng cho từng thành viên có liên lạc
          </label>
        )}

        <div className="flex gap-4 text-sm">
          <span className="font-medium text-wood-dark">Kênh:</span>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={telegram} onChange={e => setTelegram(e.target.checked)} className="rounded text-burgundy" />Telegram</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={email} onChange={e => setEmail(e.target.checked)} className="rounded text-burgundy" />Email</label>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
            <label className="text-sm font-medium text-wood-dark">Nội dung</label>
            <div className="flex gap-1 flex-wrap">
              {MESSAGE_TEMPLATES.map(t => (
                <button key={t.label} type="button" onClick={() => setMessage(t.text)} className="text-xs px-2 py-1 rounded-full bg-bronze/10 text-bronze-dark hover:bg-bronze/20">
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <textarea required value={message} onChange={e => setMessage(e.target.value)} rows={6} className="w-full border rounded p-2 focus:border-bronze outline-none text-sm" placeholder="Nhập nội dung thông báo, hoặc chọn một mẫu ở trên" />
        </div>

        <div className="space-y-2">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5"><input type="radio" checked={when === 'now'} onChange={() => setWhen('now')} className="text-burgundy" />Gửi ngay</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={when === 'later'} onChange={() => setWhen('later')} className="text-burgundy" />Hẹn giờ</label>
          </div>
          {when === 'later' && (
            <div>
              <input type="datetime-local" value={sendAtLocal} onChange={e => setSendAtLocal(e.target.value)} className="border rounded p-2 outline-none text-sm" />
              <p className="text-xs text-gray-500 mt-1">Tin sẽ đến trong vòng khoảng 15 phút sau giờ hẹn.</p>
            </div>
          )}
        </div>

        <button type="submit" disabled={isSending} className="bg-burgundy hover:bg-burgundy-dark text-white px-5 py-2 rounded font-medium disabled:opacity-50">
          {isSending ? 'Đang gửi...' : when === 'later' ? 'Hẹn gửi' : 'Gửi thông báo'}
        </button>
      </form>

      <div className="space-y-4">
        <div className="bg-[#faf6ef] border border-wood/10 rounded-lg p-3 text-sm">
          <div className="font-medium text-wood-dark mb-2">Sẽ gửi tới</div>
          {previewError && <p className="text-red-600">{previewError}</p>}
          {!preview && !previewError && <p className="text-gray-500">{target === 'BRANCH' ? 'Chọn người đứng đầu nhánh để xem.' : 'Đang tải...'}</p>}
          {preview && (
            <div className="space-y-1.5">
              {!preview.telegramConfigured && telegram && <p className="text-red-600">Chưa cấu hình Telegram Bot Token trong Apps Script.</p>}
              {target === 'ALL' && !preview.familyGroupConfigured && telegram && <p className="text-amber-700">Chưa cấu hình Chat ID nhóm dòng họ.</p>}
              {preview.groups.map(g => <p key={g}>✓ {g}</p>)}
              {preview.reachable.length > 0 && <p>✓ {preview.reachable.length} người: {preview.reachable.slice(0, 8).join(', ')}{preview.reachable.length > 8 ? '…' : ''}</p>}
              {preview.missing.length > 0 && (
                <p className="text-gray-500">Chưa có liên lạc ({preview.missing.length}): {preview.missing.slice(0, 8).join(', ')}{preview.missing.length > 8 ? '…' : ''}</p>
              )}
              {preview.groups.length === 0 && preview.reachable.length === 0 && <p className="text-red-600">Chưa có ai nhận được thông báo này.</p>}
            </div>
          )}
        </div>

        <div>
          <div className="font-medium text-wood-dark text-sm mb-2">Thông báo đã hẹn</div>
          {scheduled.length === 0 ? (
            <p className="text-sm text-gray-500">Chưa có.</p>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {scheduled.map(n => (
                <li key={n.id} className="border rounded-lg p-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-600">{n.sendAt ? new Date(n.sendAt).toLocaleString('vi-VN') : ''}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_LABEL[n.status]?.className || ''}`}>{STATUS_LABEL[n.status]?.text || n.status}</span>
                  </div>
                  <div className="text-xs text-bronze-dark mt-1">{n.target === 'BRANCH' ? `Nhánh ${memberName(n.branchMemberId) || '?'}` : 'Cả dòng họ'}</div>
                  <p className="text-gray-700 line-clamp-2 mt-0.5 whitespace-pre-line">{n.message}</p>
                  {n.status === 'FAILED' && n.result && <p className="text-xs text-red-600 mt-1">{n.result}</p>}
                  {n.status === 'PENDING' && (
                    <button type="button" onClick={() => handleCancel(n.id)} className="text-xs text-red-600 hover:underline mt-1">Hủy</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// Đặt lại "người đầu tiên là đời thứ mấy": dời số đời của toàn bộ gia phả cùng lúc
function GenerationTab({ members, onDataChanged }: { members: DetailedMember[]; onDataChanged: () => void }) {
  const currentFirst = members.length > 0 ? Math.min(...members.map(m => m.generation || 1)) : 1;
  const [target, setTarget] = useState(currentFirst);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { setTarget(currentFirst); }, [currentFirst]);

  const firstMembers = members.filter(m => (m.generation || 1) === currentFirst).map(m => m.name);
  const offset = target - currentFirst;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (!offset) return;
    if (!window.confirm(`Dời toàn bộ ${members.length} thành viên ${offset > 0 ? 'xuống' : 'lên'} ${Math.abs(offset)} đời (Đời ${currentFirst} → Đời ${target})?`)) return;
    setIsSubmitting(true);
    try {
      await api.shiftGenerations(offset);
      setMessage(`Đã cập nhật: người đầu tiên giờ là Đời ${target}.`);
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
      {error && <div className="bg-red-50 text-red-600 p-2.5 rounded text-sm border border-red-200">{error}</div>}
      {message && <div className="bg-green-50 text-green-700 p-2.5 rounded text-sm border border-green-200">{message}</div>}
      <p className="text-sm text-gray-600">
        Nếu không còn thông tin các đời trước, đặt người đầu tiên trong gia phả là đời thứ mấy.
        Tất cả con cháu sẽ tự dời theo (giữ nguyên khoảng cách giữa các đời).
      </p>
      <p className="text-sm">
        Hiện tại: <strong>Đời {currentFirst}</strong>
        {firstMembers.length > 0 && <span className="text-gray-500"> ({firstMembers.slice(0, 3).join(', ')}{firstMembers.length > 3 ? '...' : ''})</span>}
      </p>
      <div>
        <label className="block text-sm font-medium text-wood-dark mb-1">Người đầu tiên là đời thứ</label>
        <input type="number" min="1" value={target} onChange={e => setTarget(Math.max(1, parseInt(e.target.value) || 1))} className="w-32 border rounded p-2 focus:border-bronze outline-none" />
      </div>
      <button type="submit" disabled={isSubmitting || !offset || members.length === 0} className="bg-burgundy hover:bg-burgundy-dark text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50">
        {isSubmitting ? 'Đang cập nhật...' : 'Áp dụng'}
      </button>
    </form>
  );
}

function AccountTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.changePassword(newPassword, currentPassword || undefined);
      setMessage('Đổi mật khẩu thành công.');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
      {error && <div className="bg-red-50 text-red-600 p-2.5 rounded text-sm border border-red-200">{error}</div>}
      {message && <div className="bg-green-50 text-green-700 p-2.5 rounded text-sm border border-green-200">{message}</div>}
      <div>
        <label className="block text-sm font-medium text-wood-dark mb-1">Mật khẩu hiện tại</label>
        <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" />
      </div>
      <div>
        <label className="block text-sm font-medium text-wood-dark mb-1">Mật khẩu mới</label>
        <input required type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" />
      </div>
      <div>
        <label className="block text-sm font-medium text-wood-dark mb-1">Xác nhận mật khẩu mới</label>
        <input required type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full border rounded p-2 focus:border-bronze outline-none" />
      </div>
      <button type="submit" disabled={isSubmitting} className="bg-burgundy hover:bg-burgundy-dark text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50">
        {isSubmitting ? 'Đang lưu...' : 'Đổi mật khẩu'}
      </button>
    </form>
  );
}
