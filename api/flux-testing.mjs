import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (file) => readFileSync(join(process.cwd(), "testing", file), "utf8");
const tracker = source("index.html")
  .replace('<link rel="stylesheet" href="styles.css">', () => '<style>' + source("styles.css") + '</style>')
  .replace('<script defer src="app.js"></script>', () => '<script>document.addEventListener("DOMContentLoaded",()=>{' + source("app.js") + '\n});</script>');
const sessionLength = 8 * 60 * 60;
const cookieName = "__Host-flux-testing";
const headers = {
  "Cache-Control": "private, no-store",
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'self' 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer"
};
const equal = (a, b) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const sign = (value, key) => createHmac("sha256", key).update(value).digest("base64url");
function sessionValid(request, key) {
  const value = (request.headers.get("cookie") ?? "").split(";").map(item => item.trim())
    .find(item => item.startsWith(cookieName + "="))?.slice(cookieName.length + 1);
  if (!value || !/^\d{10}\.[a-f0-9]{32}\.[\w-]{43}$/.test(value)) return false;
  const [expiry, nonce, signature] = value.split(".");
  return Number(expiry) > Math.floor(Date.now() / 1000) && equal(signature, sign(expiry + "." + nonce, key));
}
function redirect(value, maxAge) {
  return new Response(null, {
    status: 303,
    headers: {...headers, Location: maxAge ? "/testing?session=check" : "/testing", "Set-Cookie": cookieName + "=" + value + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + maxAge}
  });
}
function locked(message = "", status = 200) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Testing | Y’all Games</title>
<link rel="stylesheet" href="/style.css">
<style>
main{width:min(430px,calc(100% - 36px));margin:12vh auto;padding:26px;border:1px solid var(--edge);border-radius:14px;background:var(--surface)}
h1{font:700 39px var(--display);margin:8px 0 12px}label{display:block;margin:18px 0 5px}
input,button{font:inherit;border-radius:7px;padding:9px}input{width:100%;background:var(--bg);color:var(--cream);border:1px solid var(--edge)}
button{display:block;margin-top:13px;background:var(--gold);color:var(--bg);border:0;font-weight:800;cursor:pointer}
a{color:var(--gold)}.error{margin-top:8px;color:var(--gold)}
</style></head><body><main><a class="kicker" href="/">Y’ALL GAMES / TESTING</a><h1>Flux Frenzy</h1>
<p>Enter the testing passcode to open the QA tracker.</p>
<form action="/testing" method="post"><label for="passcode">Testing passcode</label>
<input id="passcode" name="passcode" type="password" inputmode="numeric" autocomplete="off" enterkeyhint="go" maxlength="24" required>
${message ? '<p class="error" role="alert">'+message+'</p>' : ""}<button type="submit">Unlock tracker</button></form></main></body></html>`, {status, headers});
}

const attempts = new Map();
const windowMs = 15 * 60 * 1000;
function attemptAllowed(request) {
  const ip = request.headers.get("x-vercel-forwarded-for") ?? "unknown";
  const now = Date.now();
  if (attempts.size >= 2000) {
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    if (attempts.size >= 2000 && !attempts.has(ip)) return false;
  }
  const prior = attempts.get(ip);
  const record = prior && prior.until > now ? prior : {count: 0, until: now + windowMs};
  if (record.count >= 10) return false;
  record.count += 1;
  attempts.set(ip, record);
  return true;
}

export default {
  async fetch(request) {
    const passcode = process.env.FLUX_TESTING_PASSCODE;
    const key = process.env.FLUX_TESTING_SESSION_KEY;
    if (!passcode || !key) return new Response("Tracker temporarily unavailable.", {status: 503, headers});
    if (request.method === "GET" || request.method === "HEAD") {
      if (request.method === "HEAD") return new Response(null, {headers});
      if (sessionValid(request, key)) return new Response(tracker, {headers});
      const check = new URL(request.url).searchParams.get("session") === "check";
      return check ? locked("Your browser did not save the testing session. Allow cookies for yallgames.com and try again.") : locked();
    }
    if (request.method !== "POST") return new Response(null, {status: 405, headers: {...headers, Allow: "GET, HEAD, POST"}});
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return locked("Open Testing from the Y’all Games homepage and try again.", 403);
    if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
      return new Response(null, {status: 415, headers});
    }
    const length = Number(request.headers.get("content-length"));
    if (!length || length > 512) return locked("The passcode was not received. Reopen Testing and try again.", 400);
    const form = new URLSearchParams(await request.text());
    if (form.get("action") === "lock") return redirect("", 0);
    if (!attemptAllowed(request)) return locked("Too many attempts. Try again in 15 minutes.", 429);
    const value = (form.get("passcode") ?? "").trim();
    if (!/^\d{6}$/.test(value) || !equal(value, passcode)) return locked("Incorrect passcode.", 401);
    const expiry = Math.floor(Date.now() / 1000) + sessionLength;
    const token = expiry + "." + randomBytes(16).toString("hex");
    return redirect(token + "." + sign(token, key), sessionLength);
  }
};
