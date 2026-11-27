/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS script, playwright is resolved through NODE_PATH */
// Tap-target audit for the C1a button system. Measures the invisible 44px hit zone.
// Run: BASE=http://localhost:3765 TOKEN=<jwt> QID=<quote uuid> PTOKEN=<public quote token> PROJ=<project id> \
//      NODE_PATH=$(npm root -g) node scripts/ui-audit/tap-audit.cjs [out.json]
// For every visible button / link below 44px high or wide it probes 6px outside the visible edge with
// document.elementFromPoint: the probe must land on the same control (hit zone works) and never on a
// neighbour (overlap). At 360px (touch) every .hit-44 control must pass. At 1280px with a mouse the same
// probes must NOT land on the control (nothing is added on desktop).
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.env.BASE || "http://localhost:3765";
const TOKEN = process.env.TOKEN, QID = process.env.QID || "", PT = process.env.PTOKEN || "", PROJ = process.env.PROJ || "1";
if (!TOKEN) { console.error("TOKEN required"); process.exit(2); }
const routes = ["/ajustes","/clients","/compras","/compras/po/new","/compras/rfq/new","/configuracion/encabezado","/configuracion/fiscal",
  "/configuracion/sello","/configuracion/terminos","/contacts/2","/dashboard","/expenses","/invoices/2","/invoices","/login","/products","/proyectos",
  "/proyectos/" + PROJ, PT && "/q/" + PT, QID && "/quotes/" + QID + "/edit", QID && "/quotes/" + QID + "/view", "/quotes/estimate","/quotes/new",
  "/quotes/new/take-off","/quotes","/reports","/template-packs/new","/template-packs","/users/create","/users"].filter(Boolean);
