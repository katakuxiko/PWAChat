# Multi-stage Dockerfile for `front` (build with Node, serve with nginx)
FROM node:20-alpine AS builder

WORKDIR /app

# Allow passing Vite env at build time: --build-arg VITE_BASE_URL=https://back.avxm.live
ARG VITE_BASE_URL
ENV VITE_BASE_URL=${VITE_BASE_URL}

RUN apk add --no-cache git

COPY package*.json ./
RUN npm ci --prefer-offline --no-audit --progress=false

# Copy source and build
COPY . .
RUN npm run build

FROM nginx:stable-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
