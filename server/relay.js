// Relais de transition Railway → Infomaniak (lancé par server/railway.toml pendant la migration).
// Les apps installées avant la version 1.0.13 appellent encore l'adresse Railway : on fait suivre chaque
// requête (et le temps réel socket.io) vers https://api.evly.ch, le serveur en Suisse. Une seule base, un seul
// serveur, aucune tâche planifiée ici. À supprimer avec le service Railway quand tout le monde a mis à jour.
const http = require('http');
const https = require('https');
const tls = require('tls');

const TARGET = process.env.RELAY_TARGET || 'api.evly.ch';

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true,"relay":true}');
    return;
  }
  const upstream = https.request(
    { host: TARGET, port: 443, servername: TARGET, method: req.method, path: req.url, headers: { ...req.headers, host: TARGET } },
    up => { res.writeHead(up.statusCode || 502, up.headers); up.pipe(res); },
  );
  upstream.on('error', e => {
    console.error('[relais]', req.method, req.url, e.message);
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
    res.end('{"error":"Serveur momentanément indisponible"}');
  });
  req.pipe(upstream);
});

// WebSocket (socket.io) : on rejoue la demande de mise à niveau vers le serveur suisse, puis on relie les flux
server.on('upgrade', (req, socket, head) => {
  const upstream = tls.connect(443, TARGET, { servername: TARGET }, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (const [k, v] of Object.entries({ ...req.headers, host: TARGET })) for (const one of [].concat(v)) lines.push(`${k}: ${one}`);
    upstream.write(lines.join('\r\n') + '\r\n\r\n');
    if (head && head.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

server.listen(Number(process.env.PORT || 3001), '0.0.0.0', () => console.log(`Relais vers ${TARGET} sur le port ${process.env.PORT || 3001}`));
