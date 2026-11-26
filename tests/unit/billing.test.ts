import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { es } from "@/lib/i18n/es";
import { getPhaseOptions } from "@/lib/billingApi";
import { convertToInvoice } from "@/components/quotes/QuoteActions";

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api.test";
});
afterEach(() => vi.unstubAllGlobals());

describe("phase options fail closed", () => {
  it("is off when the call fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await getPhaseOptions()).toEqual({ phased_enabled: false });
  });
  it("is off unless the backend says true", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { phased_enabled: false }, success: true }))));
    expect((await getPhaseOptions()).phased_enabled).toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { phased_enabled: true }, success: true }))));
    expect((await getPhaseOptions()).phased_enabled).toBe(true);
  });
});

describe("convertToInvoice request", () => {
  const ok = () => new Response(JSON.stringify({ data: { invoice_id: 1 }, success: true }));
  it("sends no body by default: the request is what it was before", async () => {
    const f = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", f);
    await convertToInvoice("Q-1", "tok");
    expect(f.mock.calls[0][1].body).toBeUndefined();
  });
  it("sends billing_mode only for the phased choice", async () => {
    const f = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", f);
    await convertToInvoice("Q-1", "tok", "PHASED");
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ billing_mode: "PHASED" });
  });
});

describe("Spanish keys of the plan (section 6)", () => {
  it("has every key with the planned text", () => {
    const f = es.facturacion;
    const n = es.fiscal.ncf;
    expect([f.modo.titulo, f.modo.completa, f.modo.fases]).toEqual(["Modo de facturación", "Factura completa", "Por fases"]);
    expect([f.fases.titulo, f.fases.saldo, f.fases.agregar, f.fases.generar, f.fases.pagoFinal]).toEqual([
      "Facturación por fases", "Saldo pendiente", "Agregar fase", "Generar factura de la fase", "Pago final"]);
    expect([f.fases.error.excede, f.fases.error.cero, f.fases.error.yaFacturada, f.fases.error.totalCambio, f.fases.error.modoFijo]).toEqual([
      "El monto supera el saldo pendiente", "El monto debe ser mayor que cero", "Esta fase ya tiene factura",
      "No se puede cambiar el total: ya existe una factura por fases", "El modo no puede cambiar después de la primera factura"]);
    expect([n.titulo, n.activar, n.vence, n.restantes, n.etiqueta, n.validoHasta]).toEqual([
      "Secuencia fiscal", "Activar secuencia", "Vence el", "Números restantes", "NCF", "Válido hasta"]);
    expect([n.aviso.vence, n.aviso.agota]).toEqual(["La secuencia vence en menos de 30 días", "Quedan menos de 20 números en la secuencia"]);
    expect([n.error.inactiva, n.error.vencida, n.error.agotada, n.error.tieneNcf]).toEqual([
      "No hay secuencia fiscal activa", "La secuencia fiscal venció. No se pueden emitir facturas",
      "La secuencia fiscal se agotó. No se pueden emitir facturas", "Esta factura tiene NCF. Use Anular en lugar de Eliminar"]);
  });
});
