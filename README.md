# 2X Customs — Local Dev

This repository contains a Vite + React starter with Tailwind CSS and the `App` component for the 2X Customs website.

Getting started

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

Notes
- The app expects optional Firebase config via environment variables or global variables injected at runtime. See the `src/App.jsx` top for the keys: `__firebase_config`, `__app_id`, and `__initial_auth_token`.
- This scaffold includes Tailwind — you can edit `tailwind.config.cjs` and `src/index.css`.

Environment variables (Vite)
- This project reads Firebase configuration from Vite env vars. Create a local env file named `.env.local` (do NOT commit it) and set `VITE_FIREBASE_CONFIG` to a JSON string. You can use the provided `.env.example` as a template.

Example `.env.local` (copy from `.env.example`):

```bash
# VITE_FIREBASE_CONFIG='{"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}'
VITE_APP_ID=default-2xcustoms-app-id
```

The app falls back to global variables (`__firebase_config`, `__app_id`, `__initial_auth_token`) if you prefer injecting values at runtime.

If you want, I can run `npm install` and start the dev server now (it may take a minute). Tell me to proceed and I'll run it here.

**Deployment**

Vercel (recommended, zero-config for most static sites)

- Add the project to Vercel and set the build command to `npm run build` and the output directory to `dist`.
- You can use the provided `vercel.json` which tells Vercel to use `@vercel/static-build` and publish the `dist` folder.

Quick CLI deploy (optional):

```bash
# Install Vercel CLI (optional)
npm i -g vercel

# Run from project root
vercel --prod
```

Netlify (static build + SPA redirect)

- The repository includes `netlify.toml` which runs `npm run build` and publishes the `dist` folder. It also adds a SPA redirect that serves `index.html` for all routes.

Quick deploy using Netlify CLI:

```bash
# Install Netlify CLI
npm i -g netlify-cli

# From project root
netlify deploy --prod --dir=dist
```

Notes
- Both platforms pick up environment variables. Add your `VITE_FIREBASE_CONFIG` (as a JSON string) and `VITE_APP_ID` in the project's settings on Vercel or Netlify.
- If you prefer GitHub Actions + Netlify/Vercel integration, I can add a workflow to auto-deploy on push to `main`.

## Admin Access & Password Setup

You can protect the admin dashboard with a password. There are two modes:

### 1. Simple Password (Client-side)

- Set the `VITE_ADMIN_PASSWORD` environment variable in your `.env.local` (or `.env`) or in your hosting provider's environment settings.

Example `.env.local` entry:

```bash
VITE_ADMIN_PASSWORD=PizzaWhite70
```

- Restart the dev server: `npm run dev`
- Open the site and click the lock icon in the header to enter the admin password and access the submissions dashboard.
- Authentication is stored in `localStorage` for convenience (client-side only).

**Warning:** This method is not secure for production. The password is bundled in the frontend and can be discovered. For real security, use Firebase Authentication.

### 2. Firebase Admin Login (Recommended)

- Set up Firebase Authentication in your Firebase project.
- Create an admin user in Firebase Auth (email/password).
- In your `.env.local` (or hosting provider env), set:

```bash
VITE_FIREBASE_CONFIG='{"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}'
VITE_USE_FIREBASE_ADMIN=1
```

- Restart the dev server: `npm run dev`
- The admin modal will show email + password fields. Use your Firebase admin credentials to log in.
- For production, set Firestore security rules so only authenticated admin users can read/write submissions.

#### Deployment Notes
- Vercel/Netlify: Add these environment variables in your project/site settings and redeploy.
- After changing env vars, always trigger a new build/deploy.

#### Example `.env.local` for both modes
```bash
# Simple password mode
VITE_ADMIN_PASSWORD=PizzaWhite70

# Firebase admin mode
VITE_FIREBASE_CONFIG='{"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}'
VITE_USE_FIREBASE_ADMIN=1
```

# Deploying to Vercel

1. Push your code to GitHub (or connect your repo to Vercel).
2. Go to https://vercel.com and click "New Project".
3. Import your repo and select it.
4. Set build command: `npm run build`
   Set output directory: `dist`
5. Add environment variables in Vercel dashboard:
   - `VITE_ADMIN_PASSWORD=PizzaWhite70`
   - (add any others you need, e.g. `VITE_FIREBASE_CONFIG`)
6. Click "Deploy". Your site will be live at a public URL.

You can share this URL with anyone. All changes pushed to your repo will auto-deploy.

For more details, see https://vercel.com/docs/concepts/projects/project-configuration

## Deployment Note
This file was updated to test Vercel auto-deploy.
# 2xCustoms