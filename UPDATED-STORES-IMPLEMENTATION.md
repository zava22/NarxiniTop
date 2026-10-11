# NarxTop store arrows and branch-location update

## UI changes

- Store chain order is fixed to **Havas → Korzinka → Makro** in the nearest-branch carousel.
- The previous arrow is hidden for Havas; it appears from Korzinka onwards. The next arrow disappears on Makro. Invisible end slots keep the carousel width and alignment steady.
- The page still includes the location picker, local distance calculations, nearest branch list, district fallback, and all-branch directory.
- The directory has collapsible Havas, Korzinka, Makro sections, global search, open-all/close-all, branch counts, and branch directions links.
- Every address can open a map: a branch-specific official map URL is preferred, then coordinates, then Google Maps address search. Missing coordinates are not invented.

## Refresh branch records

Run these once from the project folder on a computer with internet access:

```bash
npm install
npm run import:havas
npm run geocode:branches
# Optional and slower; asks OpenStreetMap to match remaining addresses cautiously:
npm run geocode:branches -- --nominatim
npm run check:branches
```

The uploaded source snapshot contained 11 saved branch rows before this update. The Havas importer downloads the currently published Havas directory when run; its full output is not pre-embedded in this archive because the build environment could not reach the live site. The imported Havas data is saved to `src/data/branches.json` and is reused on later runs. The current data snapshot has five Makro rows and no Korzinka rows. This update makes both chains visible and adds links to their official directories, but it does not claim to contain every Korzinka or Makro branch yet. Add their official/API records to `src/data/branches.json` or the `/api/stores` source to populate those groups.

## Validation

- `npm run check:branches` passed for the included data.
- `node scripts/check-i18n.mjs` passed; both Uzbek and Russian directory keys are present.
- JavaScript/JSX syntax was checked for 121 project files.
- A full Vite build was not run here because the dependency installation could not complete in this environment. Run `npm install` and `npm run build` on your PC to verify the production build.
