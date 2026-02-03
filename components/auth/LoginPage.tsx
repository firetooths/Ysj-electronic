
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../../services/authService';
import { useAuth } from '../../AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';

export const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { user, accessToken, refreshToken } = await loginUser(username, password, rememberMe);
            login(user, accessToken, refreshToken);
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'خطا در برقراری ارتباط با سرور');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 to-blue-800 px-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-2xl overflow-hidden p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 mb-4">
                        <i className="fas fa-plane-departure text-3xl"></i>
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900">فرودگاه یاسوج</h2>
                    <p className="mt-2 text-gray-600 font-medium">سامانه مدیریت یکپارچه واحد الکترونیک</p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 border-r-4 border-red-500 text-red-700 text-sm rounded">
                        <p className="font-bold">خطا</p>
                        <p>{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input 
                        label="نام کاربری" 
                        value={username} 
                        onChange={e => setUsername(e.target.value)} 
                        required 
                        fullWidth
                        autoFocus
                        placeholder="نام کاربری خود را وارد کنید"
                    />
                    
                    <Input 
                        label="رمز عبور" 
                        type="password"
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        required 
                        fullWidth
                        placeholder="••••••••"
                    />

                    <div className="flex items-center justify-between">
                        <label className="flex items-center">
                            <input 
                                type="checkbox" 
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                checked={rememberMe}
                                onChange={e => setRememberMe(e.target.checked)}
                            />
                            <span className="mr-2 text-sm text-gray-600">مرا به خاطر بسپار</span>
                        </label>
                        <a href="#" className="text-sm text-indigo-600 hover:text-indigo-500">رمز عبور را فراموش کرده‌اید؟</a>
                    </div>

                    <Button 
                        type="submit" 
                        variant="primary" 
                        fullWidth 
                        disabled={loading}
                        className="py-3 text-lg shadow-lg"
                    >
                        {loading ? <Spinner className="text-white" /> : 'ورود به سیستم'}
                    </Button>
                </form>

                <div className="mt-8 text-center text-xs text-gray-400">
                    <p className="mb-1">نسخه 1.21</p>
                    <p>© 1404 واحد الکترونیک فرودگاه یاسوج</p>
                </div>
            </div>
        </div>
    );
};
