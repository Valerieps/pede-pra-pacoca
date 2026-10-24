# The Paçocast (ADR-016): Node runs the TypeScript file as is; no dependencies to install.
FROM node:24.19.0-alpine
WORKDIR /app
COPY pacocast.ts ./
USER node
CMD ["node", "pacocast.ts"]
