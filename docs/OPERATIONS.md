# EdDash Operations

Короткий робочий чекліст для продакшну `eddash.info`.

## Production URLs

- Site: https://eddash.info
- Health check: https://eddash.info/api/health
- Vercel project: `eddash`
- Supabase project: EdDash production database

## Required Environment Variables

### Vercel

- `DATABASE_URL` - pooled Supabase PostgreSQL connection string for application queries.
- `DIRECT_URL` - direct Supabase PostgreSQL connection string for Prisma migrations and maintenance scripts.
- `CRON_SECRET` - secret used by Vercel Cron when calling `/api/cron/edbo-refresh`.
- `NEXT_PUBLIC_GA_ID` - Google Analytics measurement id.
- `GOOGLE_SITE_VERIFICATION` - Google Search Console verification token.

### GitHub Actions

Repository secrets needed for scheduled maintenance:

- `DATABASE_URL`
- `DIRECT_URL`

## Scheduled Jobs

### Vercel Cron

Configured in `vercel.json`:

- Path: `/api/cron/edbo-refresh`
- Schedule: `0 1 1,15 * *`
- Meaning: on the 1st and 15th day of each month at 01:00 UTC.

This endpoint refreshes the standard dashboard cache for the fastest default page load.
It intentionally does not run heavy full EDBO imports inside a serverless request.

### GitHub Actions

Configured in `.github/workflows/scheduled-maintenance.yml`:

- Schedule: `30 1 1,15 * *`
- Manual run: available through `workflow_dispatch`.

The workflow refreshes reference data, institutions, and dashboard cache.

## Data Refresh Rule

For heavy EDBO data imports:

- Do not re-import dates or years that are already loaded.
- Check for newly available snapshot dates or years.
- Import only new slices.
- Refresh dashboard cache after importing new slices.

This keeps the database smaller, reduces risk, and avoids unnecessary recalculation.

## Monitoring

Recommended basic checks:

- Monitor `https://eddash.info/api/health`.
- Alert if status is not `200`.
- Alert if response time is consistently above 5 seconds.
- Check Vercel deployment failures.
- Check Vercel function errors for `/api/dashboard/*`, `/api/institutions/*`, `/api/cron/edbo-refresh`.
- Check Supabase database size and connection usage weekly while imports are active.

## Release Checklist

Before pushing a production change:

1. Run lint/typecheck for touched files.
2. Run `next build`.
3. Push to `main`.
4. Wait for Vercel deployment to finish.
5. Open:
   - `/`
   - `/dashboard`
   - `/institutions`
   - `/specialities`
   - `/api/health`
6. Confirm Google Analytics realtime receives traffic.
7. Confirm Search Console sitemap remains submitted.

## Next Infrastructure Improvements

- Build cached aggregate tables for the most common default slices.
- Add a controlled script that discovers new EDBO dates/years before importing.
- Add a maintenance dashboard inside `/admin/import`.
- Add alerts for failed `ImportRun` rows.
