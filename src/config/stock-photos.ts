/**
 * TEMPORARY stock photography (Unsplash License) used as stand-ins until
 * Haircraft360 supplies its own owner-approved photos. These are NOT
 * Haircraft360 clients or work — every use is captioned as a stock stand-in.
 *
 * To replace: drop the salon's photo into /public and point `src` at it,
 * then set `stock: false` (or remove the caption). Source list: public/stock/CREDITS.md.
 */
export type StockPhoto = {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** What the owner's real photo for this slot should show. */
  brief: string;
  credit: { name: string; url: string };
};

const unsplash = (slug: string) => `https://unsplash.com/photos/${slug}`;

export const HERO_PHOTO: StockPhoto = {
  src: "/stock/hero-loc-portrait.webp",
  alt: "Stock photo: a woman with shoulder-length locs looking up and smiling",
  width: 900,
  height: 1125,
  brief: "A portrait of a client's finished locs, taken in the salon",
  credit: { name: "Jabari Timothy", url: unsplash("c9GxZcR07j8") },
};

/** Keyed by service id from the demo config. Unknown services fall back to a placeholder. */
export const SERVICE_PHOTOS: Record<string, StockPhoto> = {
  svc_starter_locs: {
    src: "/stock/service-starter-locs.webp",
    alt: "Stock photo: short, freshly started locs seen from above",
    width: 960,
    height: 540,
    brief: "Fresh starter locs with clean parts",
    credit: { name: "Larry George II", url: unsplash("7Lb9KCfvA1w") },
  },
  svc_retwist: {
    src: "/stock/service-retwist.webp",
    alt: "Stock photo: neatly retwisted locs with defined parting",
    width: 960,
    height: 540,
    brief: "Neat roots and parting straight after a retwist",
    credit: { name: "Romina Farías", url: unsplash("NhTBT45OkBE") },
  },
  svc_custom: {
    src: "/stock/service-custom-styling.webp",
    alt: "Stock photo: locs styled with purple beads",
    width: 960,
    height: 540,
    brief: "A finished loc style, with any accessories used",
    credit: { name: "Superr", url: unsplash("1E1U0-HvyvM") },
  },
  svc_consult: {
    src: "/stock/service-consultation.webp",
    alt: "Stock photo: a stylist placing a cape on a smiling client in a salon chair",
    width: 960,
    height: 540,
    brief: "The stylist with a client at the chair, in the salon",
    credit: { name: "Land O'Lakes, Inc.", url: unsplash("UnSFmJCCrW0") },
  },
};

export type GalleryPair = { label: string; before: StockPhoto; after: StockPhoto };

export const GALLERY_PAIRS: GalleryPair[] = [
  {
    label: "Starter locs",
    before: {
      src: "/stock/gallery-starter-before.webp",
      alt: "Stock photo: a woman with a loose natural afro",
      width: 600,
      height: 800,
      brief: "Client's loose natural hair before starting locs",
      credit: { name: "Good Faces", url: unsplash("xmSWVeGEnJw") },
    },
    after: {
      src: "/stock/gallery-starter-after.webp",
      alt: "Stock photo: a woman with locs sitting in front of a plant",
      width: 600,
      height: 800,
      brief: "The same client after their starter locs",
      credit: { name: "Jabari Timothy", url: unsplash("HQBjE_w_psE") },
    },
  },
  {
    label: "Retwist",
    before: {
      src: "/stock/gallery-retwist-before.webp",
      alt: "Stock photo: close-up of grown-out locs with loose roots",
      width: 600,
      height: 800,
      brief: "Grown-out roots before a retwist",
      credit: { name: "Mulberry Digital", url: unsplash("JjwvrwKYO9A") },
    },
    after: {
      src: "/stock/gallery-retwist-after.webp",
      alt: "Stock photo: a woman with neat locs resting her face in her hands",
      width: 600,
      height: 800,
      brief: "The same client's locs after a retwist",
      credit: { name: "Jabari Timothy", url: unsplash("NgnnytzaT9g") },
    },
  },
  {
    label: "Styling",
    before: {
      src: "/stock/gallery-styling-before.webp",
      alt: "Stock photo: close-up of textured hair in twists",
      width: 600,
      height: 800,
      brief: "Client's hair before styling",
      credit: { name: "Patient Perfect", url: unsplash("QngsebgpK84") },
    },
    after: {
      src: "/stock/gallery-styling-after.webp",
      alt: "Stock photo: long honey-coloured locs seen from behind",
      width: 600,
      height: 800,
      brief: "The same client's finished style",
      credit: { name: "Precious Madubuike", url: unsplash("QguoDDRIeME") },
    },
  },
];
