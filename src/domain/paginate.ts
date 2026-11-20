/**
 * Splits a list into pages for the admin lists. `pageParam` comes from the address, so
 * anything odd (missing, 0, "abc", past the end) lands on a real page.
 */
export interface PageOf<T> {
  page: number;
  pageCount: number;
  /** 1-based position of the first item shown, for "Showing 11 to 20 of 31". */
  first: number;
  last: number;
  total: number;
  items: T[];
}

export function paginate<T>(all: T[], pageParam: string | undefined, size: number): PageOf<T> {
  const pageCount = Math.max(1, Math.ceil(all.length / size));
  const page = Math.min(Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1), pageCount);
  const start = (page - 1) * size;
  const items = all.slice(start, start + size);
  return { page, pageCount, first: items.length ? start + 1 : 0, last: start + items.length, total: all.length, items };
}

/** The same address with `page` set (or dropped for page 1). */
export function pageHref(path: string, params: Record<string, string | undefined>, page: number): string {
  const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1] && e[0] !== "page"));
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}
