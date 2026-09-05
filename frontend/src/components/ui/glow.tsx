import * as React from "react";
import { cn } from "@/lib/utils";

export interface GlowProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "top" | "center" | "bottom" | "above";
}

export function Glow({ className, variant = "top", ...props }: GlowProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute -z-10 select-none overflow-hidden",
        variant === "top" &&
          "top-0 left-1/2 -translate-x-1/2 w-[700px] sm:w-[1000px] h-[400px] bg-gradient-to-tr from-primary/15 via-primary/5 to-transparent blur-3xl rounded-full",
        variant === "center" &&
          "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[450px] bg-primary/10 blur-[100px] rounded-full",
        variant === "bottom" &&
          "bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-t from-primary/10 via-sticker-purple/10 to-transparent blur-3xl rounded-full",
        variant === "above" &&
          "top-24 left-1/2 -translate-x-1/2 w-[600px] sm:w-[900px] h-[350px] bg-gradient-to-tr from-primary/15 via-primary/5 to-transparent rounded-full blur-3xl",
        className
      )}
      {...props}
    />
  );
}

export default Glow;
