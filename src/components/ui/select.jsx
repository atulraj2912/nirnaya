import { forwardRef } from "react";

const Select = forwardRef(function Select(
  { label, error, className = "", id, children, ...props },
  ref
) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="text-sm font-medium text-text"
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={`rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? "border-danger-500 focus:border-danger-500 focus:ring-danger-500" : ""
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p className="text-xs text-danger-600">{error}</p>
      )}
    </div>
  );
});

export default Select;
