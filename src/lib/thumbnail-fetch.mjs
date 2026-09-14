import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns';
import { BlockList, isIP } from 'node:net';
import { publicUrl } from './thumbnail-metadata.mjs';

const blocked = new BlockList();
for (const [ip, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
  ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
  ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]]) blocked.addSubnet(ip, prefix, 'ipv4');
const global6 = new BlockList();
global6.addSubnet('2000::', 3, 'ipv6');
blocked.addSubnet('2001:db8::', 32, 'ipv6');
blocked.addSubnet('2002::', 16, 'ipv6');

export function isPublicAddress(address) {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, 'ipv4')
    : family === 6 && global6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

// Validate the actual DNS answers handed to the socket, including each redirect.
// Never forward credentials, cookies or caller-provided headers to publisher sites.
function publicLookup(hostname, options, callback) {
  lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address))) {
      return callback(new Error('Non-public DNS answer'));
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
}

export async function fetchThumbnailResource(input, {
  method = 'GET', body, signal, timeoutMs = 8000, maxBytes = 1_250_000,
  userAgent = 'DeafNaviWeb-Thumbnails/1.0 (+https://deafnavi.com/)',
} = {}) {
  let url = publicUrl(input);
  if (!url) throw new Error('Invalid public URL');
  // POST is only used for Google's public article-navigation lookup.
  if (method === 'POST' && url !== 'https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je') {
    throw new Error('Unsupported metadata POST');
  }
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
  for (let redirects = 0; redirects <= 4; redirects++) {
    const result = await new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const request = (parsed.protocol === 'https:' ? https : http).request(parsed, {
        method, lookup: publicLookup, agent: false, signal: requestSignal,
        headers: {
          'User-Agent': userAgent,
          Accept: method === 'HEAD' ? 'image/avif,image/webp,image/png,image/jpeg' : 'text/html,application/xhtml+xml,application/json;q=0.8',
          ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' } : {}),
        },
      }, (response) => {
        response.on('error', reject);
        const status = response.statusCode;
        if (status >= 300 && status < 400) {
          response.destroy();
          resolve({ status, headers: response.headers, text: '', url });
          return;
        }
        if (method === 'HEAD' || status !== 200) {
          response.destroy();
          resolve({ status, headers: response.headers, text: '', url });
          return;
        }
        const type = String(response.headers['content-type'] || '');
        if (!/(?:text\/|application\/(?:json|xml|xhtml\+xml|rss\+xml|atom\+xml))/.test(type)) {
          response.destroy(new Error('Unsupported metadata content type'));
          return;
        }
        let size = 0;
        const chunks = [];
        response.on('data', (chunk) => {
          size += chunk.length;
          if (size > maxBytes) response.destroy(new Error('Metadata exceeds byte limit'));
          else chunks.push(chunk);
        });
        response.on('end', () => {
          const encoding = type.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1] || 'utf-8';
          let text;
          try { text = new TextDecoder(encoding).decode(Buffer.concat(chunks)); }
          catch { text = Buffer.concat(chunks).toString('utf8'); }
          resolve({ status, headers: response.headers, text, url });
        });
      });
      request.on('error', reject);
      request.end(body);
    });
    if (result.status < 300 || result.status >= 400) return result;
    if (method === 'POST') throw new Error('Navigation lookup redirected');
    url = result.headers.location && publicUrl(result.headers.location, url);
    if (!url) throw new Error('Invalid metadata redirect');
  }
  throw new Error('Too many metadata redirects');
}
