import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { login as loginApi } from '../services/api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!password) {
        throw new Error('Vui lòng nhập mật khẩu');
      }

      // Gọi thẳng Backend để xác thực; thành công sẽ được cấp 1 session token (thay vì
      // lưu thẳng mật khẩu như bản cũ) — token này mới là thứ được gửi kèm mọi request sau.
      const { token, user } = await loginApi(username, password);
      login(user, token);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden relative">
        <div className="bg-wood text-white px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-serif">Đăng Nhập Quản Trị</h3>
          <button onClick={onClose} className="text-white hover:text-orange-200 font-bold text-xl">&times;</button>
        </div>
        <div className="p-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-4 border border-red-200">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-wood-dark mb-1">Tài khoản</label>
              <input 
                required 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                className="w-full border rounded p-2 focus:border-bronze outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-wood-dark mb-1">Mật khẩu</label>
              <input 
                required 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full border rounded p-2 focus:border-bronze outline-none" 
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-burgundy hover:bg-burgundy-dark text-white py-2 rounded font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Đang xử lý...' : 'Đăng Nhập'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
