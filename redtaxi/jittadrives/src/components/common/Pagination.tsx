import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  total: number;
  page: number;
  pageSize?: number;
  label?: string;
  onChange: (page: number) => void;
  isLight: boolean;
}

export default function Pagination({ total, page, pageSize = 10, label, onChange, isLight }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);

  if (totalPages <= 1) return null;

  const pageNumbers: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (current > 3) pageNumbers.push('…');
    for (let i = Math.max(2, current - 1); i <= Math.min(totalPages - 1, current + 1); i++) pageNumbers.push(i);
    if (current < totalPages - 2) pageNumbers.push('…');
    pageNumbers.push(totalPages);
  }

  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);
  const word = total === 1 && label ? label.replace(/s$/i, '') : label;

  const navBtn = `
    h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1 transition border disabled:opacity-30 disabled:cursor-not-allowed
    ${isLight ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}
  `;
  const numBtn = (active: boolean) => `
    min-w-8 h-8 px-2 rounded-lg text-xs font-bold transition border
    ${active
      ? 'bg-[#E85D04] text-white border-[#E85D04]'
      : isLight ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}
  `;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-3">
      <span className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
        Showing {from}–{to} of {total} {word || 'records'}
      </span>
      <div className="flex items-center gap-1.5">
        <button className={navBtn} disabled={current <= 1} onClick={() => onChange(current - 1)}>
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous
        </button>
        <div className="flex items-center gap-1">
          {pageNumbers.map((n, i) =>
            n === '…' ? (
              <span key={`ellipsis-${i}`} className="px-1 text-xs text-slate-500">
                …
              </span>
            ) : (
              <button key={n} className={numBtn(n === current)} onClick={() => onChange(n)}>
                {n}
              </button>
            )
          )}
        </div>
        <button className={navBtn} disabled={current >= totalPages} onClick={() => onChange(current + 1)}>
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}