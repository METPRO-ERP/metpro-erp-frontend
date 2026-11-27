"use client";
import { es } from "@/lib/i18n/es";
import toast from "react-hot-toast"
import { dt } from "@/components/ui/data-table";
export const dynamic = "force-dynamic";

import { useState, useEffect } from 'react'
import Link from "next/link";
import { api } from '@/lib/api'
import CSVImportModal from '@/components/client/CSVImportModal'
import { useCurrentRole } from '@/lib/currentRole'
import { PageHeader } from '@/components/ui/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { ResponsiveList, ListCard } from '@/components/ui/responsive-list'
import ErrorBanner from '@/components/ui/ErrorBanner'
import SuppliersPanel from '@/components/suppliers/SuppliersPanel'
import PaymentTermsFields from '@/components/quotes/PaymentTermsFields'
import { usePaymentDueEnabled, parseDays } from '@/lib/paymentDue'

export default function ClientsPage() {
  const { isAdmin } = useCurrentRole()
  const [clients, setClients] = useState([])
  const [newClient, setNewClient] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    tax_id: '',
    notes: ''
  })
  const [editingClient, setEditingClient] = useState(null)
  const [loading, setLoading] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [loadError, setLoadError] = useState(null) // E-07: visible load failure with retry
  // Clientes / Suplidores dropdown. Shown only when the backend switch SUPPLIERS_ENABLED is on.
  const [suppliersEnabled, setSuppliersEnabled] = useState(false)
  const [view, setView] = useState('clientes')
  // R4: default payment term on the client. Fields exist only while PAYMENT_DUE_ENABLED is on (fail closed).
  const paymentDueEnabled = usePaymentDueEnabled()

  useEffect(() => {
    fetchClients()
    api.get('/suppliers/options').then((o) => setSuppliersEnabled(o?.suppliers_enabled === true)).catch(() => {})
  }, [])

  const fetchClients = async () => {
  try {
    const data = await api.get("/clients");
    setClients(Array.isArray(data) ? data : []);
    setLoadError(null);
  } catch (error) {
    console.error("Failed to fetch clients:", error);
    setClients([]);
    // A 401 is already sent to the login page by api(). Anything else stays visible with a retry.
    setLoadError(error.code === 'NETWORK_ERROR' ? error.message : `${es.cli.errorCargar} ${error.message}`);
  }
};

  const handleCreateClient = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await api('/clients/', {
        method: 'POST',
        body: JSON.stringify(newClient)
      })

      await fetchClients()
      setNewClient({
        company_name: '',
        contact_name: '',
        email: '',
        phone: '',
        address: '',
        tax_id: '',
        notes: ''
      })
      toast.success(es.cli.creado)
    } catch (error) {
      toast.error(es.cli.errorGenerico + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateClient = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await api(`/clients/${editingClient.id}`, {
        method: 'PUT',
        body: JSON.stringify(editingClient)
      })

      await fetchClients()
      setEditingClient(null)
      toast.success(es.cli.actualizado)
    } catch (error) {
      toast.error(es.cli.errorGenerico + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClient = async (clientId) => {
    if (!confirm(es.cli.confirmarEliminar)) return

    try {
      await api(`/clients/${clientId}`, { method: 'DELETE' })
      await fetchClients()
      toast.success(es.cli.eliminado)
    } catch (error) {
      toast.error(es.cli.errorEliminar + error.message)
    }
  }

  const handleImportComplete = () => {
    fetchClients()
    if (typeof window !== "undefined" && window.toast) {
      window.toast(es.cli.importados, {
        title: es.cli.exito,
        description: es.cli.listaActualizada
      })
    }
  }

  // Row actions, shared by the table and the phone card (both are in the DOM; CSS picks one).
  function renderActions(client) {
    return (
      <div className='flex flex-wrap items-center justify-end gap-3'>
        <Button
          onClick={() => setEditingClient(client)}
          variant='ghost' size='sm' className='text-accent hover:bg-accent/10 hover:text-accent-strong'
        >
          Editar
        </Button>

        {isAdmin && (
          <Button
            onClick={() => handleDeleteClient(client.id)}
            variant='ghost' size='sm' className='text-red-600 hover:bg-red-50 hover:text-red-700'
          >
            Eliminar
          </Button>
        )}

        {/* NEW: Manage Contacts */}
        <Link
          href={`/contacts/${client.id}`}
          className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'text-accent hover:bg-accent/10 hover:text-accent-strong' })}
        >
          Contactos
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full px-4 lg:px-8 py-8">
      <PageHeader
        title={view === 'suplidores' ? es.sup.verSuplidores : 'Clientes'}
        actions={
          <div className="flex items-center gap-2">
            {suppliersEnabled && (
              <select
                aria-label={es.sup.ver}
                value={view}
                onChange={(e) => setView(e.target.value)}
                className="rounded border p-2 text-sm"
              >
                <option value="clientes">{es.sup.verClientes}</option>
                <option value="suplidores">{es.sup.verSuplidores}</option>
              </select>
            )}
            {view === 'clientes' && (
              <Button variant="outline" onClick={() => setImportModalOpen(true)}>
                Importar CSV
              </Button>
            )}
          </div>
        }
      />

      {suppliersEnabled && view === 'suplidores' ? (
        <SuppliersPanel />
      ) : (
      <>

      <ErrorBanner message={loadError} onRetry={fetchClients} />

      {/* Create/Edit Client Form */}
      <div className='bg-surface rounded-lg shadow p-6 mb-8'>
        <h2 className='text-xl font-semibold mb-4'>
          {editingClient ? es.cli.editar : es.cli.nuevo}
        </h2>

        <form
          onSubmit={editingClient ? handleUpdateClient : handleCreateClient}
          className='grid grid-cols-1 md:grid-cols-2 gap-4'
        >
          <input aria-label={es.cli.empresa}
            type='text'
            placeholder={es.cli.empresa}
            value={editingClient ? editingClient.company_name : newClient.company_name}
            onChange={(e) =>
              editingClient
                ? setEditingClient({ ...editingClient, company_name: e.target.value })
                : setNewClient({ ...newClient, company_name: e.target.value })
            }
            className='border p-2 rounded'
            required
          />

          <input aria-label={es.cli.contacto}
            type='text'
            placeholder={es.cli.contacto}
            value={editingClient ? editingClient.contact_name : newClient.contact_name}
            onChange={(e) =>
              editingClient
                ? setEditingClient({ ...editingClient, contact_name: e.target.value })
                : setNewClient({ ...newClient, contact_name: e.target.value })
            }
            className='border p-2 rounded'
          />

          <input aria-label={es.cli.correo}
            type='email'
            placeholder={es.cli.correo}
            value={editingClient ? editingClient.email : newClient.email}
            onChange={(e) =>
              editingClient
                ? setEditingClient({ ...editingClient, email: e.target.value })
                : setNewClient({ ...newClient, email: e.target.value })
            }
            className='border p-2 rounded'
          />

          <input aria-label={es.cli.telefono}
            type='tel'
            placeholder={es.cli.telefono}
            value={editingClient ? editingClient.phone : newClient.phone}
            onChange={(e) =>
              editingClient
                ? setEditingClient({ ...editingClient, phone: e.target.value })
                : setNewClient({ ...newClient, phone: e.target.value })
            }
            className='border p-2 rounded'
          />

          <input aria-label={es.cli.direccion}
            type='text'
            placeholder={es.cli.direccion}
            value={editingClient ? editingClient.address : newClient.address}
            onChange={(e) =>
              editingClient
                ? setEditingClient({ ...editingClient, address: e.target.value })
                : setNewClient({ ...newClient, address: e.target.value })
            }
            className='border p-2 rounded md:col-span-2'
          />

          <input aria-label={es.cli.rnc}
            type='text'
            placeholder={es.cli.rnc}
            value={editingClient ? editingClient.tax_id : newClient.tax_id}
            onChange={(e) =>
              editingClient
                ? setEditingClient({ ...editingClient, tax_id: e.target.value })
                : setNewClient({ ...newClient, tax_id: e.target.value })
            }
            className='border p-2 rounded'
          />

          <textarea aria-label={es.cli.notas}
            placeholder={es.cli.notas}
            value={editingClient ? editingClient.notes : newClient.notes}
            onChange={(e) =>
              editingClient
                ? setEditingClient({ ...editingClient, notes: e.target.value })
                : setNewClient({ ...newClient, notes: e.target.value })
            }
            className='border p-2 rounded md:col-span-2'
            rows='3'
          />

          {paymentDueEnabled && (
            <div className='md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <PaymentTermsFields
                  value={String((editingClient ? editingClient.default_credit_days : newClient.default_credit_days) ?? '')}
                  onChange={(v) =>
                    editingClient
                      ? setEditingClient({ ...editingClient, default_credit_days: parseDays(v) })
                      : setNewClient({ ...newClient, default_credit_days: parseDays(v) })
                  }
                  className=''
                  inputClass='w-full border p-2 rounded'
                />
              </div>
              <div>
                <label className='block text-sm font-medium mb-2' htmlFor='cliente-terminos-defecto'>{es.cli.terminosDefecto}</label>
                <input
                  id='cliente-terminos-defecto'
                  type='text'
                  aria-label={es.cli.terminosDefecto}
                  value={(editingClient ? editingClient.default_payment_terms : newClient.default_payment_terms) || ''}
                  onChange={(e) =>
                    editingClient
                      ? setEditingClient({ ...editingClient, default_payment_terms: e.target.value })
                      : setNewClient({ ...newClient, default_payment_terms: e.target.value })
                  }
                  className='w-full border p-2 rounded'
                />
                <p className='text-xs text-muted mt-1'>{es.cli.terminosDefectoAyuda}</p>
              </div>
            </div>
          )}

          <div className='md:col-span-2 flex gap-2'>
            <Button type='submit' disabled={loading}>
              {loading ? es.cli.guardando : editingClient ? es.cli.actualizar : es.cli.agregar}
            </Button>

            {editingClient && (
              <Button type='button' variant='outline' onClick={() => setEditingClient(null)}>
                {es.cli.cancelar}
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Clients List */}
      <div className='bg-surface rounded-lg shadow overflow-hidden'>
        <div className='p-4 border-b font-bold'>Lista de Clientes ({clients.length})</div>

        {clients.length === 0 ? (
          <div className='p-8 text-center text-muted'>
            No hay clientes aún. Agrega uno arriba o importa desde CSV!
          </div>
        ) : (
          <ResponsiveList
            bare
            items={clients}
            getKey={(client) => client.id}
            renderCard={(client) => (
              <ListCard
                title={client.company_name}
                subtitle={client.contact_name || undefined}
                fields={[
                  { label: es.cli.colCorreo, value: client.email || '-', wide: true },
                  { label: 'Teléfono', value: client.phone || '-' },
                  { label: 'RCN', value: client.tax_id || '-' },
                  { label: 'Dirección', value: client.address || '-', wide: true },
                  { label: 'Notas', value: client.notes || '-', wide: true },
                ]}
                actions={renderActions(client)}
              />
            )}
          >
          <table className={dt.table}>
            <thead className={dt.thead}>
              <tr>
                <th className={dt.th}>Compañía</th>
                <th className={dt.th}>{es.cli.colContacto}</th>
                <th className={dt.th}>{es.cli.colCorreo}</th>
                <th className={dt.th}>Teléfono</th>
                <th className={dt.th}>Dirección</th>
                <th className={dt.th}>Notas</th>
                <th className={dt.th}>RCN</th>
                <th className={dt.thSticky}>Acciones</th>
              </tr>
            </thead>

            <tbody className={dt.tbody}>
              {clients.map((client) => (
                <tr key={client.id} className={dt.tr}>
                  <td className={dt.tdTrunc} title={client.company_name || undefined}>{client.company_name}</td>
                  <td className={dt.tdTrunc} title={client.contact_name || undefined}>{client.contact_name || '-'}</td>
                  <td className={dt.tdTrunc} title={client.email || undefined}>{client.email || '-'}</td>
                  <td className={dt.td}>{client.phone || '-'}</td>
                  <td className={dt.tdTrunc} title={client.address || undefined}>{client.address || '-'}</td>
                  <td className={dt.tdTrunc} title={client.notes || undefined}>{client.notes || '-'}</td>
                  <td className={dt.td}>{client.tax_id || '-'}</td>

                  <td className={dt.tdSticky}>
                    {renderActions(client)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </ResponsiveList>
        )}
      </div>

      </>
      )}

      <CSVImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportComplete={handleImportComplete}
      />
    </div>
  )
}