"use client";

import { useRef, useState } from "react";
import { sendQuoteToClient, sendInvoiceToClient } from "@/lib/api";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import SealCheckbox from "@/components/SealCheckbox";
import { useSealSettings } from "@/lib/useSealSettings";
import { es } from "@/lib/i18n/es";
import { ModalShell } from "@/components/ui/modal-shell";

const t = es.envio;

// Mirror the backend limits so the user gets feedback before sending.
const MAX_FILES = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const BLOCKED = new Set(["exe", "bat", "cmd", "com", "msi", "scr", "js", "vbs", "ps1", "sh", "jar", "dll", "apk"]);

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SendToClientModal({
  open,
  onClose,
  id,
  type,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  id: number | string;
  type: "quote" | "invoice";
  onSent?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  // Company seal: pre-checked from the company default, changeable for this email.
  const seal = useSealSettings(open);
  const [sealChoice, setSealChoice] = useState<boolean | null>(null);
  const printSeal = seal.configured && (sealChoice ?? seal.enabledByDefault);

  if (!open) return null;

  // Prevent undefined ID from causing 422 errors
  if (id === null || id === undefined || id === "" || id === 0) {
    console.error("SendToClientModal received invalid ID:", id);
    return (
      <ModalShell
        title={t.documentoInvalido}
        centerTitle
        footer={
          <Button variant="outline" onClick={onClose}>
            {t.cerrar}
          </Button>
        }
      >
        <p className="text-ink">{t.documentoInvalidoTexto}</p>
      </ModalShell>
    );
  }

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    // Allow picking the same file again after removing it.
    e.target.value = "";
    if (!picked.length) return;

    let next = [...files];
    for (const f of picked) {
      const ext = f.name.includes(".") ? f.name.split(".").pop()!.toLowerCase() : "";
      if (BLOCKED.has(ext)) {
        toast.error(`${f.name}: ${t.tipoBloqueado}`);
        continue;
      }
      if (f.size === 0) {
        toast.error(`${f.name} ${t.archivoVacio}`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name} ${t.archivoGrande}`);
        continue;
      }
      if (next.length >= MAX_FILES) {
        toast.error(t.maxArchivos);
        break;
      }
      if (next.reduce((n, x) => n + x.size, 0) + f.size > MAX_TOTAL_BYTES) {
        toast.error(t.totalGrande);
        break;
      }
      next = [...next, f];
    }
    setFiles(next);
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const handleClose = () => {
    setFiles([]);
    setSealChoice(null);
    onClose();
  };

  const handleSend = async () => {
    setLoading(true);

    try {
      if (type === "quote") {
        await sendQuoteToClient(id, files, printSeal);
      } else {
        await sendInvoiceToClient(id, files, printSeal);
      }

      toast.success(t.exito);
      // Discard the selection once the email is out.
      setFiles([]);
      setSealChoice(null);

      if (onSent) onSent();
      onClose();
    } catch (err) {
      console.error("Send-to-client error:", err);

      const backendMessage = (err instanceof Error ? err.message : "") || t.errorGenerico;

      toast.error(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title={type === "quote" ? t.tituloCotizacion : t.tituloFactura}
      centerTitle
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {es.comun.cancelar}
          </Button>

          <Button onClick={handleSend} disabled={loading}>
            {loading ? t.enviando : t.enviar}
          </Button>
        </>
      }
    >
      <p className="text-ink mb-4 break-words whitespace-normal">{t.pregunta}</p>

      <div className="mb-6">
        <input ref={inputRef} type="file" multiple className="hidden" onChange={handlePick} disabled={loading} />
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={loading}>
          {t.adjuntar}
        </Button>
        <p className="mt-2 text-xs text-muted">{t.adjuntosNota}</p>

        {files.length > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-md border border-line" aria-label={t.adjuntosTitulo}>
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate" title={f.name}>
                  {f.name}
                  <span className="ml-2 text-xs text-muted">{formatSize(f.size)}</span>
                </span>
                <Button
                  type="button"
                  onClick={() => removeFile(i)}
                  disabled={loading}
                  variant="ghost" size="sm" className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  {t.quitar}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {seal.configured && (
        <div className="mb-6">
          <SealCheckbox checked={printSeal} onChange={setSealChoice} disabled={loading} />
        </div>
      )}
    </ModalShell>
  );
}
