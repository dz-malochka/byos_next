-- Title: Set devices.playlist_id FK to ON DELETE SET NULL
-- Description: Recreates the devices_playlist_id_fkey constraint with ON DELETE SET NULL so deleting a playlist no longer fails with a foreign key violation when devices still reference it. Devices lose their playlist association (playlist_id -> NULL) instead of blocking the delete. Idempotent (drops the constraint if present before recreating).

-- The original constraint (migration 0000) was created without an ON DELETE
-- clause, so it defaulted to NO ACTION. Deleting a playlist that any device
-- still pointed at raised:
--   update or delete on table "playlists" violates foreign key constraint
--   "devices_playlist_id_fkey" on table "devices"
--
-- SET NULL (not CASCADE) is intentional: a device must survive its playlist
-- being deleted -- it just falls back to having no playlist. The display path
-- guards on `if (device.playlist_id)`, so a NULL value is handled gracefully.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'devices_playlist_id_fkey'
  ) THEN
    ALTER TABLE public.devices DROP CONSTRAINT devices_playlist_id_fkey;
  END IF;

  ALTER TABLE public.devices
    ADD CONSTRAINT devices_playlist_id_fkey
    FOREIGN KEY (playlist_id) REFERENCES public.playlists(id) ON DELETE SET NULL;
END $$;
