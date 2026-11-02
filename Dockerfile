# syntax=docker/dockerfile:1

# Build the static app once, on the build machine's platform: the output is the same for every image
# platform, so multi-platform builds don't run npm under emulation
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The path the app is served under. Leave / unless a proxy serves it under a sub-path
# (e.g. --build-arg BASE_PATH=/ogcapibrowser/ behind a proxy that strips that prefix)
ARG BASE_PATH=/
RUN npm run build -- --base="${BASE_PATH}"

# Serve the static files with nginx, as a non-root user on port 8080
FROM nginxinc/nginx-unprivileged:1-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 8080
