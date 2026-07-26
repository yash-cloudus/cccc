"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";

function TooltipProvider({ delay = 200, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />;
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  side = "right",
  sideOffset = 8,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "side" | "sideOffset" | "align">) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset} className="z-[80]">
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-[80] max-w-[220px] rounded-md bg-[var(--ink)] px-2.5 py-1.5 text-[11.5px] font-semibold text-white shadow-lg",
            "origin-[var(--transform-origin)] transition duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

/** Convenience: wrap a control with a label tooltip (used for collapsed sidebars). */
function WithTooltip({
  label,
  side = "right",
  disabled,
  children,
}: {
  label: string;
  side?: TooltipPrimitive.Positioner.Props["side"];
  disabled?: boolean;
  children: React.ReactElement;
}) {
  if (disabled || !label) return children;
  return (
    <Tooltip>
      <TooltipTrigger delay={150} render={children} />
      <TooltipContent side={side}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, WithTooltip };
