import { DetailedMember } from '../types/member';

const API_BASE_URL = 'http://localhost:5001/api';

const getHeaders = () => {
  const token = localStorage.getItem('genealogy_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const getMembers = async (): Promise<DetailedMember[]> => {
  const response = await fetch(`${API_BASE_URL}/members`);
  if (!response.ok) throw new Error('Failed to fetch members');
  return response.json();
};

export const addMember = async (data: Partial<DetailedMember>): Promise<DetailedMember> => {
  const response = await fetch(`${API_BASE_URL}/members`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to add member');
  return response.json();
};

export const addSpouse = async (memberId: string, data: { name: string, isPrimary: boolean, order: number }): Promise<DetailedMember> => {
  const response = await fetch(`${API_BASE_URL}/members/${memberId}/spouses`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to add spouse');
  return response.json();
};

export const markDeceased = async (memberId: string, data: { deathDate: string }): Promise<DetailedMember> => {
  const response = await fetch(`${API_BASE_URL}/members/${memberId}/deceased`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to mark deceased');
  return response.json();
};

export const updateMember = async (id: string, data: Partial<DetailedMember>): Promise<DetailedMember> => {
  const response = await fetch(`${API_BASE_URL}/members/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to update member');
  return response.json();
};
