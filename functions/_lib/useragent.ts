import type { DeviceType } from '../../shared/analytics.ts';

export interface ParsedUserAgent {
  deviceType: DeviceType;
  /** 'Chrome', 'Safari', ... or the crawler's name for bots. */
  browser: string;
  /** 'Windows', 'macOS', 'iOS', 'Android', 'Linux', 'ChromeOS' or 'Other'. */
  os: string;
  isBot: boolean;
}

/** Longer User-Agents are cut off before matching (also bounds regex work on hostile input). */
export const MAX_USER_AGENT_LENGTH = 512;

const OTHER = 'Other';
const MAX_BOT_NAME_LENGTH = 40;

type NamedPattern = readonly [pattern: RegExp, name: string];

/**
 * Crawlers, link-preview fetchers, headless browsers and scripting clients. First match wins and
 * supplies the name shown in the browser breakdown. Order matters: specific names before generic ones.
 */
const BOT_PATTERNS: readonly NamedPattern[] = [
  [/googlebot|google-inspectiontool|adsbot-google|mediapartners-google|apis-google|feedfetcher-google|google-read-aloud/i, 'Googlebot'],
  [/bingbot|bingpreview|adidxbot/i, 'Bingbot'],
  [/slackbot|slack-imgproxy/i, 'Slackbot'],
  [/discordbot/i, 'Discordbot'],
  [/twitterbot/i, 'Twitterbot'],
  [/facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher/i, 'Facebook crawler'],
  [/telegrambot/i, 'TelegramBot'],
  [/linkedinbot/i, 'LinkedInBot'],
  [/^whatsapp\//i, 'WhatsApp preview'],
  [/applebot/i, 'Applebot'],
  [/duckduckbot|duckassistbot/i, 'DuckDuckBot'],
  [/yandexbot|yandeximages|yandexmetrika/i, 'YandexBot'],
  [/baiduspider/i, 'Baiduspider'],
  [/gptbot|chatgpt-user|oai-searchbot|claudebot|claude-user|perplexitybot|ccbot|bytespider|amazonbot/i, 'AI crawler'],
  [/semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|screaming frog/i, 'SEO crawler'],
  [/uptimerobot|pingdom|statuscake|site24x7|nagios|check_http|healthcheck|monitor/i, 'Uptime monitor'],
  [/headlesschrome|phantomjs|puppeteer|playwright|selenium|webdriver|lighthouse|pagespeed/i, 'Headless browser'],
  [/embedly|iframely|vkshare|skypeuripreview|preview|unfurl/i, 'Link preview'],
  [/\bcurl\//i, 'curl'],
  [/\bwget\b/i, 'Wget'],
  [/python-requests|python-urllib|python-httpx|aiohttp|\bpython\//i, 'Python'],
  [/go-http-client/i, 'Go-http-client'],
  [/node-fetch|undici|\baxios\b|^got\b|node\.js|\bnode\//i, 'Node.js'],
  [/^java\/|apache-httpclient|libwww-perl|\bhttpie\b|postmanruntime|insomnia|\bfaraday\b/i, 'HTTP client'],
];

/** Fallback for anything calling itself a bot/crawler/spider; the token itself becomes the name. */
const GENERIC_BOT = /([a-z0-9._-]*(?:bot|crawler|spider|scraper|fetcher)[a-z0-9._-]*)/i;

/** Apps with their own in-app browser; their UA also carries Chrome/Safari tokens, so check them first. */
const IN_APP_PATTERNS: readonly NamedPattern[] = [
  [/Instagram/, 'Instagram'],
  [/FBAN|FBAV|FB_IAB/, 'Facebook App'],
  [/musical_ly|BytedanceWebview|TikTok/i, 'TikTok'],
  [/Snapchat/, 'Snapchat'],
  [/LinkedInApp/, 'LinkedIn'],
];

function matchBot(ua: string): string | null {
  for (const [pattern, name] of BOT_PATTERNS) {
    if (pattern.test(ua)) return name;
  }
  const generic = GENERIC_BOT.exec(ua);
  return generic ? generic[1].slice(0, MAX_BOT_NAME_LENGTH) : null;
}

function detectBrowser(ua: string, os: string): string {
  for (const [pattern, name] of IN_APP_PATTERNS) {
    if (pattern.test(ua)) return name;
  }
  // Order matters: each of these also carries the tokens of the engines below it.
  if (/\b(?:Edg|EdgA|EdgiOS|Edge)\//.test(ua)) return 'Edge'; // before Chrome
  if (/\bOPR\/|\bOPiOS\/|\bOPT\/|Opera/.test(ua)) return 'Opera'; // before Chrome
  if (/SamsungBrowser\//.test(ua)) return 'Samsung Internet'; // before Chrome
  if (/Firefox\/|FxiOS\//.test(ua)) return 'Firefox';
  if (/DuckDuckGo\/|\bDdg\//.test(ua)) return 'DuckDuckGo';
  if (/MSIE |Trident\//.test(ua)) return 'Internet Explorer';
  if (/Chrome\/|Chromium\/|CriOS\//.test(ua)) return 'Chrome'; // before Safari
  if (/Safari\//.test(ua)) return os === 'Android' ? 'Android Browser' : 'Safari';
  return OTHER;
}

function detectOs(ua: string): string {
  if (/Windows/.test(ua)) return 'Windows';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS'; // before macOS: iOS UAs say "like Mac OS X"
  if (/Android/.test(ua)) return 'Android'; // before Linux: Android UAs say "Linux"
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Linux|X11|Ubuntu|Fedora|FreeBSD|OpenBSD|NetBSD/.test(ua)) return 'Linux';
  return OTHER;
}

/**
 * Phone vs tablet vs desktop. Known blind spot: iPadOS 13+ Safari sends a macOS desktop UA, so
 * those iPads count as desktop (telling them apart needs client-side touch detection).
 */
function detectDeviceType(ua: string, os: string, browser: string): DeviceType {
  if (/iPad|Tablet|PlayBook/i.test(ua)) return 'tablet';
  // Android phones say "Mobile"; Android tablets don't.
  if (os === 'Android') return /Mobile/.test(ua) ? 'mobile' : 'tablet';
  if (/iPhone|iPod|Mobile|Windows Phone|IEMobile|BlackBerry|Opera Mini/i.test(ua)) return 'mobile';
  if (os !== OTHER) return 'desktop';
  return browser !== OTHER ? 'desktop' : 'unknown';
}

/** Small dependency-free User-Agent classifier. Never throws; an empty header yields 'unknown'. */
export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  const ua = (userAgent ?? '').trim().slice(0, MAX_USER_AGENT_LENGTH);
  if (ua === '') {
    return { deviceType: 'unknown', browser: OTHER, os: OTHER, isBot: false };
  }

  const os = detectOs(ua);
  const botName = matchBot(ua);
  if (botName !== null) {
    return { deviceType: 'bot', browser: botName, os, isBot: true };
  }

  const browser = detectBrowser(ua, os);
  return { deviceType: detectDeviceType(ua, os, browser), browser, os, isBot: false };
}
