import { DetailedMember } from '../types/member';

// Chờ người dùng điền URL Web App của Google Apps Script vào đây (hoặc .env)
const SCRIPT_URL = import.meta.env.VITE_GAS_URL || 'https://script.google.com/macros/s/YOUR_WEB_APP_ID/exec';

const callGas = async (action: string, data?: any) => {
  if (SCRIPT_URL.includes('YOUR_WEB_APP_ID')) {
    console.warn("Vui lòng điền Web App URL của Google Apps Script vào file src/services/api.ts hoặc biến môi trường VITE_GAS_URL.");
    if (action === 'GET_MEMBERS') return [];
  }

  // Lấy token (mật khẩu) đã được lưu ở frontend khi đăng nhập
  const password = localStorage.getItem('genealogy_token') || '';

  const response = await fetch(SCRIPT_URL, {
    method: 'POST',
    // Sử dụng text/plain để tránh bị trình duyệt gửi OPTIONS preflight request (CORS)
    headers: {
      'Content-Type': 'text/plain;charset=utf-8', 
    },
    body: JSON.stringify({ action, data, password }),
  });
  
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data;
};

export const fetchMembers = async (): Promise<DetailedMember[]> => {
  return await callGas('GET_MEMBERS');
};

export const addMember = async (data: any): Promise<DetailedMember> => {
  return await callGas('ADD_MEMBER', data);
};

export const addSpouse = async (memberId: string, data: any, targetMember: DetailedMember): Promise<DetailedMember> => {
  // Pass targetMember info so GAS can easily create spouse with same generation
  return await callGas('ADD_SPOUSE', { memberId, ...data, targetMember });
};

export const addParent = async (childId: string, data: any): Promise<DetailedMember> => {
  return await callGas('ADD_PARENT', { childId, ...data });
};

export const markDeceased = async (id: string, data: { deathDate?: string }): Promise<DetailedMember> => {
  return await callGas('MARK_DECEASED', { id, ...data });
};

export const updateMemberDetails = async (id: string, data: Partial<DetailedMember>): Promise<DetailedMember> => {
  return await callGas('UPDATE_MEMBER', { id, ...data });
};

export const deleteMember = async (id: string): Promise<void> => {
  return await callGas('DELETE_MEMBER', { id });
};

// Aliases for compatibility with App.tsx if it uses old function names
export const getMembers = fetchMembers;
export const updateMember = updateMemberDetails;
