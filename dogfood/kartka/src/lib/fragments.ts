// Hand-built HTML fragment renderers for htmx partial-swap endpoints.
//
// These intentionally do NOT reuse the .astro components used for full-page
// renders (SetsTable.astro, CardsTable.astro): Astro's component render
// pipeline is designed around page routes, and reaching for the experimental
// `astro/container` API to render a single component from a plain API route
// added more risk than the small amount of markup duplication below. The
// markup here is kept in lockstep with the .astro versions by hand — see
// docs/TODO.md for the "de-duplicate fragment markup" follow-up.
import { t, type Locale } from "../i18n";
import type { Card, CardSet, Paginated, Visibility } from "../core/domain/types";
import type { SetWithOwner } from "../core/ports/setRepoPort";
import { totalPages } from "../lib/pageQuery";
import { escapeHtml } from "./html";

export async function renderSetsTableFragment(opts: {
  data: Paginated<CardSet>;
  sortBy: string;
  sortDir: "asc" | "desc";
  request: Request;
}): Promise<string> {
  const { data, sortBy, sortDir } = opts;
  const locale: Locale = new URL(opts.request.url).searchParams.get("lang") === "en" ? "en" : "pl";
  const tp = totalPages(data.total, data.pageSize);

  const sortLink = (col: string) => {
    const nextDir = sortBy === col && sortDir === "asc" ? "desc" : "asc";
    return `/api/sets?sortBy=${col}&sortDir=${nextDir}&page=1&pageSize=${data.pageSize}`;
  };
  const pageLink = (page: number) => `/api/sets?sortBy=${sortBy}&sortDir=${sortDir}&page=${page}&pageSize=${data.pageSize}`;
  const arrow = (col: string) => (sortBy === col ? (sortDir === "asc" ? "▲" : "▼") : "");

  const body =
    data.items.length === 0
      ? `<p class="empty-state">${escapeHtml(t("sets.empty", locale))}</p>`
      : `<table>
          <thead><tr>
            <th><button type="button" hx-get="${sortLink("title")}" hx-target="#sets-table" hx-swap="outerHTML" hx-push-url="true">${escapeHtml(t("sets.column.title", locale))} ${arrow("title")}</button></th>
            <th><button type="button" hx-get="${sortLink("createdAt")}" hx-target="#sets-table" hx-swap="outerHTML" hx-push-url="true">${escapeHtml(t("sets.column.created", locale))} ${arrow("createdAt")}</button></th>
            <th>${escapeHtml(t("sets.column.actions", locale))}</th>
          </tr></thead>
          <tbody class="stagger">
            ${data.items
              .map(
                (set) => `<tr>
                  <td>${escapeHtml(set.title)}</td>
                  <td>${escapeHtml(set.createdAt.toLocaleDateString(locale))}</td>
                  <td class="row">
                    <a href="/sets/${set.id}">${escapeHtml(t("sets.action.open", locale))}</a>
                    <a href="/review?setId=${set.id}">${escapeHtml(t("sets.action.review", locale))}</a>
                    <form method="post" action="/api/sets/${set.id}/delete">
                      <button type="submit" class="btn-danger" onclick="return confirm(${JSON.stringify(t("sets.deleteConfirm", locale))})">${escapeHtml(t("sets.action.delete", locale))}</button>
                    </form>
                  </td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>`;

  const pagination =
    data.items.length === 0
      ? ""
      : `<nav class="row" aria-label="${escapeHtml(t("pagination.nav", locale))}">
          ${data.page > 1 ? `<button type="button" hx-get="${pageLink(data.page - 1)}" hx-target="#sets-table" hx-swap="outerHTML">${escapeHtml(t("pagination.previous", locale))}</button>` : ""}
          <span>${escapeHtml(t("pagination.pageOf", locale, { page: data.page, totalPages: tp }))}</span>
          ${data.page < tp ? `<button type="button" hx-get="${pageLink(data.page + 1)}" hx-target="#sets-table" hx-swap="outerHTML">${escapeHtml(t("pagination.next", locale))}</button>` : ""}
        </nav>`;

  return `<div id="sets-table">${body}${pagination}</div>`;
}

export async function renderCardsTableFragment(opts: {
  setId: string;
  data: Paginated<Card>;
  sortBy: string;
  sortDir: "asc" | "desc";
  locale: Locale;
}): Promise<string> {
  const { setId, data, sortBy, sortDir, locale } = opts;
  const tp = totalPages(data.total, data.pageSize);
  const sortLink = (col: string) => {
    const nextDir = sortBy === col && sortDir === "asc" ? "desc" : "asc";
    return `/api/sets/${setId}/cards?sortBy=${col}&sortDir=${nextDir}&page=1&pageSize=${data.pageSize}`;
  };
  const pageLink = (page: number) =>
    `/api/sets/${setId}/cards?sortBy=${sortBy}&sortDir=${sortDir}&page=${page}&pageSize=${data.pageSize}`;
  const arrow = (col: string) => (sortBy === col ? (sortDir === "asc" ? "▲" : "▼") : "");

  const previewOf = (card: Card): string => {
    const p = card.payload as Record<string, unknown>;
    switch (card.type) {
      case "basic":
        return String(p.front ?? "");
      case "cloze":
        return String(p.text ?? "");
      case "multiple_choice":
        return String(p.question ?? "");
      case "true_false":
        return String(p.statement ?? "");
      case "type_answer":
        return String(p.prompt ?? "");
      case "image_occlusion":
        return `${(p.regions as unknown[] | undefined)?.length ?? 0} region(s)`;
      default:
        return "";
    }
  };

  const body =
    data.items.length === 0
      ? `<p class="empty-state">${escapeHtml(t("cards.empty", locale))}</p>`
      : `<table>
          <thead><tr>
            <th><button type="button" hx-get="${sortLink("type")}" hx-target="#cards-table" hx-swap="outerHTML" hx-push-url="true">${escapeHtml(t("cards.column.type", locale))} ${arrow("type")}</button></th>
            <th>${escapeHtml(t("cards.column.preview", locale))}</th>
            <th><button type="button" hx-get="${sortLink("createdAt")}" hx-target="#cards-table" hx-swap="outerHTML" hx-push-url="true">${escapeHtml(t("cards.column.created", locale))} ${arrow("createdAt")}</button></th>
            <th>${escapeHtml(t("cards.column.actions", locale))}</th>
          </tr></thead>
          <tbody class="stagger">
            ${data.items
              .map(
                (card) => `<tr>
                  <td><span class="badge">${escapeHtml(t(`cards.type.${card.type}` as never, locale))}</span></td>
                  <td>${escapeHtml(previewOf(card).slice(0, 80))}</td>
                  <td>${escapeHtml(card.createdAt.toLocaleDateString(locale))}</td>
                  <td class="row">
                    <form method="post" action="/api/cards/${card.id}/delete">
                      <button type="submit" class="btn-danger" onclick="return confirm(${JSON.stringify(t("cards.deleteConfirm", locale))})">${escapeHtml(t("cards.action.delete", locale))}</button>
                    </form>
                  </td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>`;

  const pagination =
    data.items.length === 0
      ? ""
      : `<nav class="row" aria-label="${escapeHtml(t("pagination.nav", locale))}">
          ${data.page > 1 ? `<button type="button" hx-get="${pageLink(data.page - 1)}" hx-target="#cards-table" hx-swap="outerHTML">${escapeHtml(t("pagination.previous", locale))}</button>` : ""}
          <span>${escapeHtml(t("pagination.pageOf", locale, { page: data.page, totalPages: tp }))}</span>
          ${data.page < tp ? `<button type="button" hx-get="${pageLink(data.page + 1)}" hx-target="#cards-table" hx-swap="outerHTML">${escapeHtml(t("pagination.next", locale))}</button>` : ""}
        </nav>`;

  return `<div id="cards-table">${body}${pagination}</div>`;
}

/** Owner-only htmx-updated control on the set detail page (/sets/[id].astro). */
export function renderVisibilityControlFragment(opts: { set: CardSet; locale: Locale }): string {
  const { set, locale } = opts;
  const options: Visibility[] = ["private", "unlisted", "public"];
  const shareUrl = `/s/${set.slug}`;

  return `<div id="visibility-control" class="stack">
    <form hx-post="/api/sets/${set.id}/visibility" hx-target="#visibility-control" hx-swap="outerHTML" class="row">
      <label for="visibility">${escapeHtml(t("sets.visibility.label", locale))}</label>
      <select id="visibility" name="visibility" onchange="this.form.requestSubmit()">
        ${options
          .map(
            (opt) =>
              `<option value="${opt}"${opt === set.visibility ? " selected" : ""}>${escapeHtml(t(`sets.visibility.${opt}`, locale))}</option>`,
          )
          .join("")}
      </select>
    </form>
    ${
      set.visibility !== "private"
        ? `<p>${escapeHtml(t("sets.visibility.shareLink", locale))}: <a href="${shareUrl}">${escapeHtml(shareUrl)}</a></p>`
        : `<p class="empty-state">${escapeHtml(t("sets.visibility.privateHint", locale))}</p>`
    }
  </div>`;
}

export async function renderPublicSetsFragment(opts: {
  data: Paginated<SetWithOwner>;
  sortBy: string;
  sortDir: "asc" | "desc";
  locale: Locale;
}): Promise<string> {
  const { data, sortBy, sortDir, locale } = opts;
  const tp = totalPages(data.total, data.pageSize);

  const sortLink = (col: string) => {
    const nextDir = sortBy === col && sortDir === "asc" ? "desc" : "asc";
    return `/api/discover?sortBy=${col}&sortDir=${nextDir}&page=1&pageSize=${data.pageSize}&lang=${locale}`;
  };
  const pageLink = (page: number) =>
    `/api/discover?sortBy=${sortBy}&sortDir=${sortDir}&page=${page}&pageSize=${data.pageSize}&lang=${locale}`;
  const arrow = (col: string) => (sortBy === col ? (sortDir === "asc" ? "▲" : "▼") : "");

  const body =
    data.items.length === 0
      ? `<p class="empty-state">${escapeHtml(t("discover.empty", locale))}</p>`
      : `<table>
          <thead><tr>
            <th><button type="button" hx-get="${sortLink("title")}" hx-target="#discover-table" hx-swap="outerHTML" hx-push-url="true">${escapeHtml(t("discover.column.title", locale))} ${arrow("title")}</button></th>
            <th>${escapeHtml(t("discover.column.owner", locale))}</th>
            <th><button type="button" hx-get="${sortLink("createdAt")}" hx-target="#discover-table" hx-swap="outerHTML" hx-push-url="true">${escapeHtml(t("discover.column.created", locale))} ${arrow("createdAt")}</button></th>
            <th>${escapeHtml(t("discover.column.actions", locale))}</th>
          </tr></thead>
          <tbody class="stagger">
            ${data.items
              .map(
                (set) => `<tr>
                  <td>${escapeHtml(set.title)}</td>
                  <td>${escapeHtml(set.ownerDisplayName)}</td>
                  <td>${escapeHtml(set.createdAt.toLocaleDateString(locale))}</td>
                  <td><a href="/s/${set.slug}">${escapeHtml(t("discover.action.view", locale))}</a></td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>`;

  const pagination =
    data.items.length === 0
      ? ""
      : `<nav class="row" aria-label="${escapeHtml(t("pagination.nav", locale))}">
          ${data.page > 1 ? `<button type="button" hx-get="${pageLink(data.page - 1)}" hx-target="#discover-table" hx-swap="outerHTML">${escapeHtml(t("pagination.previous", locale))}</button>` : ""}
          <span>${escapeHtml(t("pagination.pageOf", locale, { page: data.page, totalPages: tp }))}</span>
          ${data.page < tp ? `<button type="button" hx-get="${pageLink(data.page + 1)}" hx-target="#discover-table" hx-swap="outerHTML">${escapeHtml(t("pagination.next", locale))}</button>` : ""}
        </nav>`;

  return `<div id="discover-table">${body}${pagination}</div>`;
}
