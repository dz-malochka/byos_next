-- Title: Allow a mixup slot to display a playlist
-- Description: Adds playlist_id and current_index to mixup_slots so a slot can render a rotating playlist instead of a single recipe. playlist_id references playlists(id) ON DELETE SET NULL (deleting a playlist just clears the slot). current_index tracks the last-shown playlist item so the slot advances on each refresh, mirroring device-level playlist rotation.

ALTER TABLE mixup_slots
ADD COLUMN IF NOT EXISTS playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL;

ALTER TABLE mixup_slots
ADD COLUMN IF NOT EXISTS current_index INT NOT NULL DEFAULT 0;