const probe = (arg) => {
  const mode = arg.mode, scoped = arg.scoped;
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const sel = 'button,[role=button],a[href],[role=tab]';
  let root = document;
  if (scoped) { const all = [...document.querySelectorAll('[role=dialog],.fixed.inset-0')]; root = all[all.length - 1]; if (!root) return null; }
  const els = [...root.querySelectorAll(sel)].filter(vis);
  const seen = new Set(); const res = { checked: 0, pass: 0, noZone: [], miss: [], neighbour: [], desktopLeak: [] };
  const label = (e) => (e.tagName.toLowerCase() + ":" + (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 22));
  els.forEach((el) => {
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (el.closest("tbody") && seen.size > 400) return; // very long tables (1,200 local users)
    if (el.disabled || el.getAttribute("aria-disabled") === "true" || el.querySelector(".hit-44")) return; // not clickable / zone lives on the inner button
    const small = r.height < 44 || r.width < 44; if (!small) return;
    const hz = el.classList.contains("hit-44");
    // The zone reaches (44 - size) / 2 beyond the visible edge. Probe 6px out where it reaches further than 7px
    // (sm, 28px: reaches 8), otherwise 1px inside its reach (md, 32px: reaches exactly 6, so the probe is 5px).
    const pts = [];
    const dv = Math.min(6, (44 - r.height) / 2 - 1), dh = Math.min(6, (44 - r.width) / 2 - 1);
    if (r.height < 44) { pts.push([cx, r.top - dv]); pts.push([cx, r.bottom + dv]); }
    if (r.width < 44 && dh >= 1) { pts.push([r.left - dh, cy]); pts.push([r.right + dh, cy]); } // dh < 1: width within 2px of 44, no probe point outside the box
    seen.add(el);
    for (const [x, y] of pts) {
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      const same = hit && (hit === el || el.contains(hit));
      if (mode === "touch") {
        if (!hz) { res.noZone.push(label(el) + " " + Math.round(r.width) + "x" + Math.round(r.height)); break; }
        res.checked++;
        if (same) res.pass++;
        else {
          const other = hit && hit.closest(sel);
          (other ? res.neighbour : res.miss).push(label(el) + " -> " + (other ? label(other) : hit ? hit.tagName.toLowerCase() + "." + String(hit.className).slice(0, 40) : "none") + " @" + Math.round(x) + "," + Math.round(y) + " btn=" + Math.round(r.left) + "," + Math.round(r.top) + " " + Math.round(r.width) + "x" + Math.round(r.height));
        }
      } else if (same && hz) res.desktopLeak.push(label(el));
    }
  });
  ["noZone", "miss", "neighbour", "desktopLeak"].forEach((k) => (res[k] = [...new Set(res[k])]));
  return res;
};
(async () => {
  const b = await chromium.launch(); const out = {}; let fail = 0;
  for (const [vn, w, h, touch] of [["360", 360, 780, true], ["1280", 1280, 800, false]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch });
    await ctx.addInitScript((t) => localStorage.setItem("token", t), TOKEN);
    const p = await ctx.newPage();
    for (const path of routes) {
      try {
        await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 90000 }); await p.waitForTimeout(500);
        const r = await p.evaluate(probe, { mode: touch ? "touch" : "mouse", scoped: false });
        out[path + "@" + vn] = r;
        if (touch) fail += r.miss.length + r.neighbour.length; else fail += r.desktopLeak.length;
      } catch (e) { out[path + "@" + vn] = { err: e.message.slice(0, 100) }; }
    }
    // View states reached by a click (R2: the "Vencidas" view on the invoices list).
    const states = [
      ["invoices:vencidas", async () => { await p.goto(BASE + "/invoices", { waitUntil: "networkidle", timeout: 90000 }); await p.click('button:has-text("Vencidas")'); await p.waitForSelector('[data-testid="ageing-strip"]', { timeout: 30000 }); await p.waitForTimeout(500); }],
    ];
    for (const [name, open] of states) {
      try {
        await open();
        const r = await p.evaluate(probe, { mode: touch ? "touch" : "mouse", scoped: false });
        out["state " + name + "@" + vn] = r;
        if (touch) fail += r.miss.length + r.neighbour.length; else fail += r.desktopLeak.length;
      } catch (e) { out["state " + name + "@" + vn] = { err: e.message.slice(0, 100) }; fail++; }
    }
    // Dialogs: probe only the controls inside the open dialog.
    const go = async (path) => { await p.goto(BASE + path, { waitUntil: "networkidle" }); await p.waitForTimeout(500); };
    const viaMenu = async (label) => {
      const rows = p.locator("tbody tr:visible, ul.md\\:hidden > li:visible"); const n = await rows.count(); // table rows >= md, cards below md
      for (let i = 0; i < n; i++) {
        const m = rows.nth(i).getByRole("button", { name: /más|acciones/i }).first(); if (!(await m.count())) continue;
        try {
          await m.scrollIntoViewIfNeeded({ timeout: 3000 }); await m.click({ force: true, timeout: 3000 }); await p.waitForTimeout(200);
          const it = p.getByText(label, { exact: true }).first();
          if (await it.count() && await it.isVisible()) { await it.click(); return; }
        } catch { /* row without that control: try the next row */ }
        await p.mouse.click(1, 1);
      }
      await p.mouse.click(1, 1); // closes any menu left open by the loop (the menu ignores Escape)
      const d = p.getByRole("button", { name: new RegExp(label, "i") }).filter({ visible: true }).first(); // some actions are direct row buttons
      if (await d.count()) { await d.scrollIntoViewIfNeeded(); await d.click(); }
    };
    const dialogs = [
      ["quotes:convert", async () => { await go("/quotes"); await viaMenu("Convertir"); }],
      ["quotes:phases", async () => { await go("/quotes"); await viaMenu("Facturación por fases"); }],
      ["quotes:pdf-preview", async () => { await go("/quotes"); await viaMenu("Vista previa PDF"); }],
      ["quotes:conduce", async () => { await go("/quotes"); await viaMenu("Generar conduce"); }],
      ["quotes:delete", async () => { await go("/quotes"); await viaMenu("Eliminar"); }],
      ["invoice:payment", async () => { await go("/invoices/2"); await p.getByRole("button", { name: /^Pago$/ }).click(); }],
      ["invoice:send", async () => { await go("/invoices/2"); await p.getByRole("button", { name: /Enviar al Cliente/i }).click(); }],
      ["contacts:new", async () => { await go("/contacts/2"); await p.getByRole("button", { name: /Nuevo|Agregar|Añadir/i }).first().click(); }],
      ["clients:csv", async () => { await go("/clients"); await p.getByRole("button", { name: /CSV|Importar/i }).first().click(); }],
    ];
    for (const [name, open] of dialogs) {
      try {
        await open(); await p.waitForTimeout(600);
        const r = await p.evaluate(probe, { mode: touch ? "touch" : "mouse", scoped: true });
        out["dialog " + name + "@" + vn] = r || { opened: false };
        if (r) { if (touch) fail += r.miss.length + r.neighbour.length; else fail += r.desktopLeak.length; }
      } catch (e) { out["dialog " + name + "@" + vn] = { err: e.message.slice(0, 100) }; }
      await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    }
    await ctx.close();
  }
  const sum = Object.entries(out).filter(([k]) => k.endsWith("@360")).reduce((a, [, v]) => { if (v.err || v.opened === false) return a; a.c += v.checked; a.p += v.pass; a.nz += v.noZone.length; a.m += v.miss.length; a.n += v.neighbour.length; return a; }, { c: 0, p: 0, nz: 0, m: 0, n: 0 });
  const leak = Object.entries(out).filter(([k]) => k.endsWith("@1280")).reduce((a, [, v]) => a + (v.err || v.opened === false ? 0 : v.desktopLeak.length), 0);
  out._summary = { touch360: { probes: sum.c, pass: sum.p, miss: sum.m, neighbour: sum.n, controlsWithoutZone: sum.nz }, desktop1280LeakingZones: leak, failures: fail, dialogsNotOpened: Object.entries(out).filter(([k, v]) => k.startsWith("dialog ") && (v.err || v.opened === false)).map(([k]) => k) };
  fs.writeFileSync(process.argv[2] || "tap-audit.json", JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out._summary));
  await b.close(); process.exit(fail ? 1 : 0);
})();
