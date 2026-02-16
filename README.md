# Monthly Goal Wizard

Browser-only goal setting app for staff to submit monthly goals with historical context. No backend required.

## Tech
- Vite + React + TypeScript
- Tailwind CSS
- react-hook-form + zod
- HashRouter for GitHub Pages deep-link support

## Run locally
```bash
npm install
npm run dev
```

## Validate and build
```bash
npm run validate:data
npm run build
npm run preview
```

## GitHub Pages setup
1. Push this project to a GitHub repository.
2. In GitHub, go to **Settings > Pages**.
3. Set **Source** to **GitHub Actions**.
4. Ensure the workflow file `.github/workflows/deploy-pages.yml` exists on `main`.
5. Push to `main` and GitHub Pages will build/deploy automatically.

Notes:
- Workflow sets `VITE_BASE_PATH=/<repo-name>/` during build.
- App routing uses `HashRouter`, so shared links look like `#/?region=Midwest&chapter=Chicago`.

## Shared historical data updates
The app ships shared history data from a static asset:
- File: `public/data/history.csv`
- Schema: `region,chapter,metric_key,year,month,value`

To update shared history:
1. Replace `public/data/history.csv` with updated data.
2. Run `npm run validate:data`.
3. Commit and push to `main`.
4. GitHub Pages redeploys with the new shared data.

## Staff submission flow
After completing goals, staff can:
1. Copy submission
2. Download submission
3. Email submission

Submission text is human-friendly and includes a hidden machine-readable payload under:
`---TECH (do not edit)---`

Sample output is included in:
- `MonthlyGoals_sample_submission.txt`

## Local storage behavior
Stored locally in browser:
- Profile: `staffName`, `lastRegion`, `lastChapter`
- Draft goals keyed by `region+chapter+staff+month window`

Use **Clear draft** in the Goals step to reset current draft values.
