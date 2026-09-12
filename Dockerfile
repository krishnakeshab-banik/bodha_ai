# Render API image. Playwright's --with-deps needs root; Render's Node
# environment cannot `su`, so Native installs fail. Docker builds as root.
FROM node:22-bookworm

WORKDIR /app

RUN npx --yes playwright@1.63.0 install-deps chromium

COPY package.json ./
COPY backend/package.json backend/package-lock.json ./backend/

WORKDIR /app/backend
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install --include=dev

WORKDIR /app
COPY backend ./backend

WORKDIR /app/backend
RUN npm run build \
    && npx playwright install chromium \
    && npm prune --omit=dev

ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0
EXPOSE 4000
CMD ["npm", "start"]
