"""Deterministic seed for the tap-target gate (scripts/ui-audit/gate.sh). TOOLING ONLY.

Run with the BACKEND's python, from the backend directory, against the gate database that gate.sh just created
from scratch (empty schema, ids start at 1, so the ids below are stable on every run).

It gives the audit every state it probes:
  - clients 1..3 and contacts 1..3 (the audit opens /contacts/2 = company 2, and its "new contact" dialog)
  - invoice 1: receipt states (pre-R3 payment, live payments, one voided, a settling one)  -> RECEIPT_INVOICE
  - invoice 2: open balance with one payment (the audit opens /invoices/2: Pago, Enviar al Cliente dialogs)
  - invoice 3: three deliverable lines, no delivery yet                                      -> CONDUCE_INVOICE
  - invoices 4..7: aged due dates (and one without a term) for the Vencidas view
  - quotes: a draft (deletable, editable), a finalized quote with a public link, approved quotes not yet invoiced
    (Convertir, Facturacion por fases, Generar conduce), and the converted ones above
  - a project row for /proyectos/<id>

SAFETY: it refuses to run unless DATABASE_URL points at the local database named metpro_gate and the API is local.
It never reads or writes any other database, and it holds no production credential.
Output: JSON with the token and ids on the path in GATE_SEED_OUT.
"""
import datetime as dt
import json
import os
import sys
from urllib.parse import urlparse

import psycopg2
import requests
from psycopg2.extras import RealDictCursor

DB_URL = os.environ.get("DATABASE_URL", "")
API = os.environ.get("GATE_API", "http://localhost:8100")
u = urlparse(DB_URL)
if u.hostname not in ("localhost", "127.0.0.1") or u.path.lstrip("/") != "metpro_gate":
    sys.exit("gate-seed refused: DATABASE_URL must be the LOCAL database metpro_gate (got host=%r db=%r)" % (u.hostname, u.path))
if urlparse(API).hostname not in ("localhost", "127.0.0.1"):
    sys.exit("gate-seed refused: API must be local (got %r)" % API)

sys.path.insert(0, os.getcwd())  # backend directory
from auth.service import create_access_token  # noqa: E402

ADMIN_ID = "00000000-0000-0000-0000-000000000002"
TOKEN = create_access_token({"sub": "t_admin", "role": "admin", "user_id": ADMIN_ID})
H = {"Authorization": "Bearer " + TOKEN}
CH = {"supervision": False, "admin": False, "insurance": False, "transport": False, "contingency": False}
TODAY = dt.date.today()

conn = psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)
cur = conn.cursor()


def sql(q, args=None):
    cur.execute(q, args)
    conn.commit()
    return cur.fetchone() if cur.description else None


def call(method, path, expect=200, **kw):
    r = requests.request(method, API + path, headers=H, timeout=60, **kw)
    if r.status_code != expect:
        sys.exit("gate-seed: %s %s -> %s %s" % (method, path, r.status_code, r.text[:300]))
    return r.json().get("data") if r.content and r.headers.get("content-type", "").startswith("application/json") else None


sql("INSERT INTO users (id, username, password_hash, email, role, is_active) VALUES (%s,'t_admin','x','t_admin@test.local','admin',true) "
    "ON CONFLICT DO NOTHING", (ADMIN_ID,))

# ---- clients and contacts: ids 1..3 (the audit hard-codes company 2)
NAMES = ["Constructora Norte SRL",
         "Corporacion Industrial Metalmecanica del Caribe y Servicios Generales de Construccion SRL",
         "Ferreteria Don Pepe"]
cids, cts = [], []
for n in NAMES:
    cid = sql("INSERT INTO clients (company_name, tax_id) VALUES (%s,'1-31-00001-1') RETURNING id", (n,))["id"]
    cts.append(sql("INSERT INTO contacts (company_id, name, email) VALUES (%s,'Ana','a@x.com') RETURNING id", (cid,))["id"])
    cids.append(cid)
assert cids[1] == 2, "company 2 must exist for /contacts/2"

# ---- fiscal batch so every conversion gets an NCF (FISCAL_NCF_ENABLED is on in the gate API)
call("POST", "/fiscal/sequence/activate", json={"series": "B", "next_number": 500, "next_number_confirm": 500, "range_start": 500,
     "range_end": 599, "expiry_date": (TODAY + dt.timedelta(days=365)).isoformat(), "confirm": True})


def quote(ci, project, items, status=None):
    """status None = leave as draft; 'Final' = finalized; 'Approved' = finalized then approved."""
    body = {"client_id": cids[ci], "contact_id": cts[ci], "project_name": project, "included_charges": CH, "items": items}
    qid = call("POST", "/quotes/", json=body)["quote_id"]
    if status in ("Final", "Approved"):
        call("POST", "/quotes/%s/finalize" % qid)
    if status == "Approved":
        call("PATCH", "/quotes/%s/status" % qid, json={"status": "Approved"})
    return qid


