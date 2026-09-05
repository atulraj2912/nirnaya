const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function Avatar({
  src,
  alt,
  name,
  size = "md",
  className = "",
  ...props
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt || name || "Avatar"}
        className={`rounded-full object-cover ${sizeMap[size]} ${className}`}
        {...props}
      />
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-primary-100 font-medium text-primary-800 ${sizeMap[size]} ${className}`}
      {...props}
    >
      {getInitials(name)}
    </div>
  );
}
