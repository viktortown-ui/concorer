# gamno

## Local development

```bash
cd app
npm install
npm run dev
```

## Production build

```bash
cd app
npm run build
```

## GitHub Pages deployment

Deployment is configured with GitHub Actions in `.github/workflows/deploy.yml`.

To enable Pages in the repository:
1. Open **Settings → Pages**.
2. In **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main` (or trigger workflow manually) to publish `app/dist`.
