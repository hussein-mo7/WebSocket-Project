import { formatDateDivider } from "./chat.utils";

export function DateDivider({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-center py-4">
      <span className="px-3 py-1 text-[11px] text-secondary bg-surface/60 rounded-full font-medium">
        {formatDateDivider(date)}
      </span>
    </div>
  );
}
