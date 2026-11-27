import { describe, it, expect } from "vitest"
import { MODAL_CARD_CLASS, MODAL_OVERLAY_CLASS, MODAL_SIZE_CLASS } from "@/components/ui/modal-shell"

describe("ModalShell spec", () => {
  it("overlay pads every side so the card never touches a screen edge", () => {
    expect(MODAL_OVERLAY_CLASS).toContain("fixed inset-0")
    expect(MODAL_OVERLAY_CLASS).toContain("p-4")
  })
  it("card has a max height (dvh where supported) and a column layout for pinned header and footer", () => {
    expect(MODAL_CARD_CLASS).toContain("max-h-[calc(100vh-2rem)]")
    expect(MODAL_CARD_CLASS).toContain("100dvh")
    expect(MODAL_CARD_CLASS).toContain("flex-col")
    expect(MODAL_CARD_CLASS).toContain("w-full")
  })
  it("sizes", () => {
    expect(MODAL_SIZE_CLASS.md).toBe("max-w-md")
    expect(MODAL_SIZE_CLASS["2xl"]).toBe("max-w-2xl")
  })
})
