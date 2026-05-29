import { useState, useEffect } from 'react';
import { credentialsAPI, facturasAPI } from '../services/api';
import {
  FileText, Calendar, Search, Loader2, Download,
  ChevronDown, ChevronUp, AlertTriangle, Receipt,
} from 'lucide-react';

const formatMoney = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

export default function Facturas() {
  const [credentials, setCredentials] = useState([]);
  const [selectedCuit, setSelectedCuit] = useState('');
  const [mode, setMode] = useState('ultimo-mes');
  const [fechaDesde, setFechaDesde] = useState(monthAgo());
  const [fechaHasta, setFechaHasta] = useState(today());
  const [cbteTipo, setCbteTipo] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedIdx, setExpandedIdx] = useState(null);

  useEffect(() => {
    credentialsAPI.list().then((res) => {
      setCredentials(res.data);
      if (res.data.length > 0) setSelectedCuit(res.data[0].cuit);
    });
  }, []);

  const getCuit = () => selectedCuit.replace(/-/g, '');

  const buscar = async () => {
    const cuit = getCuit();
    if (!cuit) { setError('Selecciona un CUIT'); return; }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      let res;
      if (mode === 'ultimo-mes') {
        res = await facturasAPI.ultimoMes(cuit, { cbte_tipo: cbteTipo || undefined });
      } else {
        res = await facturasAPI.porFecha(cuit, {
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta,
          cbte_tipo: cbteTipo || undefined,
        });
      }
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al consultar facturas');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!result?.data?.facturas?.length) return;
    const headers = ['Fecha', 'Tipo', 'Pto Vta', 'Nro', 'Doc Receptor', 'Nro Doc', 'Total', 'Neto Gravado', 'IVA', 'CAE'];
    const rows = result.data.facturas.map((f) => [
      f.fecha, f.cbte_tipo, f.pto_vta, f.cbte_nro,
      f.doc_tipo, f.doc_nro, f.imp_total, f.imp_neto_gravado, f.imp_iva, f.cae,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facturas_${getCuit()}_${fechaDesde}_${fechaHasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tiposCbte = [
    { value: 0, label: 'Todos' },
    { value: 1, label: 'Factura A' },
    { value: 6, label: 'Factura B' },
    { value: 11, label: 'Factura C' },
    { value: 19, label: 'Factura E' },
    { value: 2, label: 'Nota Débito A' },
    { value: 3, label: 'Nota Crédito A' },
    { value: 7, label: 'Nota Débito B' },
    { value: 8, label: 'Nota Crédito B' },
    { value: 12, label: 'Nota Débito C' },
    { value: 13, label: 'Nota Crédito C' },
    { value: 20, label: 'Nota Débito E' },
    { value: 21, label: 'Nota Crédito E' },
  ];

  const inputStyle = {
    padding: '10px 14px', borderRadius: 8, border: '2px solid #e0e0e0',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', color: '#1a1a2e' }}>Facturas Emitidas</h2>
      <p style={{ color: '#666', margin: '0 0 24px', fontSize: 14 }}>
        Consulta tus comprobantes emitidos via WSFE de ARCA
      </p>

      {/* Filtros */}
      <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* CUIT */}
          <div style={{ minWidth: 200 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>CUIT</label>
            <select
              value={selectedCuit}
              onChange={(e) => setSelectedCuit(e.target.value)}
              style={{ ...inputStyle, width: '100%', background: 'white' }}
            >
              {credentials.map((c) => (
                <option key={c.id} value={c.cuit}>{c.cuit} - {c.alias}</option>
              ))}
            </select>
          </div>

          {/* Modo */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Periodo</label>
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '2px solid #e0e0e0' }}>
              <button
                onClick={() => setMode('ultimo-mes')}
                style={{
                  padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: mode === 'ultimo-mes' ? '#1a1a2e' : 'white',
                  color: mode === 'ultimo-mes' ? 'white' : '#333',
                }}
              >
                Ultimo mes
              </button>
              <button
                onClick={() => setMode('personalizado')}
                style={{
                  padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  borderLeft: '1px solid #e0e0e0',
                  background: mode === 'personalizado' ? '#1a1a2e' : 'white',
                  color: mode === 'personalizado' ? 'white' : '#333',
                }}
              >
                Elegir fechas
              </button>
            </div>
          </div>

          {/* Fechas (solo en modo personalizado) */}
          {mode === 'personalizado' && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Desde</label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Hasta</label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </>
          )}

          {/* Tipo comprobante */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Tipo</label>
            <select
              value={cbteTipo}
              onChange={(e) => setCbteTipo(Number(e.target.value))}
              style={{ ...inputStyle, background: 'white' }}
            >
              {tiposCbte.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Botón buscar */}
          <button
            onClick={buscar}
            disabled={loading}
            style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: '#1a1a2e', color: 'white', cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
              opacity: loading ? 0.6 : 1, height: 42,
            }}
          >
            <Search size={18} /> Buscar
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fff0f0', color: '#d32f2f', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, background: 'white', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <Loader2 size={40} color="#0f3460" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#666', marginTop: 12 }}>Consultando facturas en ARCA...</p>
          <p style={{ color: '#999', fontSize: 13 }}>Esto puede tomar unos segundos</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Resultado */}
      {result && !loading && (
        <>
          {result.success === false ? (
            <div style={{
              background: result.requires_certificate ? '#fff3e0' : '#fff0f0',
              color: result.requires_certificate ? '#e65100' : '#d32f2f',
              padding: 20, borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {result.requires_certificate ? 'Certificado requerido' : 'Error'}
                </div>
                <div style={{ fontSize: 14 }}>{result.error}</div>
              </div>
            </div>
          ) : (
            <div>
              {/* Resumen */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12, marginBottom: 20,
              }}>
                <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a2e' }}>{result.data.cantidad}</div>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Comprobantes</div>
                </div>
                <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#2e7d32' }}>{formatMoney(result.data.total)}</div>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Total facturado</div>
                </div>
                <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>
                    {result.data.fecha_desde} a {result.data.fecha_hasta}
                  </div>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Periodo consultado</div>
                </div>
              </div>

              {/* Botón exportar */}
              {result.data.facturas.length > 0 && (
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={exportCSV}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: '1px solid #e0e0e0',
                      background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      display: 'flex', alignItems: 'center', gap: 6, color: '#333',
                    }}
                  >
                    <Download size={16} /> Exportar CSV
                  </button>
                </div>
              )}

              {/* Lista de facturas */}
              {result.data.facturas.length === 0 ? (
                <div style={{ background: 'white', borderRadius: 12, padding: 40, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                  <Receipt size={48} color="#ccc" />
                  <p style={{ color: '#666', marginTop: 16 }}>No se encontraron comprobantes en el periodo seleccionado.</p>
                </div>
              ) : (
                <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                  {/* Header tabla */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '100px 160px 80px 80px 130px 120px 40px',
                    gap: 8, padding: '12px 20px', background: '#f8f9fa', fontWeight: 600,
                    fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    <span>Fecha</span>
                    <span>Tipo</span>
                    <span>Pto Vta</span>
                    <span>Nro</span>
                    <span style={{ textAlign: 'right' }}>Total</span>
                    <span>CAE</span>
                    <span></span>
                  </div>

                  {result.data.facturas.map((f, idx) => (
                    <div key={`${f.pto_vta}-${f.cbte_tipo_code}-${f.cbte_nro}`}>
                      <button
                        onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                        style={{
                          width: '100%', display: 'grid',
                          gridTemplateColumns: '100px 160px 80px 80px 130px 120px 40px',
                          gap: 8, padding: '14px 20px', border: 'none', background: 'none',
                          cursor: 'pointer', textAlign: 'left', fontSize: 14,
                          borderTop: '1px solid #f0f0f0',
                        }}
                      >
                        <span>{f.fecha}</span>
                        <span style={{ fontSize: 13 }}>{f.cbte_tipo}</span>
                        <span>{String(f.pto_vta).padStart(4, '0')}</span>
                        <span>{f.cbte_nro}</span>
                        <span style={{ textAlign: 'right', fontWeight: 600, color: '#1a1a2e' }}>
                          {formatMoney(f.imp_total)}
                        </span>
                        <span style={{ fontSize: 11, color: '#999', fontFamily: 'monospace' }}>
                          {f.cae ? `${f.cae.slice(0, 6)}...` : '-'}
                        </span>
                        <span style={{ textAlign: 'center' }}>
                          {expandedIdx === idx ? <ChevronUp size={16} color="#666" /> : <ChevronDown size={16} color="#666" />}
                        </span>
                      </button>

                      {expandedIdx === idx && (
                        <div style={{ padding: '0 20px 16px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
                          <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, padding: '16px 0',
                          }}>
                            <div>
                              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>Receptor</div>
                              <div style={{ fontSize: 14, fontWeight: 500 }}>{f.doc_tipo}: {f.doc_nro}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>CAE completo</div>
                              <div style={{ fontSize: 13, fontFamily: 'monospace' }}>{f.cae || '-'}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>Vto CAE</div>
                              <div style={{ fontSize: 14 }}>{f.cae_vto || '-'}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>Neto gravado</div>
                              <div style={{ fontSize: 14 }}>{formatMoney(f.imp_neto_gravado)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>IVA</div>
                              <div style={{ fontSize: 14 }}>{formatMoney(f.imp_iva)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>No gravado</div>
                              <div style={{ fontSize: 14 }}>{formatMoney(f.imp_neto)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>Tributos</div>
                              <div style={{ fontSize: 14 }}>{formatMoney(f.imp_tributos)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>Op. exentas</div>
                              <div style={{ fontSize: 14 }}>{formatMoney(f.imp_op_ex)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>Moneda</div>
                              <div style={{ fontSize: 14 }}>{f.moneda_id} (cotiz: {f.moneda_cotiz})</div>
                            </div>
                          </div>
                          {f.iva_detalle && f.iva_detalle.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', marginBottom: 8 }}>Detalle IVA</div>
                              <div style={{ display: 'grid', gap: 4 }}>
                                {f.iva_detalle.map((iva, i) => (
                                  <div key={i} style={{
                                    display: 'flex', gap: 16, fontSize: 13, background: 'white',
                                    padding: '8px 12px', borderRadius: 6,
                                  }}>
                                    <span>Alicuota ID: {iva.id}</span>
                                    <span>Base: {formatMoney(iva.base_imp)}</span>
                                    <span>Importe: {formatMoney(iva.importe)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
