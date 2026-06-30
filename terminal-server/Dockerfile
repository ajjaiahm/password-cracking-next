# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Runner (Production)
FROM node:22-alpine AS runner
WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 termserver

# Copy built output
COPY --from=builder --chown=termserver:nodejs /app/dist ./dist
COPY --from=deps --chown=termserver:nodejs /app/node_modules ./node_modules
# Copy Dockerfile.lab so the terminal server can build the lab image
COPY --chown=termserver:nodejs Dockerfile.lab ./Dockerfile.lab

USER termserver

EXPOSE 4000
CMD ["node", "dist/index.js"]
