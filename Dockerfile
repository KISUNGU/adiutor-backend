# Backend Dockerfile
FROM node:18-alpine

# Métadonnées
LABEL maintainer="AdiutrAI Team"
LABEL description="Backend AdiutrAI - Gestion courriers"

# Installation dépendances système (Tesseract OCR, LibreOffice, etc.)
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-fra \
    tesseract-ocr-data-eng \
    graphicsmagick \
    poppler-utils \
    && rm -rf /var/cache/apk/*

# Créer répertoire application
WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer dépendances Node.js
RUN npm install --omit=dev --legacy-peer-deps

# Copier le code source
COPY . .

# Créer répertoires nécessaires
RUN mkdir -p /app/data /app/uploads /app/logs \
    && chmod -R 755 /app/data /app/uploads /app/logs

# Exposer le port
EXPOSE 4000

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=4000
ENV DB_PATH=/app/data/databasepnda.db

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Démarrer l'application
CMD ["node", "server.js"]
