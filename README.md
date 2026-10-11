# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


## Redesign notes

- Removed: home sections (best offers, biggest price drops, recommendations, personal insights, store comparison), the whole Smart Savat page/logic, the account analytics tab, routing/map code. The normal cart is unchanged.
- Nearest branch (`/stores`): local Haversine over `/api/stores` + `src/data/branches.json` (see `src/data/BRANCHES.md`, validate with `npm run check:branches`). No external API is called.
- Card appearance (density, columns, secondary info) is stored in `localStorage` (`narxtop_card_prefs`); theme in `narxtop_theme`.
- `leaflet` is no longer used: run `npm uninstall leaflet` to drop it from package.json/lock.
