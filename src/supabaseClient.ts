import { createClient } from "@supabase/supabase-js";

// Supabase project credentials as provided
const SUPABASE_URL = "https://mvmlwelmilhitoetessx.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12bWx3ZWxtaWxoaXRvZXRlc3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NTYxOTksImV4cCI6MjA5NjUzMjE5OX0.1MIsmOLAZM31b1BsysxII88U6JzOQWMp5kNDRiFmCnc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
