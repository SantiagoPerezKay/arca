import { useState, useEffect } from 'react';
import { credentialsAPI, consultasAPI } from '../services/api';
import {
  Search, Loader2, DollarSign, Globe, CheckCircle2, XCircle,
  Activity, ShieldCheck, FileCheck, CreditCard, ChevronDown, ChevronUp,
} from 'lucide-react';

const inputStyle = {
  padding: '10px 14px', borderRadius: 8, border: '2px solid #e0e0e0',
  fontSize: 14, outline: 'none', boxSizing: 'border-box', width: '100%',
};

const cardStyle = {
  background: 'white', borderRadius: 12, padding: 24,
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 20,
};

const btnStyle = (color = '#1a1a2e') => ({
  padding: '10px 20px', borderRadius: 8, border: 'none',
  background: color, color: 'white', cursor: 'pointer',
  fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
});

const MONEDAS_COMUNES = [
  { id: 'DOL', label: 'Dolar estadounidense (USD)' },
  { id: 'EUR', label: 'Euro (EUR)' },
  { id: '012', label: 'Real brasileno (BRL)' },
  { id: '021', label: 'Libra esterlina (GBP)' },
  { id: '031', label: 'Yen japones (JPY)' },
  { id: '064', label: 'Peso uruguayo (UYU)' },
  { id: '014', label: 'Corona sueca (SEK)' },
  { id: '009', label: 'Franco suizo (CHF)' },
];

const TIPOS_CBTE = [
  { value: 1, label: 'Factura A' },
  { value: 6, label: 'Factura B' },
  { value: 11, label: 'Factura C' },
  { value: 19, label: 'Factura E' },
  { value: 2, label: 'Nota Debito A' },
  { value: 3, label: 'Nota Credito A' },
  { value: 7, label: 'Nota Debito B' },
  { value: 8, label: 'Nota Credito B' },
  { value: 12, label: 'Nota Debito C' },
  { value: 13, label: 'Nota Credito C' },
  { value: 20, label: 'Nota Debito E' },
  { value: 21, label: 'Nota Credito E' },
];

