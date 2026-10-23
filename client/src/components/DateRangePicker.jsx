import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { isSameDay, subMonths } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import { DATE_PRESETS, formatRange } from "../utils/dateRanges";

const sameRange = (a, b) =>
  (!a?.from && !b?.from) ||
  (a?.from && b?.from && isSameDay(a.from, b.from) && isSameDay(a.to || a.from, b.to || b.from));

// A button that opens a two-month calendar for picking a from–to date range, with presets.
function DateRangePicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const open = () => {
    setDraft(value);
    setIsOpen((current) => !current);
  };

  const apply = (range) => {
    onChange(range?.from ? { from: range.from, to: range.to || range.from } : { from: undefined, to: undefined });
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="inline-flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-teal-200 sm:w-auto"
      >
        <CalendarDays className="text-teal-600" size={18} />
        <span className="truncate">{formatRange(value)}</span>
        <ChevronDown className={`ml-auto text-slate-400 transition sm:ml-1 ${isOpen ? "rotate-180" : ""}`} size={16} />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Choose a date range"
          className="absolute left-0 z-50 mt-2 flex w-max max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl md:flex-row"
        >
          <div className="flex gap-1 overflow-x-auto border-b border-slate-100 p-3 md:w-36 md:flex-col md:border-b-0 md:border-r">
            {DATE_PRESETS.map(([label, getRange]) => {
              const range = getRange();
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => apply(range)}
                  className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    sameRange(range, value) ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="p-3">
            <DayPicker
              className="hr-day-picker"
              mode="range"
              selected={draft?.from ? draft : undefined}
              onSelect={(range) => setDraft(range || { from: undefined, to: undefined })}
              defaultMonth={draft?.from || subMonths(new Date(), 1)}
              numberOfMonths={window.innerWidth >= 768 ? 2 : 1}
              weekStartsOn={1}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-1 pt-3">
              <p className="text-sm text-slate-500">
                {draft?.from ? formatRange(draft) : "Pick a start date, then an end date"}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => apply(draft)}
                  disabled={!draft?.from}
                  className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DateRangePicker;
