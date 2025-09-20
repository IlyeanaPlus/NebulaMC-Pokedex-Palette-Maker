# NebulaMC Pokedex Palette Previewer (Vite + React)

A safe, visual tool to generate NebulaMC mod palettes. Supports:
- RGBA pickers for Primary, Secondary, Text
- **Mod Palette Rules** toggle (on by default)
  - Secondary derived from Primary: `+Lighten L%`, `Δ Saturation %`
  - Text meets a minimum contrast ratio vs Primary (auto black/white fallback)
- Eyedropper from uploaded image (click the canvas)
- Live preview tiles mimicking the Pokedex UI
- Export JSON / CSS variables

## Quick start

```bash
npm ci
npm run dev
```

Open the printed `http://localhost:5173` URL.

## Build

```bash
# (optional) for GitHub Pages set your repo base (e.g., /pokedex-palette-previewer/)
# PowerShell:  $env:VITE_BASE="/pokedex-palette-previewer/"
# bash/zsh:    export VITE_BASE="/pokedex-palette-previewer/"
npm run build
```

The static site will be in `dist/`.

## Deploy to GitHub Pages (GitHub Actions)

1. In your repository, go to **Settings → Pages → Build and deployment**.
2. Set **Source** to **GitHub Actions** (not branch).
3. Keep the provided workflow in `.github/workflows/deploy.yml` (already included here).
4. Push to `main`. The Action will build and publish `dist` to Pages.

### Alternate: Manual Pages (deploy from `dist/`)

If you prefer the classic `gh-pages` branch approach, let me know and I’ll add the script.

## Notes

- If you want Tailwind, we can wire it in a follow-up. This starter uses a small custom CSS file to keep the project light.
- Default “mod rules”: `Lighten L% = 22`, `Δ Saturation = -12`, `Contrast ≥ 4.5:1` (editable in UI).
