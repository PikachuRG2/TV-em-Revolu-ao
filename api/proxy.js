// Vercel Serverless Function — proxy HLS HTTPS
// Uso: /api/proxy?url=https%3A%2F%2Fexemplo.com%2Fplaylist.m3u8
// Também aceita origens HTTP. O navegador só conversa com este endpoint HTTPS.

const HOP_BY_HOP = new Set([
  "connection","keep-alive","proxy-authenticate","proxy-authorization",
  "te","trailer","transfer-encoding","upgrade","content-length",
  "access-control-allow-origin","access-control-allow-headers",
  "access-control-allow-methods"
]);

function absUrl(base, value) {
  try { return new URL(value, base).toString(); } catch { return null; }
}

function isPlaylist(ct, url) {
  return /\.m3u8(?:$|\?)/i.test(url) || /mpegurl/i.test(ct || "");
}

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");
      return res.status(204).end();
    }

    const raw = req.query?.url;
    if (!raw || typeof raw !== "string") {
      return res.status(400).json({error:"Parâmetro url ausente"});
    }

    let target;
    try { target = new URL(raw); }
    catch { return res.status(400).json({error:"URL inválida"}); }

    if (!/^https?:$/.test(target.protocol)) {
      return res.status(400).json({error:"Somente HTTP/HTTPS é permitido"});
    }

    const upstream = await fetch(target, {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      redirect: "follow",
      headers: {
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
        "Accept": "*/*",
        "Referer": target.origin + "/"
      }
    });

    if (!upstream.ok) {
      return res.status(upstream.status).send(`Origem retornou HTTP ${upstream.status}`);
    }

    const ct = upstream.headers.get("content-type") || "";
    const finalUrl = upstream.url || target.toString();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Cache-Control", "no-store");

    // Para playlists, reescreve URLs internas para passar pelo mesmo proxy.
    if (isPlaylist(ct, finalUrl)) {
      let body = await upstream.text();
      const lines = body.split(/\r?\n/);
      const rewritten = lines.map(line => {
        const t = line.trim();
        if (!t || t.startsWith("#")) {
          // Alguns atributos HLS podem conter URI="..."; reescrevemos também.
          return line.replace(/URI="([^"]+)"/g, (_, u) => {
            const a = absUrl(finalUrl, u);
            return a ? `URI="/api/proxy?url=${encodeURIComponent(a)}"` : `URI="${u}"`;
          });
        }
        const a = absUrl(finalUrl, t);
        return a ? `/api/proxy?url=${encodeURIComponent(a)}` : line;
      }).join("\n");

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
      return res.status(200).send(rewritten);
    }

    // Segmentos TS, MP4, AAC, chaves etc.
    for (const [k,v] of upstream.headers.entries()) {
      if (!HOP_BY_HOP.has(k.toLowerCase()) && k.toLowerCase() !== "content-type") {
        res.setHeader(k,v);
      }
    }
    res.setHeader("Content-Type", ct || "application/octet-stream");

    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(502).json({
      error:"Falha no proxy",
      message:e?.message || String(e)
    });
  }
}
