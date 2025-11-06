-- Create reports table for storing user reports about conversations
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  category VARCHAR(255) NOT NULL,
  sub_category VARCHAR(255) NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on conversation_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_reports_conversation_id ON reports(conversation_id);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- Add comment to table
COMMENT ON TABLE reports IS 'Stores user reports about conversations for moderation purposes';

