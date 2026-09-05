import * as React from "react";
import { cn } from "@/lib/utils";

export interface MockupProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "responsive" | "browser" | "window";
}

export function Mockup({
  className,
  type = "browser",
  children,
  ...props
}: MockupProps) {
  return (
    <div
      className={cn(
        "relative rounded-2xl sm:rounded-3xl border border-border bg-card/90 backdrop-blur-xl shadow-notion-elevated overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface MockupFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "small" | "large";
}

export function MockupFrame({
  className,
  children,
  size = "small",
  ...props
}: MockupFrameProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-border bg-surface-container-lowest/80 text-xs text-muted-foreground",
        size === "small" ? "px-4 sm:px-6 py-3" : "px-6 py-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export default Mockup;