export default function Consultas() {
  const [credentials, setCredentials] = useState([]);
  const [selectedCuit, setSelectedCuit] = useState('');
  const [activeTab, setActiveTab] = useState('constatar');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Constatar comprobante
  const [cuitEmisor, setCuitEmisor] = useState('');
  const [cbteTipo, setCbteTipo] = useState(1);
  const [ptoVta, setPtoVta] = useState('');
  const [cbteNro, setCbteNro] = useState('');
  const [cbteFecha, setCbteFecha] = useState('');
  const [impTotal, setImpTotal] = useState('');
  const [codAutorizacion, setCodAutorizacion] = useState('');

  // Cotizacion
  const [monedaId, setMonedaId] = useState('DOL');

  // Parametros expandidos
  const [expandedParam, setExpandedParam] = useState(null);

  useEffect(() => {
    credentialsAPI.list().then((res) => {
      setCredentials(res.data);
      if (res.data.length > 0) setSelectedCuit(res.data[0].cuit);
    });
  }, []);

  const getCuit = () => selectedCuit.replace(/-/g, '');

  const runQuery = async (fn) => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fn();
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Error al consultar');
    } finally {
      setLoading(false);
    }
  };

  const constatarComprobante = () => {
    const cuit = getCuit();
    if (!cuitEmisor || !ptoVta || !cbteNro || !cbteFecha || !impTotal) {
      setError('Completa todos los campos obligatorios');
      return;
    }
    runQuery(() => consultasAPI.constatarComprobante({
      cuit_emisor: cuitEmisor.replace(/\D/g, ''),
      cbte_tipo: cbteTipo,
      pto_vta: parseInt(ptoVta),
      cbte_nro: parseInt(cbteNro),
      cbte_fecha: cbteFecha,
      imp_total: parseFloat(impTotal),
      cuit_receptor: cuit,
      cod_autorizacion: codAutorizacion,
    }));
  };

  const consultarCotizacion = () => {
    const cuit = getCuit();
    if (!cuit) { setError('Selecciona un CUIT'); return; }
    runQuery(() => consultasAPI.cotizacion(monedaId, cuit));
  };

  const consultarEstadoServicios = () => {
    runQuery(() => consultasAPI.estadoServicios());
  };

  const consultarParametro = (tipo) => {
    const cuit = getCuit();
    if (!cuit) { setError('Selecciona un CUIT'); return; }
    runQuery(() => consultasAPI[tipo](cuit));
  };

  const tabs = [
    { key: 'constatar', label: 'Constatar Comprobante', icon: FileCheck, color: '#7c4dff' },
    { key: 'cotizacion', label: 'Cotizacion Monedas', icon: DollarSign, color: '#2e7d32' },
    { key: 'estado', label: 'Estado Servicios', icon: Activity, color: '#1565c0' },
    { key: 'parametros', label: 'Tablas de Referencia', icon: Globe, color: '#e65100' },
  ];

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', color: '#1a1a2e' }}>Consultas ARCA</h2>
      <p style={{ color: '#666', margin: '0 0 24px', fontSize: 14 }}>
        Constatacion de comprobantes, cotizaciones y parametros de referencia
      </p>

      {/* CUIT selector */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {credentials.length > 0 && (
            <div style={{ minWidth: 250 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>CUIT</label>
              <select
                value={selectedCuit}
                onChange={(e) => setSelectedCuit(e.target.value)}
                style={{ ...inputStyle, background: 'white' }}
              >
                {credentials.map((c) => (
                  <option key={c.id} value={c.cuit}>{c.cuit} - {c.alias}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setResult(null); setError(''); }}
              style={{
                padding: '10px 20px', borderRadius: 8, border: '2px solid',
                borderColor: active ? tab.color : '#e0e0e0',
                background: active ? tab.color : 'white',
                color: active ? 'white' : '#333',
                cursor: 'pointer', fontWeight: 600, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'all 0.2s',
              }}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ background: '#fff0f0', color: '#d32f2f', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* ========= CONSTATAR COMPROBANTE ========= */}
      {activeTab === 'constatar' && (
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 4px', color: '#1a1a2e' }}>Constatar Comprobante Recibido</h3>
          <p style={{ color: '#666', fontSize: 13, margin: '0 0 20px' }}>
            Verifica si una factura que recibiste es valida consultando el CAE en ARCA
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>CUIT Emisor *</label>
              <input
                placeholder="Ej: 20123456789"
                value={cuitEmisor}
                onChange={(e) => setCuitEmisor(e.target.value.replace(/\D/g, '').slice(0, 11))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Tipo Comprobante *</label>
              <select value={cbteTipo} onChange={(e) => setCbteTipo(Number(e.target.value))} style={{ ...inputStyle, background: 'white' }}>
                {TIPOS_CBTE.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Punto de Venta *</label>
              <input
                type="number" placeholder="Ej: 1"
                value={ptoVta} onChange={(e) => setPtoVta(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Nro Comprobante *</label>
              <input
                type="number" placeholder="Ej: 152"
                value={cbteNro} onChange={(e) => setCbteNro(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Fecha Comprobante *</label>
              <input
                type="date" value={cbteFecha}
                onChange={(e) => setCbteFecha(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Importe Total *</label>
              <input
                type="number" step="0.01" placeholder="Ej: 15000.00"
                value={impTotal} onChange={(e) => setImpTotal(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>CAE (opcional)</label>
              <input
                placeholder="Codigo de autorizacion"
                value={codAutorizacion} onChange={(e) => setCodAutorizacion(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <button onClick={constatarComprobante} disabled={loading} style={btnStyle('#7c4dff')}>
              {loading ? <Loader2 size={18} className="spin" /> : <ShieldCheck size={18} />}
              Constatar
            </button>
          </div>
        </div>
      )}

      {/* ========= COTIZACION ========= */}
      {activeTab === 'cotizacion' && (
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 4px', color: '#1a1a2e' }}>Cotizacion Oficial ARCA</h3>
          <p style={{ color: '#666', fontSize: 13, margin: '0 0 20px' }}>
            Obtene la cotizacion oficial del dia para facturacion
          </p>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 300 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Moneda</label>
              <select value={monedaId} onChange={(e) => setMonedaId(e.target.value)} style={{ ...inputStyle, background: 'white' }}>
                {MONEDAS_COMUNES.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <button onClick={consultarCotizacion} disabled={loading} style={btnStyle('#2e7d32')}>
              {loading ? <Loader2 size={18} className="spin" /> : <DollarSign size={18} />}
              Consultar Cotizacion
            </button>
            <button
              onClick={() => consultarParametro('monedas')}
              disabled={loading}
              style={{ ...btnStyle('#666'), background: 'white', color: '#666', border: '1px solid #ddd' }}
            >
              Ver todas las monedas
            </button>
          </div>
        </div>
      )}

      {/* ========= ESTADO SERVICIOS ========= */}
      {activeTab === 'estado' && (
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 4px', color: '#1a1a2e' }}>Estado de Servicios ARCA</h3>
          <p style={{ color: '#666', fontSize: 13, margin: '0 0 20px' }}>
            Verifica si los servicios web de ARCA estan funcionando
          </p>
          <button onClick={consultarEstadoServicios} disabled={loading} style={btnStyle('#1565c0')}>
            {loading ? <Loader2 size={18} className="spin" /> : <Activity size={18} />}
            Verificar Todos
          </button>
        </div>
      )}

      {/* ========= PARAMETROS / TABLAS ========= */}
      {activeTab === 'parametros' && (
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 4px', color: '#1a1a2e' }}>Tablas de Referencia</h3>
          <p style={{ color: '#666', fontSize: 13, margin: '0 0 20px' }}>
            Parametros y tablas de ARCA para facturacion
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { key: 'monedas', label: 'Monedas', icon: DollarSign, color: '#2e7d32' },
              { key: 'paises', label: 'Paises', icon: Globe, color: '#1565c0' },
              { key: 'cuitsPaises', label: 'CUITs por Pais', icon: CreditCard, color: '#7c4dff' },
              { key: 'incoterms', label: 'Incoterms', icon: FileCheck, color: '#e65100' },
              { key: 'tiposComprobante', label: 'Tipos Comprobante', icon: FileCheck, color: '#c62828' },
              { key: 'puntosVenta', label: 'Puntos de Venta', icon: Search, color: '#00695c' },
            ].map((param) => {
              const Icon = param.icon;
              return (
                <button
                  key={param.key}
                  onClick={() => consultarParametro(param.key)}
                  disabled={loading}
                  style={{
                    padding: 16, borderRadius: 10, border: '2px solid #eee',
                    background: 'white', cursor: loading ? 'not-allowed' : 'pointer',
                    textAlign: 'left', transition: 'border-color 0.2s, transform 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = param.color; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#eee'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <Icon size={22} color={param.color} />
                  <div style={{ fontWeight: 600, marginTop: 8, fontSize: 14 }}>{param.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ========= LOADING ========= */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, ...cardStyle }}>
          <Loader2 size={40} color="#0f3460" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#666', marginTop: 12 }}>Consultando ARCA...</p>
        </div>
      )}

      {/* ========= RESULTADO ========= */}
      {result && !loading && (
        <div style={cardStyle}>
          {/* Resultado de constatar */}
          {result.data && result.data.valido !== undefined && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
                padding: 20, borderRadius: 10,
                background: result.data.valido ? '#e8f5e9' : '#ffebee',
              }}>
                {result.data.valido
                  ? <CheckCircle2 size={32} color="#2e7d32" />
                  : <XCircle size={32} color="#d32f2f" />
                }
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: result.data.valido ? '#2e7d32' : '#d32f2f' }}>
                    {result.data.valido ? 'COMPROBANTE VALIDO' : 'COMPROBANTE NO VALIDO'}
                  </div>
                  <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
                    {result.data.cbte_tipo} - Pto Vta: {result.data.pto_vta} - Nro: {result.data.cbte_nro}
                  </div>
                </div>
              </div>
              {result.data.observaciones && result.data.observaciones.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Observaciones:</div>
                  {result.data.observaciones.map((obs, i) => (
                    <div key={i} style={{ background: '#fff3e0', padding: '8px 12px', borderRadius: 6, marginBottom: 4, fontSize: 13 }}>
                      [{obs.code}] {obs.msg}
                    </div>
                  ))}
                </div>
              )}
              {result.data.errores && result.data.errores.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, color: '#d32f2f' }}>Errores:</div>
                  {result.data.errores.map((err, i) => (
                    <div key={i} style={{ background: '#ffebee', padding: '8px 12px', borderRadius: 6, marginBottom: 4, fontSize: 13 }}>
                      [{err.code}] {err.msg}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Resultado de cotizacion */}
          {result.data && result.data.cotizacion !== undefined && (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <DollarSign size={48} color="#2e7d32" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, color: '#666' }}>
                Cotizacion {result.data.moneda}
              </div>
              <div style={{ fontSize: 48, fontWeight: 700, color: '#1a1a2e', margin: '8px 0' }}>
                $ {result.data.cotizacion.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </div>
              {result.data.fecha && (
                <div style={{ fontSize: 13, color: '#999' }}>Fecha: {result.data.fecha}</div>
              )}
            </div>
          )}

          {/* Resultado de estado servicios */}
          {result.data && result.data.wsfe && (
            <div>
              <h3 style={{ margin: '0 0 16px', color: '#1a1a2e' }}>Estado de Servicios</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
                {Object.entries(result.data).map(([key, srv]) => (
                  <div key={key} style={{
                    padding: 16, borderRadius: 10,
                    border: `2px solid ${srv.estado === 'online' ? '#c8e6c9' : '#ffcdd2'}`,
                    background: srv.estado === 'online' ? '#f1f8e9' : '#fff8f8',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      {srv.estado === 'online'
                        ? <CheckCircle2 size={18} color="#2e7d32" />
                        : <XCircle size={18} color="#d32f2f" />
                      }
                      <span style={{ fontWeight: 600, fontSize: 14, textTransform: 'uppercase' }}>{key}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>{srv.nombre}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resultado de listas/parametros (array) */}
          {Array.isArray(result.data) && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: '#1a1a2e' }}>
                  {result.data.length} resultados
                </h3>
              </div>
              <div style={{ maxHeight: 500, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      {result.data.length > 0 && Object.keys(result.data[0]).map((key) => (
                        <th key={key} style={{
                          padding: '10px 12px', textAlign: 'left', fontWeight: 600,
                          borderBottom: '2px solid #e0e0e0', fontSize: 12,
                          textTransform: 'uppercase', color: '#666',
                        }}>
                          {key.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        {Object.values(row).map((val, j) => (
                          <td key={j} style={{ padding: '8px 12px' }}>
                            {val === null || val === undefined ? '-' : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Resultado generico (success false) */}
          {result.success === false && (
            <div style={{
              background: result.requires_certificate ? '#fff3e0' : '#fff0f0',
              color: result.requires_certificate ? '#e65100' : '#d32f2f',
              padding: 16, borderRadius: 8,
            }}>
              {result.error}
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
