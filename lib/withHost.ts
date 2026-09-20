export const loopback = /^(localhost|127\.0\.0\.1)$/;

/** Swaps a loopback host for `host`, so a URL written for this machine also works from another device. */
export function withHost(url: string, host: string | undefined) {
  const parsed = new URL(url);
  if (!host || !loopback.test(parsed.hostname)) return url;
  parsed.hostname = host;
  return parsed.toString().replace(/\/$/, '');
}
