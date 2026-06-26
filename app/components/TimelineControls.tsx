"use client";

interface TimelineControlsProps {
  yearOffset: number;
  dateString: string;
  timeString: string;
  onYearOffsetChange: (offset: number) => void;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onNow: () => void;
  min?: number;
  max?: number;
  showNowButton?: boolean;
}

function getModeLabel(selectedDate: Date, now: Date): string {
  const diffHours = (selectedDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (diffHours < -1) return "Historical Mode";
  if (diffHours > 1) return "Future Mode";
  return "Live Mode";
}

export function TimelineControls({
  yearOffset,
  dateString,
  timeString,
  onYearOffsetChange,
  onDateChange,
  onTimeChange,
  onNow,
  min = -100,
  max = 100,
  showNowButton = true,
}: TimelineControlsProps) {
  const now = new Date();
  const selectedDate = new Date(`${dateString}T${timeString}:00`);
  const mode = getModeLabel(selectedDate, now);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newOffset = parseInt(e.target.value, 10);
    onYearOffsetChange(newOffset);
    const newDate = new Date(now.getFullYear() + newOffset, now.getMonth(), now.getDate());
    onDateChange(newDate.toISOString().split("T")[0]);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onDateChange(value);
    const [year] = value.split("-");
    const newOffset = parseInt(year, 10) - now.getFullYear();
    onYearOffsetChange(newOffset);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
          Temporal Offset
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider border ${
            mode === "Live Mode"
              ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
              : mode === "Historical Mode"
              ? "text-amber-400 border-amber-400/30 bg-amber-400/10"
              : "text-violet-400 border-violet-400/30 bg-violet-400/10"
          }`}
        >
          {mode}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-slate-500">
            Date (YYYY-MM-DD)
          </label>
          <input
            type="date"
            value={dateString}
            onChange={handleDateChange}
            className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 font-mono text-xs text-slate-200 outline-none focus:border-sky-400/40 transition-colors [color-scheme:dark] min-h-[44px]"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-slate-500">
            Time (HH:MM)
          </label>
          <input
            type="time"
            value={timeString}
            onChange={(e) => onTimeChange(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 font-mono text-xs text-slate-200 outline-none focus:border-sky-400/40 transition-colors [color-scheme:dark] min-h-[44px]"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="font-mono text-[10px] text-amber-400/70 whitespace-nowrap">{min}y</span>
        <input
          type="range"
          min={min}
          max={max}
          step="1"
          value={yearOffset}
          onChange={handleSliderChange}
          className="zenith-scrubber flex-1 min-h-[44px]"
        />
        <span className="font-mono text-[10px] text-violet-400/70 whitespace-nowrap">{max}y</span>
      </div>

      <p className="font-mono text-sm font-bold text-white text-center">
        {yearOffset === 0
          ? "Present"
          : yearOffset > 0
          ? `+${yearOffset} years into the future`
          : `${yearOffset} years into the past`}
      </p>

      {showNowButton && (
        <button
          type="button"
          onClick={onNow}
          className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-mono text-xs uppercase tracking-wider transition-colors min-h-[44px] cursor-pointer"
        >
          ⏱ Now (Reset to Current UTC)
        </button>
      )}
    </div>
  );
}

export { getModeLabel };
