import { DetailedMember } from '../types/member';
import { FamilyEvent } from '../types/event';
import { AppUser, AuditLogEntry, PendingEdit, TrashData } from '../types/admin';
import { User } from '../context/AuthContext';

// Chờ người dùng điền URL Web App của Google Apps Script vào đây (hoặc .env)
const SCRIPT_URL = import.meta.env.VITE_GAS_URL || 'https://script.google.com/macros/s/YOUR_WEB_APP_ID/exec';

const callGas = async <T = unknown>(action: string, data?: unknown): Promise<T> => {
  if (SCRIPT_URL.includes('YOUR_WEB_APP_ID')) {
    console.warn("Vui lòng điền Web App URL của Google Apps Script vào file src/services/api.ts hoặc biến môi trường VITE_GAS_URL.");
    if (action === 'GET_MEMBERS' || action === 'GET_EVENTS') return [] as unknown as T;
  }

  // "genealogy_token" lưu session token được cấp lúc đăng nhập (action LOGIN), KHÔNG
  // còn là mật khẩu thô nữa. Backend giữ nguyên tên field "password" trên payload để
  // không phải đổi lại toàn bộ API cũ.
  const credential = localStorage.getItem('genealogy_token') || '';

  const response = await fetch(SCRIPT_URL, {
    method: 'POST',
    // Sử dụng text/plain để tránh bị trình duyệt gửi OPTIONS preflight request (CORS)
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({ action, data, password: credential }),
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data as T;
};

export const fetchMembers = async (): Promise<DetailedMember[]> => {
  return await callGas('GET_MEMBERS');
};

export const addMember = async (data: Partial<DetailedMember>): Promise<DetailedMember> => {
  return await callGas('ADD_MEMBER', data);
};

export const addSpouse = async (memberId: string, data: { name: string; isPrimary: boolean; order: number; birthDate?: string }, targetMember: DetailedMember): Promise<DetailedMember> => {
  // Pass targetMember info so GAS can easily create spouse with same generation
  return await callGas('ADD_SPOUSE', { memberId, ...data, targetMember });
};

export const addParent = async (childId: string, data: { name: string; gender: 'male' | 'female'; birthDate?: string; isDeceased?: boolean }): Promise<DetailedMember> => {
  return await callGas('ADD_PARENT', { childId, ...data });
};

export const markDeceased = async (id: string, data: { deathDate?: string }): Promise<DetailedMember> => {
  return await callGas('MARK_DECEASED', { id, ...data });
};

export const updateMemberDetails = async (id: string, data: Partial<DetailedMember>): Promise<DetailedMember> => {
  return await callGas('UPDATE_MEMBER', { id, ...data });
};

// Dời số đời của toàn bộ thành viên (VD: +4 để người đầu tiên từ Đời 1 thành Đời 5)
export const shiftGenerations = async (offset: number): Promise<{ shifted: number }> => {
  return await callGas('SHIFT_GENERATIONS', { offset });
};

export const deleteMember = async (id: string): Promise<void> => {
  return await callGas('DELETE_MEMBER', { id });
};

export const fetchEvents = async (): Promise<FamilyEvent[]> => {
  return await callGas('GET_EVENTS');
};

export const addEvent = async (data: Partial<FamilyEvent>): Promise<FamilyEvent> => {
  return await callGas('ADD_EVENT', data);
};

export const deleteEvent = async (id: string): Promise<void> => {
  return await callGas('DELETE_EVENT', { id });
};

export const uploadAvatar = async (base64: string, mimeType: string): Promise<{ url: string }> => {
  return await callGas('UPLOAD_AVATAR', { base64, mimeType });
};

// Aliases for compatibility with App.tsx if it uses old function names
export const getMembers = fetchMembers;
export const updateMember = updateMemberDetails;

// ==========================================
// ĐĂNG NHẬP ĐA TÀI KHOẢN
// ==========================================

export const login = async (username: string, password: string): Promise<{ token: string; user: User }> => {
  return await callGas('LOGIN', { username, password });
};

export const logoutRemote = async (): Promise<void> => {
  // Best-effort: xóa session ở phía Server. Không throw nếu lỗi (VD: token đã hết hạn).
  try {
    await callGas('LOGOUT');
  } catch {
    // ignore
  }
};

export const changePassword = async (newPassword: string, currentPassword?: string): Promise<{ success: boolean }> => {
  return await callGas('CHANGE_PASSWORD', { newPassword, currentPassword });
};

export const getUsers = async (): Promise<AppUser[]> => {
  return await callGas('GET_USERS');
};

export const addUser = async (data: { username: string; password: string; displayName?: string }): Promise<AppUser> => {
  return await callGas('ADD_USER', data);
};

export const deleteUser = async (id: string): Promise<void> => {
  return await callGas('DELETE_USER', { id });
};

// ==========================================
// THÙNG RÁC (xóa mềm / khôi phục)
// ==========================================

export const getTrash = async (): Promise<TrashData> => {
  return await callGas('GET_TRASH');
};

export const restoreMember = async (id: string): Promise<void> => {
  return await callGas('RESTORE_MEMBER', { id });
};

export const purgeMember = async (id: string): Promise<void> => {
  return await callGas('PURGE_MEMBER', { id });
};

export const restoreEvent = async (id: string): Promise<void> => {
  return await callGas('RESTORE_EVENT', { id });
};

export const purgeEvent = async (id: string): Promise<void> => {
  return await callGas('PURGE_EVENT', { id });
};

// ==========================================
// NHẬT KÝ THAO TÁC
// ==========================================

export const getAuditLog = async (): Promise<AuditLogEntry[]> => {
  return await callGas('GET_AUDIT_LOG');
};

// ==========================================
// ĐỀ XUẤT CHỈNH SỬA TỪ KHÁCH
// ==========================================

export const submitEditRequest = async (memberId: string, changes: Record<string, unknown>, submitterName?: string, submitterContact?: string): Promise<void> => {
  return await callGas('SUBMIT_EDIT_REQUEST', { memberId, changes, submitterName, submitterContact });
};

export const getPendingEdits = async (): Promise<PendingEdit[]> => {
  return await callGas('GET_PENDING_EDITS');
};

export const approvePendingEdit = async (id: string): Promise<void> => {
  return await callGas('APPROVE_PENDING_EDIT', { id });
};

export const rejectPendingEdit = async (id: string): Promise<void> => {
  return await callGas('REJECT_PENDING_EDIT', { id });
};
