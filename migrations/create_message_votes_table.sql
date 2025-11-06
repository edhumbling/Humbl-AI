-- Create message_votes table to store upvotes/downvotes per message per user
-- Safe to run multiple times

CREATE TABLE IF NOT EXISTS message_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_message_votes_conversation_id ON message_votes(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_votes_message_id ON message_votes(message_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_message_votes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_message_votes_updated_at ON message_votes;
CREATE TRIGGER trg_message_votes_updated_at
BEFORE UPDATE ON message_votes
FOR EACH ROW EXECUTE FUNCTION update_message_votes_updated_at();


