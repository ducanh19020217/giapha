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

// --- Gửi thông báo (cả dòng họ / theo nhánh, gửi ngay hoặc hẹn giờ) ---
export type NotificationTarget = 'ALL' | 'BRANCH';

export interface NotificationChannels {
  telegram: boolean;
  email: boolean;
}

export interface NotificationRequest {
  target: NotificationTarget;
  branchMemberId?: string;
  alsoIndividuals?: boolean;
  channels: NotificationChannels;
  message: string;
  sendAt?: string; // ISO; bỏ trống = gửi ngay
}

export interface NotificationPreview {
  label: string;
  groups: string[];
  reachable: string[];
  missing: string[];
  telegramConfigured: boolean;
  familyGroupConfigured: boolean;
}

export interface NotificationResult {
  scheduled: boolean;
  id?: string;
  sendAt?: string;
  label?: string;
  groupsSent?: string[];
  groupsFailed?: string[];
  telegramSent?: number;
  emailSent?: number;
  failed?: string[];
  missing?: string[];
}

export interface ScheduledNotification {
  id: string;
  sendAt: string;
  target: NotificationTarget;
  branchMemberId?: string;
  alsoIndividuals: boolean;
  channels: NotificationChannels;
  message: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  createdBy?: string;
  createdAt?: string;
  sentAt?: string;
  result?: string;
}
