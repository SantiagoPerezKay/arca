import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { KeyRound, FileSearch, Receipt, History, ArrowRight, ShieldCheck } from 'lucide-react';

const cards = [
  {
    title: 'Credenciales ARCA',
    desc: 'Administra tus CUIT/CUIL y claves fiscales para consultas automatizadas.',
    icon: KeyRound,
    path: '/credentials',
    color: '#e8f5e9',
    iconColor: '#2e7d32',
  },
  {
    title: 'Consultar Informes',
    desc: 'Obtene informes de padron, constancias, actividades, impuestos y mas.',
    icon: FileSearch,
    path: '/reports',
    color: '#e3f2fd',
    iconColor: '#1565c0',
  },
  {
    title: 'Facturas Emitidas',
    desc: 'Consulta tus facturas del ultimo mes o de cualquier fecha que quieras.',
    icon: Receipt,
    path: '/facturas',
    color: '#fce4ec',
    iconColor: '#c62828',
  },
  {
    title: 'Consultas',
    desc: 'Constatar comprobantes, cotizaciones oficiales, tablas de referencia y estado de servicios.',
    icon: ShieldCheck,
    path: '/consultas',
    color: '#f3e5f5',
    iconColor: '#7c4dff',
  },
  {
    title: 'Historial',
    desc: 'Revisa todas las consultas realizadas anteriormente.',
    icon: History,
    path: '/history',
    color: '#fff3e0',
    iconColor: '#e65100',
  },
];

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ margin: 0, fontSize: 26, color: '#1a1a2e' }}>
          Bienvenido, {user?.username}
        </h2>
        <p style={{ color: '#666', marginTop: 4 }}>
          Consulta informacion de ARCA (ex AFIP) sin necesidad de entrar al sitio.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
        }}
      >
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.path}
              to={card.path}
              style={{
                background: 'white',
                borderRadius: 12,
                padding: 24,
                textDecoration: 'none',
                color: 'inherit',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: card.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={24} color={card.iconColor} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: '#1a1a2e' }}>{card.title}</h3>
                <p style={{ margin: '8px 0 0', color: '#666', fontSize: 14, lineHeight: 1.5 }}>
                  {card.desc}
                </p>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: '#0f3460',
                  fontWeight: 600,
                  fontSize: 14,
                  marginTop: 'auto',
                }}
              >
                Ir <ArrowRight size={16} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
