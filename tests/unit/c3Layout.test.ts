import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResponsiveList, ListCard, type ResponsiveListProps } from "@/components/ui/responsive-list";
import { Chip } from "@/components/ui/chip";

type Row = { id: number; name: string };
const rows: Row[] = [{ id: 1, name: "Viga" }, { id: 2, name: "Placa" }];
const RL = ResponsiveList as unknown as React.ComponentType<ResponsiveListProps<Row>>;
const render = (below?: "sm" | "md") =>
  renderToStaticMarkup(
    React.createElement(
      RL,
      {
        items: rows,
        getKey: (r: Row) => r.id,
        ...(below ? { below } : {}),
        renderCard: (r: Row) => React.createElement(ListCard, { title: r.name, fields: [{ label: "Total", value: "10", numeric: true }] }),
      } as unknown as ResponsiveListProps<Row>,
      React.createElement("table", null, React.createElement("tbody", null)),
    ),
  );

describe("ResponsiveList breakpoint (C3)", () => {
  it("defaults to cards below md and the table from md up (lists, unchanged)", () => {
    const html = render();
    expect(html).toContain("md:hidden");
    expect(html).toContain("hidden md:block");
    expect(html).not.toContain("sm:hidden");
  });
  it("below=sm swaps at 640px for the detail pages", () => {
    const html = render("sm");
    expect(html).toContain("sm:hidden");
    expect(html).toContain("hidden sm:block");
    expect(html).not.toContain("md:hidden");
  });
  it("renders one card per row with the label and value", () => {
    const html = render("sm");
    expect(html.match(/<li/g)?.length).toBe(2);
    expect(html).toContain("Viga");
    expect(html).toContain("Total");
  });
});

describe("Chip (C3)", () => {
  it("is the neutral StatusPill shape", () => {
    const html = renderToStaticMarkup(React.createElement(Chip, null, "Producto"));
    expect(html).toContain("rounded-md");
    expect(html).toContain("ring-1");
    expect(html).toContain("Producto");
    expect(html).not.toContain("rounded-full");
  });
});
