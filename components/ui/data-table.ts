/**
 * Shared table styles (item 13, module 4).
 * Pages keep their own markup and apply these class strings. Presentation only.
 *
 *   <div className={dt.wrap}>
 *     <table className={dt.table}>
 *       <thead className={dt.thead}>
 *         <tr><th className={dt.th}>Name</th><th className={dt.thRight}>Total</th></tr>
 *       </thead>
 *       <tbody className={dt.tbody}>
 *         <tr className={dt.tr}><td className={dt.td}>…</td><td className={dt.tdRight}>…</td></tr>
 *       </tbody>
 *     </table>
 *   </div>
 */
export const dt = {
  wrap: "overflow-x-auto rounded-lg border border-line bg-surface shadow-card",
  table: "min-w-full divide-y divide-line text-sm",
  thead: "bg-canvas",
  th: "whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted",
  thRight: "whitespace-nowrap px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted",
  tbody: "divide-y divide-line bg-surface",
  tr: "group transition-colors hover:bg-canvas",
  td: "whitespace-nowrap px-4 py-3 text-ink",
  tdRight: "whitespace-nowrap px-4 py-3 text-right tabular-nums text-ink",
  empty: "px-4 py-10 text-center text-sm text-muted",
  // C1b: long text cells cut with an ellipsis (put the full text in title=). Actions stay visible on the right.
  tdTrunc: "max-w-[16rem] truncate whitespace-nowrap px-4 py-3 text-ink",
  thSticky: "sticky right-0 z-10 whitespace-nowrap bg-canvas px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted",
  tdSticky: "sticky right-0 z-10 focus-within:z-30 whitespace-nowrap bg-surface px-4 py-3 text-right text-ink shadow-[-8px_0_8px_-8px_rgb(15_23_42/0.12)] group-hover:bg-canvas",
  // A text link in a list. 44px tap zone below md (hit-44); no change with a mouse.
  link: "hit-44 relative inline-block font-medium text-accent underline underline-offset-2",
} as const
