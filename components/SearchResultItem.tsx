import { ArrowRight } from "lucide-react";

export interface SearchItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  link: string;
  icon: React.ReactNode;
}

interface SearchResultItemProps {
  item: SearchItem;
  isSelected: boolean;
  onSelect: () => void;
  onHover: () => void;
}

export function SearchResultItem({ item, isSelected, onSelect, onHover }: SearchResultItemProps) {
  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all text-left group
        ${isSelected 
          ? "bg-indigo-50 dark:bg-indigo-900/30" 
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
        }
      `}
    >
      <div className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-colors
        ${isSelected 
          ? "bg-indigo-100 dark:bg-indigo-900/50 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400" 
          : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-indigo-50"
        }
      `}>
        {item.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-semibold truncate transition-colors
            ${isSelected ? "text-indigo-700 dark:text-indigo-300" : "text-slate-900 dark:text-white"}
          `}>
            {item.title}
          </p>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
            {item.category}
          </span>
        </div>
        {item.description && (
          <p className={`text-xs mt-0.5 truncate uppercase font-medium tracking-tight transition-colors
            ${isSelected ? "text-indigo-500/80 dark:text-indigo-400/80" : "text-slate-500 dark:text-slate-400"}
          `}>
            {item.description}
          </p>
        )}
      </div>
      <ArrowRight className={`h-4 w-4 transition-all
        ${isSelected ? "opacity-100 translate-x-0 text-indigo-500" : "opacity-0 -translate-x-2 text-slate-300 dark:text-slate-700"}
      `} />
    </button>
  );
}
