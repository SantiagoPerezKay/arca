import { useState } from 'react';
import { clientesAPI } from '../services/api';
import { useCliente } from '../context/ClienteContext';
import { Plus, Trash2, Edit3, Save, X, Users, Search, Loader2, Info } from 'lucide-react';
import { reportsAPI } from '../services/api';

const inputStyle = {
  width: '100%', padding: '12px 16px', borderRadius: 8,
  border: '2px solid #e0e0e0', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};

const formatCuit = (value) => {
  const nums = value.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 2) return nums;
  if (nums.length <= 10) return `${nums.slice(0, 2)}-${nums.slice(2)}`;
  return `${nums.slice(0, 2)}-${nums.slice(2, 10)}-${nums.slice(10)}`;
};

export default function Clientes() {
  const { clientes, reload } = useCliente();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ cuit: '', razon_social: '', alias: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ razon_social: '', alias: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lookingUp, setLookingUp] = useState(false);

  const showMsg = (setter, msg) => {
    setter(msg);
    setTimeout(() => setter(''), 3000);
  };

  // Autocompletar razon social consultando el padron
  const buscarPadron = async () => {
    const cuit = form.cuit.replace(/\D/g, '');
    if (cuit.length !== 11) { setError('Ingresa un CUIT completo para buscar'); return; }
    setLookingUp(true);
    setError('');
    try {
      const res = await reportsAPI.informeCompleto(cuit);
      const data = res.data?.data;
      if (data) {
        const nombre = [data.razonSocial, data.apellido, data.nombre]
          .filter(Boolean).join(' ').trim();
        if (nombre) setForm((f) => ({ ...f, razon_social: nombre }));
        else setError('No se encontro razon social en el padron');
      }
    } catch {
      setError('No se pudo consultar el padron (verifica el certificado)');
    } finally {
      setLookingUp(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await clientesAPI.create(form);
      setForm({ cuit: '', razon_social: '', alias: '' });
      setShowForm(false);
      showMsg(setSuccess, 'Cliente agregado');
      reload();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar');
    }
  };

  const handleUpdate = async (id) => {
    try {
      await clientesAPI.update(id, editForm);
      setEditingId(null);
      showMsg(setSuccess, 'Cliente actualizado');
      reload();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al actualizar');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar este cliente?')) return;
    try {
      await clientesAPI.delete(id);
      showMsg(setSuccess, 'Cliente eliminado');
      reload();
    } catch {
      setError('Error al eliminar');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, color: '#1a1a2e' }}>Clientes</h2>
          <p style={{ color: '#666', margin: '4px 0 0', fontSize: 14 }}>
            CUITs que representas. Selecciona un cliente arriba para operar en su nombre.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
            borderRadius: 8, background: showForm ? '#f44336' : '#1a1a2e',
            color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600,
          }}
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? 'Cancelar' : 'Agregar cliente'}
        </button>
      </div>

      {error && <div style={{ background: '#fff0f0', color: '#d32f2f', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>{error}</div>}
      {success && <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>{success}</div>}

      {/* Aviso explicativo sobre la autorizacion en ARCA */}
      <div style={{
        background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10,
        padding: 20, marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Info size={20} color="#f57c00" />
          <h3 style={{ margin: 0, fontSize: 15, color: '#795548' }}>
            Importante: antes de operar por un cliente, el cliente debe autorizarte en ARCA
          </h3>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: '#6d5840', lineHeight: 1.6 }}>
          Para que el sistema pueda emitir facturas o consultar datos <b>en nombre de un cliente</b>,
          el cliente tiene que darte permiso por única vez desde su Clave Fiscal de ARCA.
          Es un trámite simple que hace el cliente (o vos con su clave), una sola vez por cada servicio.
        </p>

        <details style={{ fontSize: 13.5, color: '#6d5840' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#795548', marginBottom: 8 }}>
            Ver cómo autorizar a un contador en ARCA (paso a paso)
          </summary>
          <ol style={{ margin: '12px 0 0', paddingLeft: 20, lineHeight: 1.8 }}>
            <li>El <b>cliente</b> ingresa a <b>arca.gob.ar</b> con <b>su</b> Clave Fiscal.</li>
            <li>Entra a <b>"Administrador de Relaciones de Clave Fiscal"</b>.</li>
            <li>Hace clic en <b>"Nueva Relación"</b>.</li>
            <li>
              En <b>"Representante"</b>, ingresa el <b>CUIT del contador</b> (el tuyo, el que tiene el certificado en este sistema).
            </li>
            <li>
              En <b>"Servicio"</b>, busca y selecciona los servicios que el contador va a usar, por ejemplo:
              <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
                <li><b>Comprobantes de Exportación</b> (para Factura E)</li>
                <li><b>Facturación Electrónica</b> (para Factura A/B/C)</li>
                <li><b>Servicio Consulta Padrón A13</b> (para informes)</li>
              </ul>
            </li>
            <li>Confirma. La autorización queda activa de inmediato.</li>
          </ol>
          <p style={{ margin: '12px 0 0', fontSize: 13, fontStyle: 'italic' }}>
            Nota: el contador NO necesita un certificado por cada cliente. Usa siempre su propio
            certificado y actúa "en representación" del cliente gracias a esta autorización.
          </p>
        </details>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 16px', color: '#1a1a2e' }}>Nuevo cliente</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 16, alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>CUIT</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={inputStyle}
                  placeholder="30-12345678-9"
                  value={form.cuit}
                  onChange={(e) => setForm({ ...form, cuit: formatCuit(e.target.value) })}
                  required
                />
                <button type="button" onClick={buscarPadron} disabled={lookingUp} title="Buscar razon social en el padron"
                  style={{ padding: '0 12px', borderRadius: 8, border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>
                  {lookingUp ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Razon Social / Nombre</label>
              <input style={inputStyle} placeholder="Nombre del cliente" value={form.razon_social}
                onChange={(e) => setForm({ ...form, razon_social: e.target.value })} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Alias (opcional)</label>
              <input style={inputStyle} placeholder="Ej: Cliente A" value={form.alias}
                onChange={(e) => setForm({ ...form, alias: e.target.value })} />
            </div>
          </div>
          <button type="submit" style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, background: '#1a1a2e', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Save size={18} /> Guardar
          </button>
        </form>
      )}

      {clientes.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 12, padding: 40, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <Users size={48} color="#ccc" />
          <p style={{ color: '#666', marginTop: 16 }}>No hay clientes cargados. Agrega los CUITs que representas.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {clientes.map((c) => (
            <div key={c.id} style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e3f2fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={20} color="#1565c0" />
                </div>
                {editingId === c.id ? (
                  <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                    <input placeholder="Razon social" style={{ ...inputStyle, width: 'auto', flex: 2 }}
                      value={editForm.razon_social} onChange={(e) => setEditForm({ ...editForm, razon_social: e.target.value })} />
                    <input placeholder="Alias" style={{ ...inputStyle, width: 'auto', flex: 1 }}
                      value={editForm.alias} onChange={(e) => setEditForm({ ...editForm, alias: e.target.value })} />
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16, color: '#1a1a2e' }}>
                      {c.razon_social || c.alias || 'Sin nombre'}
                    </div>
                    <div style={{ fontSize: 13, color: '#666' }}>
                      CUIT {c.cuit}{c.alias && c.razon_social ? ` · ${c.alias}` : ''}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {editingId === c.id ? (
                  <>
                    <button onClick={() => handleUpdate(c.id)} style={{ background: '#2e7d32', color: 'white', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><Save size={18} /></button>
                    <button onClick={() => setEditingId(null)} style={{ background: '#666', color: 'white', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={18} /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditingId(c.id); setEditForm({ razon_social: c.razon_social, alias: c.alias }); }} style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><Edit3 size={18} /></button>
                    <button onClick={() => handleDelete(c.id)} style={{ background: '#ffebee', color: '#d32f2f', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><Trash2 size={18} /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}
