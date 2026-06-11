export function getBaseUrlFromRequest(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host") ?? process.env.VERCEL_URL;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto = forwardedProto ?? (host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");

  if (!host) {
    return "http://localhost:3000";
  }

  const cleanHost = host.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `${proto}://${cleanHost}`;
}
