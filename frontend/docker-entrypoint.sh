#!/bin/sh

# Inyectar variables de entorno en runtime para el frontend
cat > /usr/share/nginx/html/env-config.js <<EOF
window.__ENV__ = {
  VITE_API_URL: "${VITE_API_URL:-http://localhost:8000/api}"
};
EOF

echo "Frontend configurado con API URL: ${VITE_API_URL:-http://localhost:8000/api}"

exec "$@"
