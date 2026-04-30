import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hcakrtkqjxtyfmakaxkq.supabase.co";

// Using the publishable key (new Supabase format)
const SUPABASE_KEY = "sb_publishable_PyhXPKpZmWh6UCu2g29wEQ_5_TEalnE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
