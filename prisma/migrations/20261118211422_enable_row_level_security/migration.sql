/*
  Enable row-level security, with no policies, on every table in this schema.
  Only server code connects, as the table owner, so RLS does not affect the app.
  On Supabase it means the auto-generated public API (anon and authenticated roles) can read nothing.
  Any table added by a later migration must enable RLS in that migration too
  (test/rls.test.ts fails if one is missed).
*/
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = current_schema()
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
