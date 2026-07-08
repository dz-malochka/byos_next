-- Title: Add free-form layout tree to mixups
-- Description: Adds a nullable layout_tree JSONB column to mixups so a mixup can store a custom binary split-tree layout (resizable, arbitrarily split areas) instead of only one of the five fixed presets. When layout_tree is NULL the mixup still renders from its preset layout_id, so existing rows are unaffected.

-- layout_tree holds a MixupNode tree: leaves are rendered areas, split nodes
-- divide their box row/column at a ratio. See lib/mixup/layout-tree.ts.
ALTER TABLE mixups
ADD COLUMN IF NOT EXISTS layout_tree JSONB;
