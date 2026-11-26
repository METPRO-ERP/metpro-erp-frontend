import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buttonVariants } from "@/components/ui/button";

// C1a button system spec. Heights, one radius, one weight, and the 44px tap zone class.
describe("buttonVariants spec", () => {
  it("every look carries the base: tap zone, 6px radius, medium weight, positioned", () => {
    for (const variant of ["default", "destructive", "outline", "secondary", "ghost", "link"] as const) {
      const c = buttonVariants({ variant });
      expect(c).toContain("hit-44");
      expect(c).toContain("rounded-md");
      expect(c).toContain("font-medium");
      expect(c).toContain("relative");
    }
  });
  it("sizes: sm 28, md 32 (default), lg 40, icon 32 square", () => {
    expect(buttonVariants({ size: "sm" })).toContain("h-7");
    expect(buttonVariants({})).toContain("h-8");
    expect(buttonVariants({ size: "default" })).toContain("h-8");
    expect(buttonVariants({ size: "lg" })).toContain("h-10");
    const icon = buttonVariants({ size: "icon" });
    expect(icon).toContain("h-8");
    expect(icon).toContain("w-8");
  });
  it("uses only the existing colour tokens", () => {
    expect(buttonVariants({ variant: "default" })).toContain("bg-accent");
    expect(buttonVariants({ variant: "destructive" })).toContain("bg-red-600");
    expect(buttonVariants({ variant: "outline" })).toContain("border-line");
    expect(buttonVariants({ variant: "ghost" })).toContain("text-muted");
  });
  it("secondary is an alias of outline", () => {
    expect(buttonVariants({ variant: "secondary" })).toBe(buttonVariants({ variant: "outline" }));
  });
  it("default look is primary at 32px", () => {
    const c = buttonVariants({});
    expect(c).toContain("bg-accent");
    expect(c).toContain("h-8");
  });
});

describe("hit-44 stylesheet rule", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
  it("applies only below 768px or on coarse pointers", () => {
    const i = css.indexOf(".hit-44::after");
    expect(i).toBeGreaterThan(0);
    const media = css.lastIndexOf("@media", i);
    expect(css.slice(media, i)).toContain("(max-width: 767px), (pointer: coarse)");
  });
  it("adds no rule outside that media query", () => {
    const stripped = css.replace(/@media \(max-width: 767px\), \(pointer: coarse\) \{[\s\S]*?\n\}\n/, "");
    expect(stripped).not.toContain(".hit-44");
  });
});

// Guard: a raw <button> may not carry hand-written filled, red, underline or border-button looks.
// Allowed raw buttons: menu rows, list-option rows, tabs, radio cards, tag chips (see ALLOW).
describe("no hand-built buttons", () => {
  const ROOTS = ["app", "components"];
  const SKIP_DIR = ["components/ui"];
  const ALLOW_FILES = [
    "components/quotes/OverflowMenu.jsx", // menu rows
    "components/po/PoForm.tsx", // list-option rows
    "components/rfq/RfqForm.tsx",
    "components/quotes/takeoff/AddItemBar.tsx",
    "components/template-packs/TemplatePackBuilder.tsx",
    "app/quotes/new/page.tsx", // radio cards
    "app/configuracion/encabezado/page.tsx", // tabs and field chips
    "app/compras/page.tsx", // tabs
    "app/proyectos/[id]/page.tsx", // tabs
  ];
  const walk = (d: string, out: string[] = []) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (/\.(tsx|jsx|js)$/.test(e.name)) out.push(p);
    }
    return out;
  };
  const BAD = /(bg-accent\b|bg-red-\d|underline|\bborder border-line|text-red-6|text-accent\b)/;
  it("raw <button> outside the allowlist has no filled, red, underline or bordered look", () => {
    const offenders: string[] = [];
    for (const r of ROOTS) {
      for (const f of walk(path.join(process.cwd(), r))) {
        const rel = path.relative(process.cwd(), f).split(path.sep).join("/");
        if (SKIP_DIR.some((d) => rel.startsWith(d)) || ALLOW_FILES.includes(rel)) continue;
        const src = fs.readFileSync(f, "utf8");
        const re = /<button\b[^>]*>/g;
        let m;
        while ((m = re.exec(src))) if (BAD.test(m[0])) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
  it("allowlisted raw buttons never use filled or underlined looks", () => {
    for (const rel of ALLOW_FILES) {
      const src = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
      const re = /<button\b[^>]*>/g;
      let m;
      while ((m = re.exec(src))) expect(/bg-accent\b(?!\/)|bg-red-\d|underline/.test(m[0]), `${rel}: ${m[0].slice(0, 80)}`).toBe(false);
    }
  });
});
