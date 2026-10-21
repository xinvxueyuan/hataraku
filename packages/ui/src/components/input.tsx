import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";
import * as React from "react";

import { disabledState, focusRing, invalidState } from "../lib/recipes.ts";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        `border-input file:text-foreground placeholder:text-muted-foreground ${focusRing} ${invalidState} disabled:bg-input/50 dark:bg-input/30 dark:disabled:bg-input/80 ${disabledState} h-8 w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed md:text-sm`,
        className
      )}
      {...props}
    />
  );
}

export { Input };
