-- Add parent_conversation_id to track branched conversations
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS parent_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS parent_conversation_title TEXT;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_conversations_parent_id ON conversations(parent_conversation_id);

