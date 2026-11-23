import Image from "next/image";
import type { ServicePhotoRef } from "@/domain/types";
import { cx } from "@/components/ui/primitives";

/**
 * A service's photo. Already shrunk on upload and cached for a year by its own address, so it skips
 * Next's image optimiser. `decorative` when the service name sits right beside it (screen readers
 * would hear the name twice); otherwise it reads the owner's description, or the service name.
 */
export function ServicePhoto({
  photo,
  name,
  decorative = false,
  className,
  priority = false,
}: {
  photo: ServicePhotoRef;
  name: string;
  decorative?: boolean;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={photo.url}
      alt={decorative ? "" : photo.alt || name}
      width={photo.width}
      height={photo.height}
      unoptimized
      priority={priority}
      className={cx("object-cover", className)}
    />
  );
}
