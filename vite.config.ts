import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { ALLOWED_ORIGINS, LOCAL_ONLY } from './network-policy.ts';

// Strict CSP (docs/SEGURANCA.md, ADR-002). Injected only in production builds: the dev server
// needs a websocket for hot reload, which a closed `connect-src` would block. It is a meta tag
// rather than a header so it never applies to a service worker, if the app gets one.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  LOCAL_ONLY ? "connect-src 'none'" : `connect-src ${ALLOWED_ORIGINS.join(' ')}`,
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
          injectTo: 'head-prepend',
        },
      ],
    },
  };
}

// Lets tooling assign a port through the PORT environment variable.
const port = process.env.PORT ? Number(process.env.PORT) : undefined;

export default defineConfig({
  server: { port },
  preview: { port },
  // Relative base so the build works from any path (Cloudflare Pages, a subfolder, preview).
  base: './',
  plugins: [react(), contentSecurityPolicy()],
  build: {
    // Keep everything as files under 'self'; never inline assets as scripts.
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'node',
  },
});
