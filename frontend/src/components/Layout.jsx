import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  KeyRound,
  FileSearch,
  Receipt,
  History,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/credentials', label: 'Credenciales', icon: KeyRound },
  { path: '/reports', label: 'Informes', icon: FileSearch },
  { path: '/facturas', label: 'Facturas', icon: Receipt },
  { path: '/consultas', label: 'Consultas', icon: ShieldCheck },
  { path: '/history', label: 'Historial', icon: History },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f2f5' }}>
      <aside
        style={{
          width: 260,
          background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          height: '100vh',
          zIndex: 100,
          transform: sidebarOpen ? 'translateX(0)' : undefined,
        }}
        className="sidebar"
      >
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>
            ARCA Informes
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.6 }}>ex AFIP</p>
        </div>

        <nav style={{ flex: 1, padding: '16px 12px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 8,
                  color: 'white',
                  textDecoration: 'none',
                  marginBottom: 4,
                  background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  fontWeight: active ? 600 : 400,
                  transition: 'background 0.2s',
                }}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8, paddingLeft: 16 }}>
            {user?.username}
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderRadius: 8,
              background: 'rgba(255,70,70,0.15)',
              color: '#ff6b6b',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              fontSize: 14,
            }}
          >
            <LogOut size={20} />
            Cerrar sesion
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, marginLeft: 260, padding: 32 }}>
        <button
          className="menu-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            display: 'none',
            position: 'fixed',
            top: 16,
            left: 16,
            zIndex: 200,
            background: '#1a1a2e',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: 8,
            cursor: 'pointer',
          }}
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        {children}
      </main>
    </div>
  );
}
