# G&I Holdings LLC — Tenant Portal
## Full Setup Guide

---

## What You Have (Phase 1 — Frontend)

A complete React tenant portal with:
- Login screen (email/password + SMS toggle)
- Rent balance dashboard with G&I Holdings branding
- Maintenance ticket submission with urgency levels
- Ticket status tracking (Open, In Progress, Resolved)
- Pay Rent screen (ready for Stripe wiring)
- Unit info, lease details, and document section

---

## Step 1 — Run It Locally

Make sure you have Node.js installed (https://nodejs.org — get the LTS version).

```bash
cd gi-holdings-portal
npm install
npm run dev
```

Open http://localhost:5173 in your browser. You'll see the full portal.

---

## Step 2 — Set Up Supabase (Database + Auth)

1. Go to https://supabase.com and create a free account
2. Click "New Project" → name it `gi-holdings`
3. Save your database password somewhere safe
4. Go to your project → Settings → API
5. Copy your **Project URL** and **anon public key**
6. Create a `.env` file in your project root:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Create these tables in Supabase SQL Editor:

```sql
-- Tenants / profiles
create table profiles (
  id uuid references auth.users primary key,
  full_name text,
  phone text,
  unit_id uuid,
  created_at timestamp default now()
);

-- Units
create table units (
  id uuid default gen_random_uuid() primary key,
  address text,
  unit_number text,
  monthly_rent numeric,
  created_at timestamp default now()
);

-- Maintenance tickets
create table tickets (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references profiles(id),
  title text not null,
  description text,
  category text,
  urgency text check (urgency in ('low', 'medium', 'high')),
  status text default 'open' check (status in ('open', 'in-progress', 'resolved')),
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Payments
create table payments (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references profiles(id),
  amount numeric,
  type text check (type in ('rent', 'late_fee', 'other')),
  stripe_payment_intent text,
  status text default 'pending',
  paid_at timestamp,
  created_at timestamp default now()
);
```

### Enable Row Level Security (RLS):
```sql
alter table tickets enable row level security;
create policy "Tenants see own tickets" on tickets
  for all using (tenant_id = auth.uid());
```

---

## Step 3 — Set Up Stripe (Payments)

1. Go to https://stripe.com and create a free account
2. Go to Developers → API Keys
3. Copy your **Publishable key** and **Secret key**
4. Add to `.env`:
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...  ← Keep this on server only!
```

### Install Stripe:
```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### How rent payment works:
- Tenant clicks "Pay now" → your backend creates a Stripe PaymentIntent
- Stripe collects card/bank info securely
- Money goes directly to your connected Stripe account → your bank (1-2 business days)
- Payment record saved to Supabase

**To receive money:** In Stripe dashboard → Connect → Create a Connected Account for yourself (or just use your main Stripe account for direct deposits).

---

## Step 4 — Deploy to Netlify

1. Push your code to GitHub (create a free account at github.com if needed)
2. Go to https://netlify.com → "Add new site" → "Import from Git"
3. Connect your GitHub repo
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Environment variables → add all your VITE_ vars from .env
6. Click Deploy!

Your portal will be live at something like: `gi-holdings.netlify.app`
You can add a custom domain like `portal.giholdings.com` in Netlify settings.

---

## Phase 2 (Coming Next): Landlord Dashboard

A separate admin view (password protected, only you can access) showing:
- All tenants and their payment status
- All open tickets with ability to update status
- Revenue overview
- Add/remove tenants and units

---

## Phase 3 (Coming Next): Automation

- Auto late fee calculation after the 5th of each month
- Email/SMS reminders sent to tenants before rent is due
- Automatic receipts emailed after payment

---

## File Structure

```
gi-holdings-portal/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx
    └── components/
        ├── LoginScreen.jsx       ← Login with email/password or SMS
        ├── Dashboard.jsx         ← Header with balance card
        ├── TicketsScreen.jsx     ← View + manage tickets
        ├── PayRentScreen.jsx     ← Pay rent (Stripe ready)
        ├── UnitInfoScreen.jsx    ← Lease info + documents
        └── SubmitTicketModal.jsx ← New ticket form
```

---

Questions? Ask Claude to:
- "Wire up Supabase auth to the login screen"
- "Connect Stripe payments to the pay rent screen"
- "Build the landlord admin dashboard"
- "Add SMS login with Supabase phone auth"
