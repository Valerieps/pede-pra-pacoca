import { describe, expect, it } from 'vitest';
import { installGuideFor } from './install-guide';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36';

describe('install guide', () => {
  it('explains the iPhone steps in the browser', () => {
    expect(installGuideFor({ standalone: false, userAgent: IPHONE, dismissed: false })).toBe('ios');
  });

  it('tells Android and other browsers apart', () => {
    expect(installGuideFor({ standalone: false, userAgent: ANDROID, dismissed: false })).toBe('android');
    expect(installGuideFor({ standalone: false, userAgent: DESKTOP, dismissed: false })).toBe('other');
  });

  it('says nothing once installed or dismissed', () => {
    expect(installGuideFor({ standalone: true, userAgent: IPHONE, dismissed: false })).toBeNull();
    expect(installGuideFor({ standalone: false, userAgent: ANDROID, dismissed: true })).toBeNull();
  });
});
