import { forwardRef } from "react";

const Input = forwardRef(function Input(
  { label, error, className = "", id, ...props },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-text"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? "border-danger-500 focus:border-danger-500 focus:ring-danger-500" : ""
        } ${className}`}
        {...props}
      />
      {error && (
        <p className="text-xs text-danger-600">{error}</p>
      )}
    </div>
  );
});

export default Input;
