FROM node:22-alpine AS builder

WORKDIR /app

# Accept app name for white-labeling (baked into frontend at build time)
ARG VITE_APP_NAME=Seaport
ENV VITE_APP_NAME=$VITE_APP_NAME

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy source
COPY . .

# Build frontend + server
RUN npm run build

# ---
FROM node:22-alpine AS runner

WORKDIR /app

# Run as non-root user
RUN addgroup -S seaport && adduser -S seaport -G seaport

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/server/db/schema ./server/db/schema
COPY --from=builder /app/start.sh ./

# Create uploads directory owned by app user
RUN mkdir -p /app/uploads && chown -R seaport:seaport /app

USER seaport

ENV NODE_ENV=production

CMD ["sh", "./start.sh"]
