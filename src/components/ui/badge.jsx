const colorMap = {
  primary: "bg-primary-50 text-primary-700 ring-primary-600/10",
  success: "bg-success-50 text-success-700 ring-success-600/10",
  warning: "bg-warning-50 text-warning-700 ring-warning-600/10",
  danger: "bg-danger-50 text-danger-700 ring-danger-600/10",
  neutral: "bg-surface-secondary text-text-secondary ring-gray-500/10",
};

const sizeMap = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
};

export default function Badge({
  variant = "neutral",
  size = "md",
  className = "",
  children,
  ...props
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ring-1 ring-inset ${colorMap[variant]} ${sizeMap[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
