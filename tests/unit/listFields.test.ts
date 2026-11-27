import { describe, it, expect } from "vitest"
import { quoteNumberLabel, invoiceNumberLabel, quoteRowKey, moneyTone, MONEY_TONE_CLASS } from "@/lib/listFields"

describe("quoteNumberLabel", () => {
  it("prefixes Q-", () => expect(quoteNumberLabel(32719)).toBe("Q-32719"))
  it("accepts a string number", () => expect(quoteNumberLabel("10036")).toBe("Q-10036"))
  it("dashes a missing number", () => {
    expect(quoteNumberLabel(null)).toBe("—")
    expect(quoteNumberLabel(undefined)).toBe("—")
    expect(quoteNumberLabel("")).toBe("—")
  })
})

describe("invoiceNumberLabel", () => {
  it("prints the stored number without a second marker", () => expect(invoiceNumberLabel("F-32707")).toBe("F-32707"))
  it("strips a leading #", () => expect(invoiceNumberLabel("#F-32707")).toBe("F-32707"))
  it("dashes a missing number", () => expect(invoiceNumberLabel(null)).toBe("—"))
})

describe("quoteRowKey", () => {
  it("uses quote_id", () => expect(quoteRowKey({ quote_id: 7 }, 0)).toBe("7"))
  it("falls back to id then index", () => {
    expect(quoteRowKey({ id: 9 }, 0)).toBe("9")
    expect(quoteRowKey({}, 3)).toBe("q-3")
  })
  it("is unique across distinct quotes", () => {
    const keys = [{ quote_id: 1 }, { quote_id: 2 }].map(quoteRowKey)
    expect(new Set(keys).size).toBe(2)
  })
})

describe("moneyTone", () => {
  it("maps income and spend", () => {
    expect(MONEY_TONE_CLASS[moneyTone("income", 0)]).toBe("text-emerald-600")
    expect(MONEY_TONE_CLASS[moneyTone("spend", 10)]).toBe("text-amber-600")
  })
  it("net follows the sign", () => {
    expect(moneyTone("net", 5)).toBe("positive")
    expect(moneyTone("net", 0)).toBe("positive")
    expect(moneyTone("net", -1)).toBe("negative")
  })
})
