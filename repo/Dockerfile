FROM node:20-bookworm-slim

WORKDIR /app

# OpenSSL + CA for Prisma engines download; wget for compose healthcheck
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first (cache layer)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript
RUN npm run build

EXPOSE 3000

ENTRYPOINT ["sh", "scripts/entrypoint.sh"]
