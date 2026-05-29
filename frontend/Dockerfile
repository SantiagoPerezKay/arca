FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

RUN npm run build

# --- Produccion con nginx ---
FROM nginx:alpine

# Copiar build
COPY --from=build /app/dist /usr/share/nginx/html

# Configuracion nginx para SPA (react-router)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Script de inicio que inyecta variables de entorno en runtime
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
