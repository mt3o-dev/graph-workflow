import type { PageQuery } from "../core/domain/types";

export function parsePageQuery(
  searchParams: URLSearchParams,
  opts: { defaultSortBy: string; pageSize?: number } = { defaultSortBy: "createdAt" },
): PageQuery {
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? String(opts.pageSize ?? 10)) || 10));
  const sortBy = searchParams.get("sortBy") ?? opts.defaultSortBy;
  const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";
  return { page, pageSize, sortBy, sortDir };
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
