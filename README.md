# Cul-Sec

Jeux de soirée à boire, multijoueur : chacun joue sur son téléphone.
Next.js 16 · React 19 · Tailwind 4 · Upstash Redis · PWA.

## Variables d'environnement

- `KV_REST_API_URL` / `KV_REST_API_TOKEN` : base Upstash Redis (injectées par Vercel).

## Développement local

Sans compte Upstash, on peut utiliser un `redis-server` local derrière un petit
proxy REST compatible Upstash :

```bash
redis-server --daemonize yes
node scripts/dev-redis-proxy.mjs
KV_REST_API_URL=http://localhost:8079 KV_REST_API_TOKEN=dev npm run dev
```

## Tests

```bash
npm run test:engine   # simule des parties complètes avec des bots, tous les mini-jeux
```
