# Kindergarten Sign-Out Kiosk

Local-first Next.js + Supabase kiosk for managing kindergarten student sign-outs, daily status, and archival history.

## Features
- Class & student roster
- Real-time sign-out tracking (Present / Signed Out)
- Daily reset with JSON archive history
- Password-protected admin interface
- PWA manifest + service worker (optional offline basics)

## Scripts
- `npm run dev` – Start development server
- `npm run build` – Production build
- `npm start` – Run built app

## Environment
Create a `.env.local` with your Supabase keys:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Daily Reset Flow
1. Users sign students out -> rows in `sign_out_records`
2. Admin triggers reset endpoint -> `reset_day_archive()`
3. Function archives the day into `sign_out_archives` then clears records

## Naming
Package name: `kindergarten-sign-out-kiosk`
Display name: `Kindergarten Sign-Out Kiosk`
Short PWA name: `KinderKiosk`

## Optional PWA Removal
If you don't want PWA features, delete `public/sw.js` and remove the service worker registration script block in `app/layout.tsx`.

## License
Private (add a license if you plan to distribute).
