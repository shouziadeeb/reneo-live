# Reneo Live Supabase

Apply `migrations/20260326000001_init.sql` to your project, then deploy:

```bash
supabase functions deploy agora-token
supabase secrets set AGORA_APP_ID=... AGORA_APP_CERTIFICATE=...
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are usually provided automatically to Edge Functions in hosted Supabase.
