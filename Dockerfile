# Stage 1: Frontend bauen
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Alles in einem Container
FROM python:3.11-slim

# Nginx + Supervisor + native Deps für caldav installieren
RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    libxml2-dev \
    libxslt-dev \
    && rm -rf /var/lib/apt/lists/*

# Python-Abhängigkeiten (nur noch main-api – enthält jetzt alles)
COPY main-api/requirements.txt /tmp/req-main.txt
RUN pip install --no-cache-dir -r /tmp/req-main.txt

# Service-Code kopieren (nur noch main-api)
COPY main-api/ /app/main-api/

# Frontend-Build in Nginx-Root kopieren
COPY --from=frontend-build /build/dist /usr/share/nginx/html

# Nginx-Konfiguration
COPY nginx-single.conf /etc/nginx/sites-enabled/default

# Supervisord-Konfiguration
COPY supervisord.conf /etc/supervisor/conf.d/axion.conf

# Startskript
COPY docker-start.sh /start.sh
RUN chmod +x /start.sh

# Datenpfade anlegen
RUN mkdir -p /app/main-api/instance /app/main-api/instance/wiki-uploads

EXPOSE 80

CMD ["/start.sh"]
