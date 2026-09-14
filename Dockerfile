# Self-contained build: a clean checkout plus `docker build .` produces a
# runnable image. The previous version did `COPY dist`, which meant the image
# could only be built after a separate `npm run build` on the host -- it worked
# in the one pipeline that happened to do that, and failed everywhere else.

# --- Stage 1: build the bundle ---------------------------------------------
FROM node:26-alpine AS build
WORKDIR /build

# Vite inlines VITE_* values into the bundle AT BUILD TIME. The API host is
# therefore chosen here, not at container start: an image built for one API
# cannot be repointed with `docker run -e`.
ARG VITE_API_BASE_URL
ARG VITE_MONITORING_BASE_URL
ARG VITE_ZENDESK_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_MONITORING_BASE_URL=$VITE_MONITORING_BASE_URL \
    VITE_ZENDESK_KEY=$VITE_ZENDESK_KEY

# Dependencies first, so a source-only change reuses the install layer.
# .npmrc comes too: it sets legacy-peer-deps=true, which `npm ci` needs for the
# eslint 10 / eslint-plugin-react-hooks peer range. Without it the install
# resolves peers strictly and dies with ERESOLVE -- in the image only, since
# CI's own `npm ci` runs in a checkout that has the file.
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

# --- Stage 2: serve it ------------------------------------------------------
FROM nginx:alpine AS production

RUN apk add --no-cache curl

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /build/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
