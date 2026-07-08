-- Title: Add per-user recipe preferences
-- Description: Creates recipe_prefs, a per-user overlay for recipe display name (rename) and visibility (hide from the recipes tree). Works for any recipe slug — including shared/built-in recipes that users cannot mutate directly — because the row is owned by the user. Duplicated recipes are ordinary user-owned rows in the recipes table (with metadata.baseSlug) and need no schema change.

CREATE TABLE IF NOT EXISTS recipe_prefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    slug TEXT NOT NULL,
    -- Display-name override; NULL means "use the recipe's own name".
    name TEXT,
    hidden BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One preferences row per (user, recipe slug). Named so ON CONFLICT can target it.
CREATE UNIQUE INDEX IF NOT EXISTS recipe_prefs_user_slug_key
    ON recipe_prefs (user_id, slug);
CREATE INDEX IF NOT EXISTS recipe_prefs_user_id_idx ON recipe_prefs (user_id);

-- RLS: a user only sees and mutates their own preference rows.
ALTER TABLE recipe_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_prefs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recipe_prefs_select_policy ON recipe_prefs;
DROP POLICY IF EXISTS recipe_prefs_insert_policy ON recipe_prefs;
DROP POLICY IF EXISTS recipe_prefs_update_policy ON recipe_prefs;
DROP POLICY IF EXISTS recipe_prefs_delete_policy ON recipe_prefs;

CREATE POLICY recipe_prefs_select_policy ON recipe_prefs
    FOR SELECT
    USING (user_id = (select current_setting('app.current_user_id', true)));

CREATE POLICY recipe_prefs_insert_policy ON recipe_prefs
    FOR INSERT
    WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));

CREATE POLICY recipe_prefs_update_policy ON recipe_prefs
    FOR UPDATE
    USING (user_id = (select current_setting('app.current_user_id', true)))
    WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));

CREATE POLICY recipe_prefs_delete_policy ON recipe_prefs
    FOR DELETE
    USING (user_id = (select current_setting('app.current_user_id', true)));

GRANT SELECT, INSERT, UPDATE, DELETE ON recipe_prefs TO byos_app;
