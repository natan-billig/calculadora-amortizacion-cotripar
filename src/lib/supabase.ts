import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://erbuwkwkcnhczvcfndfi.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyYnV3a3drY25oY3p2Y2ZuZGZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NDgzMjMsImV4cCI6MjEwNzUyNDMyM30.9wlin4LxW9eJtmMSc9xPd6XVxNGj9G64TTUuWFs0OaE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
