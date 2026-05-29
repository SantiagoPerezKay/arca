import { useState, useEffect } from 'react';
import { credentialsAPI, reportsAPI, certificatesAPI } from '../services/api';
import { Search, FileText, ClipboardList, Activity, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';

const reportTypes = [
  { key: 'informeCompleto', label: 'Informe Completo', icon: ClipboardList, desc: 'Datos completos del padron (requiere certificado)', color: '#7c4dff' },
  { key: 'consultaCuit', label: 'Consulta CUIT', icon: FileText, desc: 'Validacion basica de CUIT', color: '#1565c0' },
  { key: 'estadoServicio', label: 'Estado Servicios', icon: Activity, desc: 'Verificar que ARCA este online', color: '#2e7d32' },
];

export default function Reports() {
  const [credentials, setCredentials] = useState([]);
  const [selectedCuit, setSelectedCuit] = useState('');
  const [customCuit, setCustomCuit] = useState('');
  const [certStatuses, setCertStatuses] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    credentialsAPI.list().then((res) => {
      setCredentials(res.data);
      if (res.data.length > 0) {
        setSelectedCuit(res.data[0].cuit);
        res.data.forEach((c) => {
          const cuit = c.cuit.replace(/-/g, '');
          certificatesAPI.status(cuit).then((r) => {
            setCertStatuses((prev) => ({ ...prev, [cuit]: r.data }));
          }).catch(() => {});
        });
      }
    });
  }, []);

  const getCuit = () => customCuit.replace(/\D/g, '') || selectedCuit.replace(/-/g, '');

  const runReport = async (type) => {
    const cuit = getCuit();

    if (type === 'estadoServicio') {
      setLoading(true);
      setError('');
      setResult(null);
      try {
        const res = await reportsAPI.estadoServicio();
        setResult({ type, data: res.data });
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al consultar');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!cuit) {
      setError('Ingresa o selecciona un CUIT');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    try {
      let res;
      if (type === 'informeCompleto') {
        res = await reportsAPI.informeCompleto(cuit);
      } else if (type === 'consultaCuit') {
        res = await reportsAPI.consultaCuit(cuit);
      } else {
        res = await reportsAPI[type](cuit);
      }
      setResult({ type, data: res.data });
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al consultar ARCA');
    } finally {
      setLoading(false);
    }
  };

  const renderValue = (value, depth = 0) => {
    if (value === null || value === undefined) return <span style={{ color: '#999' }}>-</span>;
    if (typeof value === 'boolean') return <span style={{ color: value ? '#2e7d32' : '#d32f2f' }}>{value ? 'Si' : 'No'}</span>;
    if (typeof value !== 'object') return <span>{String(value)}</span>;
    if (Array.isArray(value)) {
      if (value.length === 0) return <span style={{ color: '#999' }}>Sin datos</span>;
      return (
        <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
          {value.map((item, i) => (
            <div key={i} style={{ background: '#f8f9fa', borderRadius: 8, padding: 12, marginBottom: 8 }}>
              {typeof item === 'object' ? renderValue(item, depth + 1) : String(item)}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div style={{ display: 'grid', gap: 8, marginLeft: depth > 0 ? 16 : 0 }}>
        {Object.entries(value).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontWeight: 600, color: '#333', minWidth: 180, fontSize: 13 }}>
              {k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}:
            </span>
            <div style={{ flex: 1 }}>{renderValue(v, depth + 1)}</div>
          </div>
        ))}
      </div>
    );
  };

  const currentCuit = getCuit();
  const currentCertStatus = certStatuses[currentCuit];

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', color: '#1a1a2e' }}>Informes ARCA</h2>
      <p style={{ color: '#666', margin: '0 0 24px', fontSize: 14 }}>
        Selecciona un CUIT y el tipo de informe
      </p>

      <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {credentials.length > 0 && (
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>
                CUIT guardado
              </label>
              <select
                value={selectedCuit}
                onChange={(e) => { setSelectedCuit(e.target.value); setCustomCuit(''); }}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 8,
                  border: '2px solid #e0e0e0', fontSize: 14, outline: 'none',
                  background: 'white', boxSizing: 'border-box',
                }}
              >
                {credentials.map((c) => (
                  <option key={c.id} value={c.cuit}>{c.cuit} - {c.alias}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>
              O ingresa un CUIT manualmente
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="Ej: 20123456789"
                value={customCuit}
                onChange={(e) => setCustomCuit(e.target.value.replace(/\D/g, '').slice(0, 11))}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 8,
                  border: '2px solid #e0e0e0', fontSize: 14, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <Search size={20} color="#999" style={{ alignSelf: 'center' }} />
            </div>
          </div>
        </div>

        {currentCuit && currentCertStatus && (
          <div style={{
            marginTop: 12, padding: '10px 16px', borderRadius: 8,
            background: currentCertStatus.ready ? '#e8f5e9' : '#fff3e0',
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
          }}>
            {currentCertStatus.ready
              ? <><ShieldCheck size={16} color="#2e7d32" /> Certificado digital configurado - consultas completas disponibles</>
              : <><AlertTriangle size={16} color="#e65100" /> Sin certificado digital - solo consultas basicas disponibles. Genera el CSR en Credenciales.</>
            }
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: '#fff0f0', color: '#d32f2f', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        {reportTypes.map((rt) => {
          const Icon = rt.icon;
          return (
            <button
              key={rt.key}
              onClick={() => runReport(rt.key)}
              disabled={loading}
              style={{
                background: 'white', borderRadius: 12, padding: 20, border: '2px solid #eee',
                cursor: loading ? 'not-allowed' : 'pointer', textAlign: 'left',
                transition: 'border-color 0.2s, transform 0.2s',
                opacity: loading ? 0.6 : 1,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = rt.color; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#eee'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <Icon size={24} color={rt.color} />
              <div style={{ fontWeight: 600, marginTop: 8, color: '#1a1a2e' }}>{rt.label}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{rt.desc}</div>
            </button>
          );
        })}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Loader2 size={40} color="#0f3460" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#666', marginTop: 12 }}>Consultando ARCA...</p>
        </div>
      )}

      {result && (
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: '#1a1a2e' }}>
              Resultado: {reportTypes.find((r) => r.key === result.type)?.label}
            </h3>
            {result.data.timestamp && (
              <span style={{ fontSize: 12, color: '#999' }}>{new Date(result.data.timestamp).toLocaleString('es-AR')}</span>
            )}
          </div>
          {result.data.success === false ? (
            <div style={{
              background: result.data.requires_certificate ? '#fff3e0' : '#fff0f0',
              color: result.data.requires_certificate ? '#e65100' : '#d32f2f',
              padding: 16, borderRadius: 8,
            }}>
              {result.data.error}
            </div>
          ) : (
            <div style={{ overflow: 'auto' }}>
              {renderValue(result.data.data)}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
