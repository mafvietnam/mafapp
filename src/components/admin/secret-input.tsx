import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface SecretInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  focusBorderColor?: string; // e.g. 'focus:border-orange-500/50'
}

/**
 * Password/text input with eye-toggle — shared by Garmin and Strava settings cards.
 * Starts hidden (type=password); toggle reveals plaintext.
 */
export default function SecretInput({
  value,
  onChange,
  placeholder = '',
  focusBorderColor = 'focus:border-white/30',
}: SecretInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-[#0B1121] border border-white/10 rounded-lg px-4 py-2.5 pr-10 text-white text-sm outline-none ${focusBorderColor} placeholder-slate-600 font-mono`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
        aria-label={show ? 'Hide secret' : 'Show secret'}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
