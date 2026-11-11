"use client";

import { useFormStatus } from "react-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/primitives";

/** Submit button that shows a loading state while the lookup runs. */
export function FindSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending}>
      {!pending && <Search aria-hidden className="size-4" />} Find my booking
    </Button>
  );
}
