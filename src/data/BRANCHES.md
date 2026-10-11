# Local branch dataset (`branches.json`)

`branches.json` is merged with the branches returned by `/api/stores` (partner APIs)
and powers the "nearest branch" page without any external service.

**Only add a branch if you can verify it.** Every entry needs a public `source`
(official store locator, partner API export, OpenStreetMap node/way URL) and the
coordinates must come from that source. Never estimate coordinates.

```json
{
  "id": "korzinka-chilonzor-e-1a",
  "chain": "Korzinka",
  "name": "Chilonzor",
  "address": "Chilonzor tumani, Bunyodkor ko'chasi",
  "lat": 41.0000,
  "lng": 69.0000,
  "hours": "09:00-23:00",
  "source": "https://example.org/where-the-data-came-from",
  "verifiedAt": "2026-10-09"
}
```

`chain` must match the store name used in product offers (e.g. `Korzinka`, `Havas`, `Makro`).
`hours` is optional. Entries without valid `lat`/`lng` are listed but never ranked.

Check the file with `npm run check:branches`.

## Refresh public branch data

In the project root, run these commands when you want to refresh HAVAS branches or fill missing coordinates:

```bash
npm run import:havas
npm run geocode:branches
# Optional: cautiously try address matching for the remaining entries (takes longer)
npm run geocode:branches -- --nominatim
npm run check:branches
```

The importer reads the official HAVAS directory, preserves branch records for other supermarket chains, and saves official map URLs. Coordinate lookup is best-effort: if a map provider or geocoder cannot verify the point, the coordinates remain empty instead of being guessed. The website still gives each address a map-search link. Korzinka and Makro entries must be supplied by their official directory/API or the existing branch data; an empty accordion includes a link to that chain’s official directory.
