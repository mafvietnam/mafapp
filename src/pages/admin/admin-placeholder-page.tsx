import { Construction } from 'lucide-react';

interface Props {
  title: string;
}

export default function AdminPlaceholderPage({ title }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
      <Construction className="w-12 h-12 mb-4 text-slate-600" />
      <h2 className="text-2xl font-bold mb-2 text-white">{title}</h2>
      <p>Tính năng đang được phát triển</p>
    </div>
  );
}
