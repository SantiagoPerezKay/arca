import { useState, useEffect, useRef } from 'react';
import { credentialsAPI, certificatesAPI } from '../services/api';
import { Plus, Trash2, Edit3, Save, X, KeyRound, ShieldCheck, FileUp, Download, Copy, CheckCircle2 } from 'lucide-react';

export default function Credentials() {
  const [credentials, setCredentials] = useState([]);
  const [certStatuses, setCertStatuses] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ cuit: '', password: '', alias: 'Principal' });
  const [editForm, setEditForm] = useState({ password: '', alias: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [csrData, setCsrData] = useState(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);
  const [uploadingCuit, setUploadingCuit] = useState(null);
  const [uploadingKeyCuit, setUploadingKeyCuit] = useState(null);

  const load = async () => {
    try {
      const res = await credentialsAPI.list();
      setCredentials(res.data);
      res.data.forEach((c) => {
        const cuit = c.cuit.replace(/-/g, '');
        certificatesAPI.status(cuit).then((r) => {
          setCertStatuses((prev) => ({ ...prev, [cuit]: r.data }));
        }).catch(() => {});
      });
    } catch {
      setError('Error al cargar credenciales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await credentialsAPI.create(form);
      setForm({ cuit: '', password: '', alias: 'Principal' });
      setShowForm(false);
      setSuccess('Credencial guardada correctamente');
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar');
    }
  };

  const handleUpdate = async (id) => {
    setError('');
    try {
      const data = {};
      if (editForm.password) data.password = editForm.password;
      if (editForm.alias) data.alias = editForm.alias;
      await credentialsAPI.update(id, data);
      setEditingId(null);
      setSuccess('Credencial actualizada');
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al actualizar');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar esta credencial?')) return;
    try {
      await credentialsAPI.delete(id);
      setSuccess('Credencial eliminada');
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Error al eliminar');
    }
  };

  const handleGenerateCSR = async (cuit) => {
    setError('');
    try {
      const res = await certificatesAPI.generateCSR(cuit);
      setCsrData({ cuit, ...res.data });
      setSuccess('CSR generado. Descarga el archivo y subilo en ARCA.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al generar CSR');
    }
  };

  const handleDownloadCSR = async (cuit) => {
    try {
      await certificatesAPI.downloadCSR(cuit);
    } catch (err) {
      setError('Error al descargar CSR. Generalo primero.');
    }
  };

  const handleUploadCert = async (cuit, file) => {
    setError('');
    try {
      await certificatesAPI.uploadCert(cuit, file);
      setSuccess('Certificado subido correctamente');
      setUploadingCuit(null);
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al subir certificado');
    }
  };

  const handleUploadKey = async (cuit, file) => {
    setError('');
    try {
      await certificatesAPI.uploadKey(cuit, file);
      setSuccess('Clave privada importada correctamente');
      setUploadingKeyCuit(null);
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al subir la clave');
    }
  };

  const copyCSR = () => {
    if (csrData?.csr_pem) {
      navigator.clipboard.writeText(csrData.csr_pem);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatCuit = (value) => {
    const nums = value.replace(/\D/g, '').slice(0, 11);
    if (nums.length <= 2) return nums;
    if (nums.length <= 10) return `${nums.slice(0, 2)}-${nums.slice(2)}`;
    return `${nums.slice(0, 2)}-${nums.slice(2, 10)}-${nums.slice(10)}`;
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: 8,
    border: '2px solid #e0e0e0', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };

  const stepNumberStyle = {
    width: 28, height: 28, minWidth: 28, borderRadius: '50%',
    background: '#1a1a2e', color: 'white', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, color: '#1a1a2e' }}>Credenciales ARCA</h2>
          <p style={{ color: '#666', margin: '4px 0 0', fontSize: 14 }}>
            CUIT/CUIL, claves fiscales y certificados digitales
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 8,
            background: showForm ? '#f44336' : '#1a1a2e',
            color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600,
          }}
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? 'Cancelar' : 'Agregar'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fff0f0', color: '#d32f2f', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          {success}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 16px', color: '#1a1a2e' }}>Nueva credencial</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>CUIT/CUIL</label>
              <input
                style={inputStyle}
                placeholder="20-12345678-9"
                value={form.cuit}
                onChange={(e) => setForm({ ...form, cuit: formatCuit(e.target.value) })}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Clave Fiscal</label>
              <input
                type="password"
                style={inputStyle}
                placeholder="Tu clave fiscal"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Alias</label>
              <input
                style={inputStyle}
                placeholder="Ej: Empresa, Personal"
                value={form.alias}
                onChange={(e) => setForm({ ...form, alias: e.target.value })}
              />
            </div>
          </div>
          <button type="submit" style={{
            marginTop: 16, padding: '10px 24px', borderRadius: 8,
            background: '#1a1a2e', color: 'white', border: 'none',
            cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Save size={18} /> Guardar
          </button>
        </form>
      )}

      {loading ? (
        <p style={{ color: '#666' }}>Cargando...</p>
      ) : credentials.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 12, padding: 40, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <KeyRound size={48} color="#ccc" />
          <p style={{ color: '#666', marginTop: 16 }}>No hay credenciales cargadas. Agrega tu CUIT/CUIL para comenzar.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {credentials.map((cred) => {
            const cuitClean = cred.cuit.replace(/-/g, '');
            const certStatus = certStatuses[cuitClean];
            return (
              <div key={cred.id} style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, background: '#e8f5e9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <KeyRound size={20} color="#2e7d32" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16, color: '#1a1a2e' }}>{cred.cuit}</div>
                      <div style={{ fontSize: 13, color: '#666' }}>{cred.alias}</div>
                    </div>
                    {certStatus?.ready && (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: '#e8f5e9', color: '#2e7d32', padding: '4px 10px',
                        borderRadius: 6, fontSize: 12, fontWeight: 600,
                      }}>
                        <ShieldCheck size={14} /> Certificado OK
                      </span>
                    )}
                  </div>

                  {editingId === cred.id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="password" placeholder="Nueva clave" style={{ ...inputStyle, width: 160 }}
                        value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
                      <input placeholder="Alias" style={{ ...inputStyle, width: 120 }}
                        value={editForm.alias} onChange={(e) => setEditForm({ ...editForm, alias: e.target.value })} />
                      <button onClick={() => handleUpdate(cred.id)} style={{ background: '#2e7d32', color: 'white', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}>
                        <Save size={18} />
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ background: '#666', color: 'white', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}>
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setEditingId(cred.id); setEditForm({ password: '', alias: cred.alias }); }}
                        style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}>
                        <Edit3 size={18} />
                      </button>
                      <button onClick={() => handleDelete(cred.id)}
                        style={{ background: '#ffebee', color: '#d32f2f', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid #f0f0f0', padding: '12px 20px', background: '#fafafa', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleGenerateCSR(cuitClean)}
                    style={{
                      padding: '8px 16px', borderRadius: 6, border: '1px solid #e0e0e0',
                      background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      display: 'flex', alignItems: 'center', gap: 6, color: '#333',
                    }}
                  >
                    <ShieldCheck size={14} /> 1. Generar CSR
                  </button>
                  {certStatus?.has_csr && (
                    <button
                      onClick={() => handleDownloadCSR(cuitClean)}
                      style={{
                        padding: '8px 16px', borderRadius: 6, border: '1px solid #1565c0',
                        background: '#e3f2fd', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 6, color: '#1565c0',
                      }}
                    >
                      <Download size={14} /> 2. Descargar CSR
                    </button>
                  )}
                  <button
                    onClick={() => setUploadingCuit(uploadingCuit === cuitClean ? null : cuitClean)}
                    style={{
                      padding: '8px 16px', borderRadius: 6, border: '1px solid #e0e0e0',
                      background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      display: 'flex', alignItems: 'center', gap: 6, color: '#333',
                    }}
                  >
                    <FileUp size={14} /> 3. Subir Certificado (.crt)
                  </button>
                  {uploadingCuit === cuitClean && (
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".crt,.pem,.cer"
                      onChange={(e) => {
                        if (e.target.files[0]) handleUploadCert(cuitClean, e.target.files[0]);
                      }}
                      style={{ fontSize: 13 }}
                    />
                  )}
                  <button
                    onClick={() => setUploadingKeyCuit(uploadingKeyCuit === cuitClean ? null : cuitClean)}
                    title="Importar una clave privada .key existente (si ya tenes un certificado autorizado en ARCA)"
                    style={{
                      padding: '8px 16px', borderRadius: 6, border: '1px dashed #999',
                      background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      display: 'flex', alignItems: 'center', gap: 6, color: '#666',
                    }}
                  >
                    <KeyRound size={14} /> Importar clave (.key)
                  </button>
                  {uploadingKeyCuit === cuitClean && (
                    <input
                      type="file"
                      accept=".key,.pem"
                      onChange={(e) => {
                        if (e.target.files[0]) handleUploadKey(cuitClean, e.target.files[0]);
                      }}
                      style={{ fontSize: 13 }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {csrData && (
        <div style={{ background: 'white', borderRadius: 12, padding: 24, marginTop: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: '#1a1a2e' }}>Certificado para CUIT {csrData.cuit}</h3>
            <button onClick={() => setCsrData(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} color="#666" />
            </button>
          </div>

          <p style={{ color: '#666', fontSize: 14, margin: '0 0 20px' }}>
            Segui estos 4 pasos para vincular tu certificado digital con ARCA:
          </p>

          {/* PASO 1 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={stepNumberStyle}>1</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#1a1a2e', marginBottom: 6 }}>Descarga el archivo CSR</div>
              <button
                onClick={() => handleDownloadCSR(csrData.cuit)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 6, border: '1px solid #1565c0',
                  background: '#e3f2fd', color: '#1565c0', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                }}
              >
                <Download size={14} /> Descargar {csrData.cuit}.csr
              </button>
            </div>
          </div>

          {/* PASO 2 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={stepNumberStyle}>2</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#1a1a2e', marginBottom: 6 }}>
                Carga el CSR en ARCA y descarga el certificado (.crt)
              </div>
              <p style={{ color: '#666', fontSize: 13, margin: '0 0 8px', lineHeight: 1.5 }}>
                Ingresa con tu clave fiscal al Administrador de Certificados Digitales,
                crea un alias, subi el archivo .csr que descargaste y luego descarga el certificado .crt.
              </p>
              <a
                href="https://serviciosweb.afip.gob.ar/clavefiscal/adminrel/detalleCertificado.aspx"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 6, border: 'none',
                  background: '#1a1a2e', color: 'white', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                }}
              >
                <ShieldCheck size={14} /> Abrir ARCA - Certificados Digitales
              </a>
            </div>
          </div>

          {/* PASO 3 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={stepNumberStyle}>3</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#1a1a2e', marginBottom: 6 }}>
                Subi el certificado .crt aca en la app
              </div>
              <p style={{ color: '#666', fontSize: 13, margin: '0 0 8px', lineHeight: 1.5 }}>
                Usa el boton "3. Subir Certificado (.crt)" de la tarjeta de tu credencial (arriba).
              </p>
            </div>
          </div>

          {/* PASO 4 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <div style={stepNumberStyle}>4</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#1a1a2e', marginBottom: 6 }}>
                Autoriza los servicios web en ARCA
              </div>
              <p style={{ color: '#666', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                En el "Administrador de Relaciones de Clave Fiscal" autoriza los servicios:
                <b> Facturacion Electronica (wsfe)</b>, <b>Factura de Exportacion (wsfex)</b>,
                <b> Constatacion de Comprobantes (wscdc)</b> y <b>Padron A13</b>, asociandolos a este certificado.
              </p>
            </div>
          </div>

          {/* CSR content (opcional, colapsable) */}
          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: '#666', fontWeight: 500 }}>
              Ver contenido del CSR (texto)
            </summary>
            <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 16, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button onClick={copyCSR} style={{
                  display: 'flex', alignItems: 'center', gap: 4, background: copied ? '#e8f5e9' : '#e3f2fd',
                  color: copied ? '#2e7d32' : '#1565c0', border: 'none', borderRadius: 6, padding: '4px 10px',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}>
                  {copied ? <><CheckCircle2 size={14} /> Copiado!</> : <><Copy size={14} /> Copiar</>}
                </button>
              </div>
              <pre style={{ fontSize: 11, lineHeight: 1.4, overflow: 'auto', maxHeight: 200, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {csrData.csr_pem}
              </pre>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
