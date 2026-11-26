import { es } from "@/lib/i18n/es";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// Mounted fresh on each open (parent renders it only while modalOpen),
// so the form is initialised once from the contact being edited.
export default function ContactModal({ contact, onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({
    name: contact?.name || "",
    email: contact?.email || "",
    phone: contact?.phone || "",
  }));

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
      <div className="bg-surface p-6 rounded shadow-card w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">
          {contact ? "Editar Contacto" : "Añadir Contacto"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Nombre"
            className="w-full border p-2 rounded"
          />

          <input
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder={es.con.phCorreo}
            className="w-full border p-2 rounded"
          />

          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="Teléfono"
            className="w-full border p-2 rounded"
          />

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              variant="default"
            >
              Guardar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}