import { ArrowUpRight } from "lucide-react";
import { SearchResultItem, SearchItem } from "./SearchResultItem";

export interface SearchGroup {
  label: string;
  items: SearchItem[];
  seeAllLink?: string;
  icon?: React.ReactNode;
}

interface SearchGroupItemProps {
  group: SearchGroup;
  flatResults: SearchItem[];
  selectedIndex: number;
  onSelect: (link: string) => void;
  onHover: (flatIdx: number) => void;
  onSeeAll: (link: string) => void;
}

export function SearchGroupItem({ group, flatResults, selectedIndex, onSelect, onHover, onSeeAll }: SearchGroupItemProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {group.icon}
          {group.label}
        </div>
        {group.seeAllLink && group.items.length >= 5 && (
          <button
            onClick={() => onSeeAll(group.seeAllLink!)}
            className="text-xs font-semibold text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
          >
            See all <ArrowUpRight className="h-3 w-3" />
          </button>
        )}
      </div>
      
      {group.items.map((item) => {
        const flatIdx = flatResults.findIndex(r => r.id === item.id);
        const isSelected = flatIdx === selectedIndex;

        return (
          <SearchResultItem
            key={item.id}
            item={item}
            isSelected={isSelected}
            onSelect={() => onSelect(item.link)}
            onHover={() => onHover(flatIdx)}
          />
        );
      })}
    </div>
  );
}
