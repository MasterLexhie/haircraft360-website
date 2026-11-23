-- Like every table: closed to the public database API (Supabase). The app connects as the owner.
ALTER TABLE "service_photos" ENABLE ROW LEVEL SECURITY;
