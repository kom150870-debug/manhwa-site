
Mongolian Manhwa MVP Starter
Bilingual (Mongolian + English) solo-builder starter with a VIP subscription data model.
Included
Responsive static MVP homepage with language toggle, search, and sample titles.
Supabase PostgreSQL schema for profiles, manga, chapters, pages, VIP subscriptions, and reading progress.
Netlify Function to list published manga.
Placeholder VIP-status endpoint that intentionally does not expose arbitrary user data.
Deploy from Android
Extract this ZIP and upload all files/folders to a GitHub repository, preserving structure.
Netlify: Add new project -> Import an existing project -> choose the repo.
Build command: blank. Publish directory: .. Functions directory: netlify/functions.
Create a Supabase project and run supabase/schema.sql in its SQL Editor.
In Netlify environment variables set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Keep the service-role key server-side only.
Redeploy.
The homepage displays sample data until Supabase is configured. This is an MVP scaffold, not a production payment system. Before charging VIP users, implement Supabase Auth, server-side VIP enforcement, a payment provider and verified payment webhooks. Never expose secret keys in frontend code. Confirm content rights before publishing manhwa.