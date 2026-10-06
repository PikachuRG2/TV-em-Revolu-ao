RG2 TV — Vercel + Proxy HLS

Arquivos:
- index.html
- canais.m3u
- api/proxy.js
- vercel.json

Deploy:
1. Extraia o ZIP.
2. Envie a pasta para um repositório GitHub ou importe no Vercel.
3. Faça o deploy.
4. Abra o domínio HTTPS do Vercel.

O player carrega /canais.m3u e envia cada URL de stream para /api/proxy?url=...
O proxy reescreve playlists HLS e também encaminha segmentos/arquivos referenciados.

Importante:
- O proxy não garante que todo canal funcione: o servidor de origem pode exigir token, Referer,
  User-Agent, autenticação, limitar IP, bloquear datacenter ou simplesmente estar offline.
- Este projeto não transforma uma origem indisponível em disponível; ele apenas evita Mixed Content
  no navegador quando a origem HTTP pode ser acessada pelo servidor.
