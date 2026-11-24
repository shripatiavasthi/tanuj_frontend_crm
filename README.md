# CareConnect CRM

Small React admin workspace for creating consumer and provider accounts and managing the CareConnect service catalog.

The **Services** page lists the live catalog and lets an administrator create services with optional subservices and optional JPEG, PNG, or WebP images on both service and subservice entries. Images are converted to base64 data URLs and stored in MongoDB by the backend (maximum 5 MB per image). Existing services can be viewed here; editing and deleting catalog entries are not currently supported.

## Run locally

```sh
npm install
cp .env.example .env
npm run dev
```

Set `VITE_API_BASE_URL` in `.env` to the backend API base URL, including `/api`. The default is `https://tanujphytonbackend.vercel.app/api`.

Before deploying, configure a random `CRM_ADMIN_SETUP_SECRET` (at least 32 characters) in the backend environment. In the CRM, choose **First time? Set up the first admin** and create the admin with that secret. The one-time endpoint only allows one admin account; remove `CRM_ADMIN_SETUP_SECRET` from the backend and redeploy after setup. Admin login uses a JWT held in the current browser session; the CRM does not store the password or embed an admin secret in its bundle.

Build a static production bundle with `npm run build`; Vite writes it to `dist/`.

## Important security limitation

Consumer/provider registration remains public for the mobile apps. CRM account creation and service creation use admin-protected backend endpoints and require the signed-in admin's JWT. Keep the CRM private to trusted administrators.
# tanuj_frontend_crm
