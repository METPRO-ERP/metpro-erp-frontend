/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS script */
// Summary check for the UI gate. Reads the audit JSON; encodes the GATE RULE. Does not alter the audit.
// usage: node gate-check.cjs <audit.json> [audit-exit-code]
const fs = require("fs");
const out = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const auditRc = Number(process.argv[3] || 0);
const s = out._summary;

// GATE RULE (Sam's amendment). REQUIRED-OPEN: every dialog below must open at the stated width.
// Changing this list is a deliberate edit reviewed like code. Never drop an entry to make the gate pass.
const REQUIRED_OPEN = [
  "quotes:convert", "quotes:phases", "quotes:pdf-preview", "quotes:conduce", "quotes:delete",
  "invoice:payment", "invoice:send", "contacts:new", "clients:csv",
].flatMap((d) => [`dialog ${d}@360`, `dialog ${d}@1280`]);

const problems = [];
if (!s) problems.push("audit produced no _summary");
else {
  const nz = s.touch360.controlsWithoutZone;
  if (nz > 0) problems.push(`controlsWithoutZone = ${nz} (must be 0). Sub-44px controls without a hit zone:`);
  const unopened = new Set(s.dialogsNotOpened || []);
  const unknown = REQUIRED_OPEN.filter((k) => !(k in out));
  REQUIRED_OPEN.filter((k) => unopened.has(k)).forEach((k) => problems.push(`required dialog not opened: ${k}`));
  unknown.forEach((k) => problems.push(`required dialog missing from the audit output: ${k}`));
}
if (auditRc !== 0) problems.push(`audit's own exit code was ${auditRc} (touch miss/neighbour, desktop leak or errored state)`);

// Report
if (s) {
  console.log("touch360:", JSON.stringify(s.touch360));
  console.log("desktop1280LeakingZones:", JSON.stringify(s.desktop1280LeakingZones), " failures:", JSON.stringify(s.failures));
  console.log("dialogs not opened:", JSON.stringify(s.dialogsNotOpened));
  const noZone = [];
  for (const [k, v] of Object.entries(out)) if (v && Array.isArray(v.noZone) && v.noZone.length) noZone.push(`${k}: ${v.noZone.join(", ")}`);
  console.log("sub-44px controls without hit zone (list):", noZone.length ? "" : "[] (empty)");
  noZone.forEach((l) => console.log("  " + l));
  console.log(`required-open dialogs checked: ${REQUIRED_OPEN.length}`);
}
if (problems.length) { console.log("GATE FAIL:"); problems.forEach((p) => console.log(" - " + p)); process.exit(1); }
console.log("GATE PASS");
