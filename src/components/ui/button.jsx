"use client";

import { forwardRef } from "react";

const variants = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800",
  secondary:
    "bg-surface border border-border text-text hover:bg-surface-secondary active:bg-border",
  danger: "bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800",
  ghost: "text-text-secondary hover:bg-surface-secondary active:bg-border",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

const Button = forwardRef(function Button(
  { variant = "primary", size = "md", className = "", disabled, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

export default Button;
