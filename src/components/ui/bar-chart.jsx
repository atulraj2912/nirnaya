"use client";

export function BarChart({ data, labelKey = "label", valueKey = "value", maxValue, height = 200 }) {
  const max = maxValue || Math.max(...data.map(d => d[valueKey] || 0), 1);
  
  return (
    <div className="flex items-end gap-1" style={{ height }} role="img" aria-label="Bar chart">
      {data.map((item, i) => {
        const val = item[valueKey] || 0;
        const pct = Math.round((val / max) * 100);
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-medium text-text-muted">{val}</span>
            <div className="w-full rounded-t bg-primary-200 transition-all" style={{ height: `${Math.max(pct, 2)}%` }}>
              <div className="h-full w-full rounded-t bg-primary-500" style={{ height: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-text-muted truncate max-w-full" title={item[labelKey]}>
              {item[labelKey]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function HorizontalBarChart({ data, labelKey = "label", valueKey = "value", maxValue }) {
  const max = maxValue || Math.max(...data.map(d => d[valueKey] || 0), 1);
  
  return (
    <div className="space-y-2" role="img" aria-label="Horizontal bar chart">
      {data.map((item, i) => {
        const val = item[valueKey] || 0;
        const pct = Math.round((val / max) * 100);
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="w-32 truncate text-xs text-text-secondary" title={item[labelKey]}>
              {item[labelKey]}
            </span>
            <div className="flex-1 h-5 rounded bg-surface-secondary overflow-hidden">
              <div className="h-full bg-primary-500 rounded transition-all" style={{ width: `${Math.max(pct, 1)}%` }} />
            </div>
            <span className="w-10 text-right text-xs font-medium text-text">{val}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DonutChart({ data, labelKey = "label", valueKey = "value", colors }) {
  const total = data.reduce((sum, d) => sum + (d[valueKey] || 0), 0);
  const defaultColors = [
    "bg-primary-500", "bg-success-500", "bg-warning-500", 
    "bg-danger-500", "bg-blue-500", "bg-purple-500", "bg-pink-500", "bg-teal-500",
  ];
  
  const usedColors = colors || defaultColors;
  
  const segments = data.reduce((acc, item, i) => {
    const val = item[valueKey] || 0;
    const pct = total > 0 ? (val / total) * 100 : 0;
    const start = acc.length > 0 ? acc[acc.length - 1].start + acc[acc.length - 1].pct : 0;
    acc.push({ ...item, pct, start, color: usedColors[i % usedColors.length] });
    return acc;
  }, []);

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-32 w-32 flex-shrink-0">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx="18"
              cy="18"
              r="15.915"
              fill="transparent"
              stroke={seg.color.replace("bg-", "").replace("-500", "")}
              strokeWidth="3.5"
              strokeDasharray={`${seg.pct} ${100 - seg.pct}`}
              strokeDashoffset={`${-seg.start}`}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-text">{total}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${usedColors[i % usedColors.length]}`} />
            <span className="text-xs text-text-secondary">{item[labelKey]}</span>
            <span className="text-xs font-medium text-text">{item[valueKey]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
