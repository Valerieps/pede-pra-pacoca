import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The app identity files (manifest, icons, theme-color) follow the palette in tokens.css. */

const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const manifest = JSON.parse(read('public/manifest.webmanifest')) as {
  theme_color: string;
  background_color: string;
  icons: { src: string; type: string; purpose: string }[];
};
const tokens = read('src/ui/theme/tokens.css');
const [light, dark] = tokens.split(":root[data-theme='dark']");

function token(css: string, name: string) {
  return new RegExp(`--${name}: *(#[0-9a-f]{6})`).exec(css)?.[1];
}

describe('app identity', () => {
  // The system bars blend with the white header and tab bar instead of framing them in wine
  it('uses the background of the light theme for the system bars in the manifest', () => {
    expect(manifest.theme_color).toBe(token(light, 'color-bg'));
    expect(manifest.background_color).toBe(token(light, 'color-bg'));
  });

  it('has a theme-color for each theme', () => {
    const html = read('index.html');
    expect(html).toContain(`content="${token(light, 'color-bg')}" media="(prefers-color-scheme: light)"`);
    expect(html).toContain(`content="${token(dark, 'color-bg')}" media="(prefers-color-scheme: dark)"`);
  });

  it('has an SVG icon for any purpose and a maskable one, both in public/', () => {
    for (const purpose of ['any', 'maskable']) {
      const icon = manifest.icons.find((i) => i.purpose === purpose && i.type === 'image/svg+xml');
      expect(icon).toBeDefined();
      expect(read(`public/${icon!.src}`)).toContain(token(light, 'color-brand'));
    }
  });

  // Android builds the installed app's icon only from PNGs
  it('has PNG icons for any purpose and a maskable one, all in public/', () => {
    for (const purpose of ['any', 'maskable']) {
      const pngs = manifest.icons.filter((i) => i.purpose === purpose && i.type === 'image/png');
      expect(pngs.length).toBeGreaterThan(0);
      for (const icon of pngs) expect(existsSync(join(ROOT, 'public', icon.src))).toBe(true);
    }
  });
});
