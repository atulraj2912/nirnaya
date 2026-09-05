const colorMap = {
  primary: "bg-primary-100 text-primary-800",
  success: "bg-success-100 text-success-800",
  warning: "bg-warning-100 text-warning-800",
  danger: "bg-danger-100 text-danger-800",
  neutral: "bg-gray-100 text-gray-800",
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
      className={`inline-flex items-center rounded-full font-medium ${colorMap[variant]} ${sizeMap[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
