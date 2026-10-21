"use client";

import { cn } from "cn";
import * as React from "react";

import { labelDisabled } from "../lib/recipes.ts";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        `flex items-center gap-2 text-sm leading-none font-medium select-none ${labelDisabled}`,
        className
      )}
      {...props}
    />
  );
}

export { Label };
