import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hcakrtkqjxtyfmakaxkq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjYWtydGtxanh0eWZtYWtheGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTU2ODMsImV4cCI6MjA5MzEzMTY4M30.fFjlozwRnBaQ5eBiN2FONfNqSdgvxus_AR5YLJx2ukk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
