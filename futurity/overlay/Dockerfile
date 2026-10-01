FROM ghcr.io/jina-ai/reader:oss@sha256:8cc9a5cf6dc9c240235fccc0026661de74b6e13c21b36e6a86b3281b9ef10f28

USER root
COPY patch-reader.mjs /tmp/patch-reader.mjs
COPY request-limiter.cjs /app/build/lib/reader-request-limiter.cjs
RUN node /tmp/patch-reader.mjs /app/build
USER jina
