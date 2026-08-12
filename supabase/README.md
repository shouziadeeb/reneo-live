# Reneo Live Supabase

Apply `migrations/` in order (including `20260326000004_interactive_live.sql` for Round 2 Part A), then deploy:

```bash
supabase functions deploy agora-token
supabase secrets set AGORA_APP_ID=... AGORA_APP_CERTIFICATE=...
```

Round 2 requires redeploying `agora-token` after the interactive-live migration so publisher tokens can be issued to accepted speakers/co-hosts via `user_can_publish_on_live`.

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are usually provided automatically to Edge Functions in hosted Supabase.

Required secrets (Dashboard → Edge Functions → Secrets):

```bash
supabase secrets set AGORA_APP_ID=your-app-id AGORA_APP_CERTIFICATE=your-certificate
```

Optional for richer error JSON during debugging:

```bash
supabase secrets set DEBUG_AGORA_TOKEN=true
```

Redeploy after changes:

```bash
supabase functions deploy agora-token --project-ref lfheeaxwsvoimlfetbvf
```
