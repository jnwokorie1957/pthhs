FROM node:22-bookworm-slim
RUN printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d && chmod +x /usr/sbin/policy-rc.d \
 && apt-get update && apt-get install -y --no-install-recommends clamav clamav-freshclam ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY lib ./lib
COPY assets ./assets
COPY scripts/scan-workforce-pdf.mjs ./scripts/scan-workforce-pdf.mjs
COPY scanner/run.mjs ./scanner/run.mjs
ENV WORKFORCE_CLAMSCAN=/usr/bin/clamscan
CMD ["node", "scanner/run.mjs"]
