import { useAuth } from '../../contexts/auth-context';

export default function LoginButton() {
  const { login } = useAuth();

  return (
    <button
      onClick={login}
      className="w-full py-3 px-6 rounded-xl font-bold text-white text-lg
        bg-gradient-to-r from-[#F42A68] to-[#9130F8]
        hover:opacity-90 transition-opacity cursor-pointer"
    >
      Đăng nhập với WordPress
    </button>
  );
}
