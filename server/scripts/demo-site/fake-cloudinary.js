// Remplace Cloudinary (compte local désactivé) : upload simulé, images servies localement
const http = require('http');
const { PassThrough } = require('stream');
const store = new Map();
http.createServer((req, res) => { const b = store.get(req.url.split('/').pop()); if (!b) { res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', 'image/png'); res.end(b); }).listen(4555);
const c = require(require.resolve('cloudinary', { paths: [process.cwd()] })).v2;
c.uploader.upload_stream = (opts, cb) => { const s = new PassThrough(); const chunks = []; s.on('data', d => chunks.push(d)); s.on('end', () => { const id = 'p' + Date.now() + Math.random().toString(36).slice(2, 6); store.set(id, Buffer.concat(chunks)); cb(null, { public_id: 'estelle/' + id, secure_url: 'http://localhost:4555/img/' + id, resource_type: 'image', bytes: Buffer.concat(chunks).length }); }); return s; };
c.uploader.destroy = async () => ({ result: 'ok' });
