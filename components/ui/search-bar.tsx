import { useTheme } from "@/contexts/theme-context";
import { SearchIcon } from "@/components/icons";

export const SearchBar = ({
  placeholder,
  onChange,
  value,
  compact,
}: {
  placeholder: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  value: string;
  compact?: boolean;
}) => {
  const { isDark } = useTheme();

  return (
    <div className={`border-[1px] flex items-center rounded-[8px] ${
      compact
        ? "h-[36px] gap-[6px] pr-[10px] py-[6px] pl-[10px] w-[160px]"
        : "h-[48px] gap-[9px] pr-[24px] py-[8px] pl-[16px] w-full"
    } ${
      isDark
        ? "bg-[#111111]"
        : "bg-white"
    }`}>
      <div className={`flex flex-col items-center justify-center shrink-0 ${compact ? "w-[16px] h-[16px]" : "w-[24px] h-[24px]"}`}>
        <SearchIcon />
      </div>
      <div className="w-full h-full">
        <input
          onChange={onChange}
          type="text"
          value={value}
          placeholder={`Search for ${placeholder}`}
          className={`placeholder:text-[#A7A7A7] w-full h-full outline-none font-medium ${
            compact ? "text-[13px]" : "text-[14px]"
          } ${
            isDark ? "text-white bg-[#111111]" : "text-black"
          }`}
        />
      </div>
    </div>
  );
};
