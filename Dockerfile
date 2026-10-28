# Multi-stage Dockerfile for RetroBat & Game Library Manager Pro
# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build:web

# Production Web Server Stage
FROM nginx:alpine

# Copy built static assets to nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx configuration for SPA routing & PWA caching
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ { \
        expires 1y; \
        add_header Cache-Control "public, no-transform"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
