# Nandar Pictures Portal

Film distribution accounting platform for Nandar Pictures / Olive Branch TV. Manages filmmaker royalties, streaming payment ingestion, and payout requests.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Database & Auth**: Supabase (PostgreSQL + Row Level Security)
- **Charts**: Recharts
- **File Parsing**: SheetJS (Excel) + PapaParse (CSV)

## Setup

### 1. Clone & Install

```bash
git clone https://github.com/olivebranchtv/NandarPicturesPortal.git
cd NandarPicturesPortal
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → anon public key |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API → service_role secret key |

> **Never commit `.env` to git.** It's already in `.gitignore`.

### 3. Database Setup

Run the SQL files in order in the Supabase SQL editor:

1. `STEP1_DROP_TABLES.sql` — drop existing tables (skip on fresh project)
2. `STEP2_CREATE_TABLES.sql` — create all tables
3. `STEP3_CREATE_FUNCTIONS.sql` — create stored procedures
4. `STEP4_CREATE_POLICIES.sql` — set up Row Level Security
5. `STEP5_CREATE_INDEXES.sql` — create performance indexes
6. `AUDIT_LOG_MIGRATION.sql` — adds `approved_by` audit column to payment_requests

Or run `APPLY_ALL_MIGRATIONS.sql` if it has been kept up to date.

### 4. Dev Server

```bash
npm run dev
```

App will be at http://localhost:5173

### 5. Production Build

```bash
npm run build
npm run preview
```

## Roles

| Role | Access |
|---|---|
| `admin` | Full access — manage titles, filmmakers, upload payments, approve/reject payout requests |
| `filmmaker` | Read-only access to their own titles and financial data, can submit payout requests |

## Admin Accounts

Admin accounts are created by existing admins only. Public signup creates `filmmaker` accounts. To add a new admin, use the **Admins** tab in the admin dashboard.

## Payment Workflow

```
1. Admin uploads Excel/CSV payment file (columns: Date, Amount, Channel, Title)
2. System fuzzy-matches title names to existing content (70% similarity threshold)
3. Unmatched rows land in "Unassigned Payments" queue for manual assignment
4. Filmmakers see their revenue on the dashboard
5. Filmmaker submits a payout request (min $100, must not have a pending request)
6. Admin approves request → filmmaker paid within 14 days
7. Admin marks request as "Paid" with payment method used
```

## Distribution Split

Default split: **25% company / 75% filmmaker**. Can be customized per title in the Titles tab.

## Adding Filmmakers

Use the **Filmmakers** tab → "Add Filmmaker" button. A temporary password will be generated and displayed once. Share it with the filmmaker so they can log in and change it.

## Bulk Title Import

Use `import_titles.mjs` with the CSV format documented in `BULK_TITLE_IMPORT_INSTRUCTIONS.md`.

## File Upload Limits

Payment files max size: **10 MB**. Supported formats: `.xlsx`, `.xls`, `.csv`.

## Key Files

| File | Purpose |
|---|---|
| `src/lib/supabase.ts` | Supabase client + all TypeScript interfaces |
| `src/lib/fileParser.ts` | Excel/CSV parsing logic |
| `src/lib/fuzzyMatch.ts` | Levenshtein distance title matching |
| `src/lib/formatters.ts` | Currency formatting + fee calculation |
| `src/hooks/useAuth.ts` | Authentication state management |
| `src/hooks/useFinancialData.ts` | Financial data aggregation hook |
| `src/pages/AdminDashboard.tsx` | Admin UI |
| `src/pages/FilmmakerDashboard.tsx` | Filmmaker UI |
