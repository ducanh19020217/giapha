// Các kiểu dữ liệu dùng cho khu vực Quản trị (Thùng rác, Tài khoản, Nhật ký, Đề xuất chờ duyệt).

export interface AppUser {
  id: string;
  username: string;
  role: 'ADMIN' | 'VIEWER';
  displayName?: string;
  createdAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  targetId?: string;
  targetName?: string;
  actor: string;
  details?: string;
}

export interface PendingEdit {
  id: string;
  memberId: string;
  memberName: string;
  changes: Record<string, unknown>;
  submitterName?: string;
  submitterContact?: string;
  createdAt?: string;
}

export interface TrashData {
  members: Array<Record<string, unknown> & { id: string; name: string }>;
  events: Array<Record<string, unknown> & { id: string; title: string }>;
}
