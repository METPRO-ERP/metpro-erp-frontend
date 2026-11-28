// OPT-IN diagnostic (GATE_STABLE_SCROLL=1), OFF in the gate. Loaded with node --require around tap-audit.cjs; the audit file is not edited.
// Why: app/globals.css sets html { scroll-behavior: smooth }. The audit calls scrollIntoView and reads the control's
// rect in the same tick, so it measures mid-animation. A control that starts under the sticky action bar
// (quote edit page, first "Quitar") is then reported as a neighbour overlap that no user would ever see.
// With the flag on, html { scroll-behavior: auto } is added to the audit's contexts so the measurement is stable.
// It stays off in the gate: turning it on changes results (see the register), and that is Fabian's call.
if (process.env.GATE_STABLE_SCROLL) {
  const pw = require("playwright");
  const css = "html{scroll-behavior:auto !important}";
  const launch = pw.chromium.launch.bind(pw.chromium);
  pw.chromium.launch = async (...a) => {
    const b = await launch(...a);
    const nc = b.newContext.bind(b);
    b.newContext = async (...x) => {
      const ctx = await nc(...x);
      await ctx.addInitScript((c) => { const s = () => { const st = document.createElement("style"); st.textContent = c; (document.head || document.documentElement).appendChild(st); };
        if (document.head) s(); else document.addEventListener("DOMContentLoaded", s); }, css);
      return ctx;
    };
    return b;
  };
}
