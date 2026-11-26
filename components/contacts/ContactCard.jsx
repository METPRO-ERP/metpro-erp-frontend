import { es } from "@/lib/i18n/es";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function ContactCard({ contact, onEdit, onDelete }) {
  const router = useRouter();

  return (
    <div className="bg-surface border border-line rounded-lg p-5 shadow-card hover:shadow-card transition-shadow">
      <h2 className="text-lg font-semibold text-ink">{contact.name}</h2>

      <div className="text-sm text-muted mt-2 space-y-1">
        {contact.email && <p>{es.con.correo} {contact.email}</p>}
        {contact.phone && <p>{es.con.telefono} {contact.phone}</p>}
        {contact.company_name && (
          <p className="text-accent font-medium">{es.con.empresa} {contact.company_name}</p>
        )}
      </div>

      <div className="flex gap-3 mt-5 flex-wrap">
        <Button
          onClick={() => router.push(`/quotes?contactId=${contact.id}&companyId=${contact.company_id}`)}
          variant="default"
        >
          {es.con.usarEnCotizacion}
        </Button>

        <Button
          onClick={onEdit}
          variant="outline"
        >
          {es.con.editar}
        </Button>

        <Button
          onClick={onDelete}
          variant="destructive"
        >
          {es.con.eliminar}
        </Button>
      </div>
    </div>
  );
}