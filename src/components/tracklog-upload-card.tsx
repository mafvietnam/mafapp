import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Loader2, CheckCircle, AlertCircle, FileUp } from 'lucide-react';
import { uploadTracklog, type UploadResultItem } from '../services/strava-service';

/** One row in the post-upload result list. */
function ResultRow({ item }: { item: UploadResultItem }) {
  if (item.ok) {
    return (
      <li className="flex items-center gap-2 text-xs">
        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="text-white/80 truncate">{item.filename}</span>
        {item.duplicate ? (
          <span className="text-amber-400 shrink-0">(trùng buổi đã có)</span>
        ) : (
          item.id && (
            <Link to={`/activities/${item.id}`} className="text-maf-violet hover:underline shrink-0">
              Xem
            </Link>
          )
        )}
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2 text-xs">
      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
      <span className="text-white/60 truncate">{item.filename}</span>
      <span className="text-red-400 shrink-0">{item.error}</span>
    </li>
  );
}

interface TracklogUploadCardProps {
  /** Called after a successful batch so the dashboard list can refresh. */
  onImported?: () => void;
}

export default function TracklogUploadCard({ onImported }: TracklogUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<UploadResultItem[] | null>(null);
  const [error, setError] = useState('');

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError('');
    setResults(null);
    const res = await uploadTracklog(Array.from(files));
    setBusy(false);
    if (inputRef.current) inputRef.current.value = ''; // allow re-selecting the same file
    if (!res) {
      setError('Tải lên thất bại. Vui lòng thử lại.');
      return;
    }
    setResults(res.results);
    if (res.imported > 0) onImported?.();
  };

  return (
    <div className="desktop-card p-6">
      <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
        <FileUp className="w-5 h-5 text-maf-violet" />
        Tải lên tệp hoạt động
      </h2>
      <p className="text-white/50 text-sm mb-4">
        Chưa kết nối được Strava (hết slot)? Vào Strava → hoạt động → dấu <b>⋯</b> → <b>Export GPX</b>,
        rồi tải tệp <b>.gpx</b> hoặc <b>.tcx</b> lên đây để nhận phân tích MAF.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".gpx,.tcx"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full py-2.5 rounded-lg font-bold text-sm text-white bg-gradient-to-r from-maf-violet to-maf-red hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {busy ? 'Đang xử lý...' : 'Chọn tệp GPX/TCX'}
      </button>

      {error && (
        <p className="text-red-400 text-xs mt-3 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}

      {results && (
        <ul className="mt-4 space-y-1.5">
          {results.map((r, i) => (
            <ResultRow key={`${r.filename}-${i}`} item={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
