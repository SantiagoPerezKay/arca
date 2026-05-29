import { useState, useEffect } from 'react';
import { credentialsAPI, facturasAPI, consultasAPI } from '../services/api';
import { FileText, Loader2, CheckCircle2, XCircle, Globe, Receipt } from 'lucide-react';

const inputStyle = {
  padding: '10px 14px', borderRadius: 8, border: '2px solid #e0e0e0',
  fontSize: 14, outline: 'none', boxSizing: 'border-box', width: '100%',
};
const labelStyle = { display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 };
const cardStyle = {
  background: 'white', borderRadius: 12, padding: 24,
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 20,
};

const MONEDAS = [
  { id: 'DOL', label: 'Dolar (USD)' },
  { id: 'EUR', label: 'Euro (EUR)' },
  { id: '012', label: 'Real (BRL)' },
  { id: '021', label: 'Libra (GBP)' },
];

export default function EmitirFactura() {
  const [credentials, setCredentials] = useState([]);
  const [selectedCuit, setSelectedCuit] = useState('');
  const [tipo, setTipo] = useState('nacional'); // nacional | exportacion
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Factura nacional (C/B/A)
  const [nac, setNac] = useState({
    pto_vta: 1, cbte_tipo: 11, doc_tipo: 99, doc_nro: '0',
    imp_neto: '', imp_iva: '0', concepto: 2, condicion_iva_receptor: 5,
  });

  // Factura E (exportacion) - punto 3 = Comprobantes de Exportacion Web Services
  const [exp, setExp] = useState({
    pto_vta: 3, cliente: '', cuit_pais_cliente: '', domicilio_cliente: '',
    dst_pais: 212, moneda_id: 'DOL', moneda_cotiz: '', descripcion: '', imp_total: '',
  });

  useEffect(() => {
    credentialsAPI.list().then((res) => {
      setCredentials(res.data);
      if (res.data.length > 0) setSelectedCuit(res.data[0].cuit);
    });
  }, []);

  const getCuit = () => selectedCuit.replace(/-/g, '');

  const cargarCotizacion = async () => {
    try {
      const res = await consultasAPI.cotizacion(exp.moneda_id, getCuit());
      if (res.data?.data?.cotizacion) {
        setExp({ ...exp, moneda_cotiz: String(res.data.data.cotizacion) });
      }
    } catch {
      setError('No se pudo obtener la cotizacion');
    }
  };

  const emitirNacional = async () => {
    setError(''); setResult(null); setLoading(true);
    try {
      const res = await facturasAPI.emitir({
        cuit: getCuit(),
        pto_vta: Number(nac.pto_vta),
        cbte_tipo: Number(nac.cbte_tipo),
        doc_tipo: Number(nac.doc_tipo),
        doc_nro: nac.doc_nro || '0',
        imp_neto: parseFloat(nac.imp_neto),
        imp_iva: parseFloat(nac.imp_iva || '0'),
        concepto: Number(nac.concepto),
        condicion_iva_receptor: Number(nac.condicion_iva_receptor),
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al emitir');
    } finally { setLoading(false); }
  };

  const emitirExportacion = async () => {
    setError(''); setResult(null); setLoading(true);
    try {
      const res = await facturasAPI.emitirExportacion({
        cuit: getCuit(),
        pto_vta: Number(exp.pto_vta),
        cliente: exp.cliente,
        cuit_pais_cliente: exp.cuit_pais_cliente,
        domicilio_cliente: exp.domicilio_cliente,
        dst_pais: Number(exp.dst_pais),
        moneda_id: exp.moneda_id,
        moneda_cotiz: parseFloat(exp.moneda_cotiz),
        descripcion: exp.descripcion,
        imp_total: parseFloat(exp.imp_total),
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al emitir');
    } finally { setLoading(false); }
  };

  const renderErrores = (r) => (
    <>
      {r.errores?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {r.errores.map((e, i) => (
            <div key={i} style={{ background: '#ffebee', padding: '8px 12px', borderRadius: 6, marginBottom: 4, fontSize: 13 }}>
              [{e.code}] {e.msg}
            </div>
          ))}
        </div>
      )}
      {r.observaciones?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {r.observaciones.map((o, i) => (
            <div key={i} style={{ background: '#fff3e0', padding: '8px 12px', borderRadius: 6, marginBottom: 4, fontSize: 13 }}>
              [{o.code}] {o.msg}
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', color: '#1a1a2e' }}>Emitir Factura</h2>
      <p style={{ color: '#666', margin: '0 0 24px', fontSize: 14 }}>
        Emite comprobantes electronicos directamente desde la app via ARCA
      </p>

      <div style={{
        background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8,
        padding: 12, marginBottom: 20, fontSize: 13, color: '#795548',
      }}>
        <b>Importante:</b> Solo funciona con puntos de venta de tipo <b>"Web Services"</b> en ARCA
        (NO los de "Factura en Linea"). Para Factura E usa el punto de
        "Comprobantes de Exportacion - Web Services". Las facturas emitidas aca SI se consultan luego en la seccion Facturas.
      </div>

      {/* CUIT */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 250 }}>
            <label style={labelStyle}>CUIT Emisor</label>
            <select value={selectedCuit} onChange={(e) => setSelectedCuit(e.target.value)} style={{ ...inputStyle, background: 'white' }}>
              {credentials.map((c) => (
                <option key={c.id} value={c.cuit}>{c.cuit} - {c.alias}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs tipo */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => { setTipo('nacional'); setResult(null); }}
          style={{
            padding: '10px 20px', borderRadius: 8, border: '2px solid',
            borderColor: tipo === 'nacional' ? '#1565c0' : '#e0e0e0',
            background: tipo === 'nacional' ? '#1565c0' : 'white',
            color: tipo === 'nacional' ? 'white' : '#333',
            cursor: 'pointer', fontWeight: 600, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <Receipt size={18} /> Factura A/B/C (Nacional)
        </button>
        <button
          onClick={() => { setTipo('exportacion'); setResult(null); }}
          style={{
            padding: '10px 20px', borderRadius: 8, border: '2px solid',
            borderColor: tipo === 'exportacion' ? '#2e7d32' : '#e0e0e0',
            background: tipo === 'exportacion' ? '#2e7d32' : 'white',
            color: tipo === 'exportacion' ? 'white' : '#333',
            cursor: 'pointer', fontWeight: 600, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <Globe size={18} /> Factura E (Exportacion)
        </button>
      </div>

      {error && (
        <div style={{ background: '#fff0f0', color: '#d32f2f', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* FACTURA NACIONAL */}
      {tipo === 'nacional' && (
        <div style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <div>
              <label style={labelStyle}>Tipo</label>
              <select value={nac.cbte_tipo} onChange={(e) => setNac({ ...nac, cbte_tipo: e.target.value })} style={{ ...inputStyle, background: 'white' }}>
                <option value={11}>Factura C</option>
                <option value={6}>Factura B</option>
                <option value={1}>Factura A</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Punto de Venta</label>
              <input type="number" value={nac.pto_vta} onChange={(e) => setNac({ ...nac, pto_vta: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Concepto</label>
              <select value={nac.concepto} onChange={(e) => setNac({ ...nac, concepto: e.target.value })} style={{ ...inputStyle, background: 'white' }}>
                <option value={2}>Servicios</option>
                <option value={1}>Productos</option>
                <option value={3}>Productos y Servicios</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Tipo Doc Receptor</label>
              <select value={nac.doc_tipo} onChange={(e) => setNac({ ...nac, doc_tipo: e.target.value })} style={{ ...inputStyle, background: 'white' }}>
                <option value={99}>Consumidor Final</option>
                <option value={80}>CUIT</option>
                <option value={96}>DNI</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Nro Doc Receptor</label>
              <input value={nac.doc_nro} onChange={(e) => setNac({ ...nac, doc_nro: e.target.value })} style={inputStyle} placeholder="0 para consumidor final" />
            </div>
            <div>
              <label style={labelStyle}>Importe Neto</label>
              <input type="number" step="0.01" value={nac.imp_neto} onChange={(e) => setNac({ ...nac, imp_neto: e.target.value })} style={inputStyle} placeholder="Ej: 10000.00" />
            </div>
            {nac.cbte_tipo != 11 && (
              <div>
                <label style={labelStyle}>IVA (21%)</label>
                <input type="number" step="0.01" value={nac.imp_iva} onChange={(e) => setNac({ ...nac, imp_iva: e.target.value })} style={inputStyle} />
              </div>
            )}
          </div>
          <button onClick={emitirNacional} disabled={loading} style={{
            marginTop: 20, padding: '12px 28px', borderRadius: 8, border: 'none',
            background: '#1565c0', color: 'white', cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {loading ? <Loader2 size={18} className="spin" /> : <FileText size={18} />}
            Emitir Factura
          </button>
        </div>
      )}

      {/* FACTURA EXPORTACION */}
      {tipo === 'exportacion' && (
        <div style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <label style={labelStyle}>Punto de Venta</label>
              <input type="number" value={exp.pto_vta} onChange={(e) => setExp({ ...exp, pto_vta: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Cliente (nombre)</label>
              <input value={exp.cliente} onChange={(e) => setExp({ ...exp, cliente: e.target.value })} style={inputStyle} placeholder="Nombre del cliente exterior" />
            </div>
            <div>
              <label style={labelStyle}>Domicilio Cliente</label>
              <input value={exp.domicilio_cliente} onChange={(e) => setExp({ ...exp, domicilio_cliente: e.target.value })} style={inputStyle} placeholder="Direccion exterior" />
            </div>
            <div>
              <label style={labelStyle}>CUIT Pais Cliente</label>
              <input value={exp.cuit_pais_cliente} onChange={(e) => setExp({ ...exp, cuit_pais_cliente: e.target.value })} style={inputStyle} placeholder="Ej: 50000000016 (USA)" />
            </div>
            <div>
              <label style={labelStyle}>Codigo Pais Destino</label>
              <input type="number" value={exp.dst_pais} onChange={(e) => setExp({ ...exp, dst_pais: e.target.value })} style={inputStyle} placeholder="212 = USA" />
            </div>
            <div>
              <label style={labelStyle}>Moneda</label>
              <select value={exp.moneda_id} onChange={(e) => setExp({ ...exp, moneda_id: e.target.value })} style={{ ...inputStyle, background: 'white' }}>
                {MONEDAS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Cotizacion</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" step="0.01" value={exp.moneda_cotiz} onChange={(e) => setExp({ ...exp, moneda_cotiz: e.target.value })} style={inputStyle} placeholder="Ej: 1000" />
                <button onClick={cargarCotizacion} style={{ padding: '0 12px', borderRadius: 8, border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
                  Auto
                </button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Importe Total ({exp.moneda_id})</label>
              <input type="number" step="0.01" value={exp.imp_total} onChange={(e) => setExp({ ...exp, imp_total: e.target.value })} style={inputStyle} placeholder="Ej: 500" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Descripcion del Servicio</label>
              <input value={exp.descripcion} onChange={(e) => setExp({ ...exp, descripcion: e.target.value })} style={inputStyle} placeholder="Ej: Servicios de desarrollo de software" />
            </div>
          </div>
          <button onClick={emitirExportacion} disabled={loading} style={{
            marginTop: 20, padding: '12px 28px', borderRadius: 8, border: 'none',
            background: '#2e7d32', color: 'white', cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {loading ? <Loader2 size={18} className="spin" /> : <Globe size={18} />}
            Emitir Factura E
          </button>
        </div>
      )}

      {/* RESULTADO */}
      {result && (
        <div style={cardStyle}>
          {result.success ? (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
                padding: 20, borderRadius: 10, background: '#e8f5e9',
              }}>
                <CheckCircle2 size={32} color="#2e7d32" />
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#2e7d32' }}>FACTURA EMITIDA</div>
                  <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
                    {result.data.cbte_tipo} {String(result.data.pto_vta).padStart(4, '0')}-{String(result.data.cbte_nro).padStart(8, '0')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <div><div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase' }}>CAE</div><div style={{ fontFamily: 'monospace', fontSize: 14 }}>{result.data.cae}</div></div>
                <div><div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase' }}>Vto CAE</div><div style={{ fontSize: 14 }}>{result.data.cae_vto}</div></div>
                <div><div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase' }}>Total</div><div style={{ fontSize: 14, fontWeight: 600 }}>{result.data.imp_total} {result.data.moneda_id || 'ARS'}</div></div>
                <div><div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase' }}>Fecha</div><div style={{ fontSize: 14 }}>{result.data.fecha}</div></div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: 20, borderRadius: 10, background: '#ffebee',
              }}>
                <XCircle size={32} color="#d32f2f" />
                <div style={{ fontSize: 18, fontWeight: 700, color: '#d32f2f' }}>
                  {result.error || 'No se pudo emitir'}
                </div>
              </div>
              {renderErrores(result)}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
