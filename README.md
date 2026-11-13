# FORM — Personal Fitness Tracker

A dark, mobile-friendly, local-first workout and wellness journal created from the starter project. Works as a PWA when published over HTTPS.

## Main features

- Pull / Push / Legs workout logging, custom exercises, multiple sets, reps, weight in pounds, notes, recent history, edit/delete.
- Exercise progress charts: compare multiple exercises, use max weight or total logged training volume, filter by routine and date range.
- Morning weight history, daily energy / recovery / stress / water / notes.
- Nutrition logging: calories, protein, carbs, fat, sodium, fiber, servings, food/label photos, meal reuse/edit.
- Camera barcode scanning or manual barcode-number lookup via [Open Food Facts](https://world.openfoodfacts.org/). Check retrieved values against your own package. Internet required for lookup.
- Sleep duration, bedtime, wake time, quality, optional notes.
- Activity logging (cycling, walking, school activity, sports, other), minutes and optional estimated calories.
- Recent daily context showing sleep, self-rated energy, logged protein, workouts and activity.
- Saves records in IndexedDB and typed drafts in localStorage + IndexedDB, so a normal browser restart does not erase them.
- Automatic local snapshots roughly every 24 hours when recording data, manual snapshots, full or date-filtered JSON exports, CSV exports, and merge import.
- Dark mobile layout, GitHub Pages deployment, offline-ready Progressive Web App with icon and update prompt.

## Important limitations

- Data is stored **per browser and device**, NOT automatically synchronized across devices. To move data between your computer and phone, export a JSON backup and import it on the other device.
- Browser private/incognito mode, clearing site data, using a new domain, losing the device, or storage cleanup can erase local data. Export JSON to Files/Downloads regularly. Local snapshots reside in the same browser and are **not** independent backups.
- The barcode database is community maintained and may contain missing or outdated nutrition values. You must review all values. A photo attachment is **not** automatically read using AI/OCR.
- Camera scanning requires browser permission and HTTPS (GitHub Pages provides HTTPS). If camera scanning is unsupported, type the digits under the barcode.
- Calories burned are estimates entered by you; no Fitbit/Apple Health connection, server cloud sync, or AI image analysis is implemented.
- An unfinished food photo isn't persisted as a draft until you press Save meal; text/numeric entries are draft-saved.
- The app is a tracking journal, not a medical or nutrition prescription.

## On Windows: first local test

1. Install current Node.js LTS from https://nodejs.org/ if needed. Close and reopen your terminal afterward.
2. Extract this ZIP to a folder, e.g. `Documents/FORM-Fitness-Tracker`.
3. Open the folder in VS Code (optional), or open PowerShell / Terminal in that folder. Confirm `package.json`, `src`, `public`, and `.github` are all at the top level.
4. Run `npm install` (internet connection required).
5. Run `npm test` (built-in source tests).
6. Run `npm run build` (production compilation). This creates `dist/`.
7. Run `npm run dev`; Vite prints a Local URL such as `http://localhost:5173/`.
8. Open that URL in Chrome or Edge. Log a sample workout and meal. Refresh and close/reopen browser. Entries should remain.
9. Test the same on another tab, test the Export JSON download, then import it. Confirm no errors in the browser DevTools console (F12).
10. For production preview locally: `npm run preview` and open its printed URL.

**You only need the console for local development.** After publishing on GitHub Pages, the installed phone app opens directly and the console can stay closed.

## GitHub Desktop: new repository (recommended)

1. Install GitHub Desktop from https://desktop.github.com/ and sign into your account.
2. In GitHub Desktop use **File → New repository** and name it `form-fitness-tracker`. Choose a local folder and Create repository.
3. In File Explorer, open the new repository folder (GitHub Desktop → Repository → Show in Explorer).
4. Open the extracted ZIP folder and copy **all its contents** (not the ZIP itself) into the repository folder. It should show `package.json`, `index.html`, `vite.config.js`, `src/`, `public/`, and `.github/workflows/deploy.yml` at repository root.
5. GitHub Desktop will show the added files. Enter a commit summary, e.g. `Add FORM fitness tracker`, and click **Commit to main**.
6. Click **Publish repository**. Choose Public for easiest GitHub Pages availability on a free GitHub account. Private repository Pages eligibility varies by plan.
7. Open your GitHub repository website, go to **Settings → Pages → Build and deployment → Source → GitHub Actions**.
8. Go to the **Actions** tab. The included `Deploy FORM Fitness Tracker` workflow installs packages, runs tests, builds with the correct repository path automatically, and publishes `dist/` to Pages.
9. When the workflow shows a green check and deployment is complete, open the Pages link shown under **Settings → Pages**. It is usually `https://USERNAME.github.io/form-fitness-tracker/`.

For an **existing repository**, use GitHub Desktop → File → Clone repository, open its local folder, copy the contents of the ZIP into that folder, then commit and push. Do not create a second copy of `src/` inside another nested project folder. Do not upload `node_modules/`, `dist/`, photos or private JSON exports. The `.gitignore` excludes dependencies and build output.

The deployment workflow builds the app from sources. You do not manually upload the `dist/` folder.

## Install on iPhone

1. After GitHub Pages finishes deployment, open the public Pages URL in **Safari**.
2. Tap the Share icon (box with arrow), then **Add to Home Screen**. On newer versions, it may be under the Share menu's available actions.
3. Name it **FORM** and add it.
4. Open the FORM icon like a regular app. It will use the public Pages site and its offline-ready cached files; no Codespace or PC console has to run.
5. Log one test record, close the app, re-open, and confirm the record remains.
6. Store regular JSON backups in the iPhone Files app. Each device has separate local records.

## Switching from the old tracker without losing data

On the **old app and old URL**, tap Export backup (down-arrow icon). Keep the JSON file. After opening the **new app at its final URL**, use **Data → Import** and select that file. The new app supports backups named `Form Fitness Tracker` from the original starter, as well as new `FORM Fitness Tracker` backups.

A Codespaces preview URL and a GitHub Pages URL are different browser storage origins even on the same computer. Records made on the Codespaces preview do not automatically appear at the GitHub Pages URL. Export/import bridges them.

## Cloud sync

This version intentionally avoids account setup, API keys, and backend costs. If you later need automatic computer↔phone synchronization, an authenticated Supabase or similar service can be added; never commit service-role API keys to a public repository.

## Build verification

Basic nutrition conversion unit tests run using Node (`npm test`). A complete compile is checked using `npm run build`. GitHub Actions runs both tests and the production build on every push to `main`.

The project files were syntax-checked; the current assembly environment cannot fetch npm packages, so the production build was not executed there. The GitHub Actions build is the authoritative end-to-end packaging check.
