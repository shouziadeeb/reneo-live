# Reneo Live Supabase

Apply `migrations/` in order, then deploy:

```bash
supabase functions deploy agora-token
supabase secrets set AGORA_APP_ID=... AGORA_APP_CERTIFICATE=...
```

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