def invoice(qid):
    return call("POST", "/quotes/%s/convert-to-invoice" % qid)["invoice_id"]


def item(name, qty, price):
    return {"product_name": name, "quantity": qty, "unit_price": price}


def pay(i, amt, day, m="Transferencia", n=None):
    return call("POST", "/invoices/%s/payments" % i, json={"amount": amt, "method": m, "notes": n, "payment_date": day})["payment_id"]


# ---- invoice 1: receipt states
q1 = quote(0, "Torre Norte", [item("Viga IPE 200", 1, 100000.0)], "Approved")
i1 = invoice(q1)
assert i1 == 1
pre = sql("INSERT INTO invoice_payments (invoice_id, amount, method, notes, payment_date, backfilled) VALUES (%s, 10000, 'Efectivo', "
          "'anticipo anterior al recibo', '2026-10-01', true) RETURNING id", (i1,))["id"]
sql("UPDATE invoices SET amount_paid=10000, amount_due=total_amount-10000 WHERE id=%s", (i1,))
total1 = float(call("GET", "/invoices/%s" % i1)["total_amount"])
pay(i1, 30000.0, "2026-11-10", n="Avance 1")
voided = pay(i1, 5000.0, "2026-11-12", m="Cheque")
call("POST", "/invoices/%s/payments/%s/void" % (i1, voided), json={"reason": "cheque devuelto"})
pay(i1, round(total1 - 40000.0, 2), "2026-11-20", n="Saldo final")

# ---- invoice 2: open balance with one payment (payment and send dialogs, /invoices/2)
q2 = quote(1, "Nave Industrial Caribe", [item("Columna HSS", 4, 12500.0)], "Approved")
i2 = invoice(q2)
assert i2 == 2, "invoice 2 must exist for /invoices/2"
pay(i2, 10000.0, "2026-11-15", n="Anticipo")

# ---- invoice 3: deliverable lines, nothing delivered (conduce form)
q3 = quote(2, "Mesada y herrajes", [item("Mesada acero inox", 2, 18000.0), item("Tornillo 3/4", 200, 12.5), item("Riostra 3/4", 6, 950.0)], "Approved")
i3 = invoice(q3)

# ---- invoices 4..7: aged due dates for the Vencidas view (one without a term)
aged = []
for k, (ci, days_late) in enumerate([(0, 12), (1, 45), (2, 100), (0, None)]):
    qq = quote(ci, "Vencida %d" % (k + 1), [item("Servicio", 1, 25000.0 + 1000 * k)], "Approved")
    ii = invoice(qq)
    due = None if days_late is None else TODAY - dt.timedelta(days=days_late)
    sql("UPDATE invoices SET due_date=%s WHERE id=%s", (due, ii))
    aged.append(ii)

# ---- quote list states: a draft (deletable, editable), a finalized one with a public link, approved ones left open
draft = quote(0, "Borrador editable", [item("Perfil C", 10, 340.0), item("Tubo 2in", 12, 410.0), item("Angular 2x2", 20, 155.0)], None)
final = quote(1, "Cotizacion enviada", [item("Placa base", 8, 2100.0)], "Final")
open_a = quote(2, "Aprobada sin facturar A", [item("Anclaje", 24, 180.0), item("Placa", 6, 900.0)], "Approved")
open_b = quote(0, "Aprobada sin facturar B", [item("Viga W10x12", 5, 4100.0)], "Approved")
ptoken = sql("SELECT public_token FROM quotes WHERE quote_id=%s", (final,))["public_token"]
# The audit probes /proyectos/<PROJ>. This project has NO linked documents on purpose: it is the state every earlier
# gate audited. With linked documents the page shows inline links (Q-/F- numbers) of 20px height without a hit zone.
# That is a known finding recorded in the register (open item), not a seed choice made to hide it.
proj = sql("INSERT INTO projects (client_id, name, start_date) VALUES (%s,'Proyecto sin documentos', %s) RETURNING id", (cids[0], TODAY))["id"]

# QID feeds /quotes/<QID>/edit and /view. A FINALIZED quote is used on purpose: the audit scrolls with html{scroll-behavior:smooth}
# and reads rects mid-animation, so on a DRAFT edit page the first 'Quitar' (starts under the sticky action bar) is reported
# as a neighbour overlap that is a measurement artifact. Recorded in the register as an open audit finding.
out = {"token": TOKEN, "qid": final, "ptoken": ptoken, "proj": proj, "receipt_invoice": i1, "conduce_invoice": i3,
       "invoices": [i1, i2, i3] + aged, "quotes": {"draft": draft, "final": final, "open_a": open_a, "open_b": open_b}}
with open(os.environ["GATE_SEED_OUT"], "w") as fh:
    json.dump(out, fh)
print("gate-seed ok:", json.dumps({k: v for k, v in out.items() if k != "token"}))
