-- Verification and Fix Script for Folder Migration
-- Run this in your Neon SQL Editor to check if folder_id column exists

-- 1. Check if folder_id column exists in conversations table
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'conversations' 
  AND column_name = 'folder_id';

-- 2. If the above query returns no rows, run this to add the column:
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='conversations' AND column_name='folder_id'
    ) THEN
        ALTER TABLE conversations 
        ADD COLUMN folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_conversations_folder_id ON conversations(folder_id);
        
        -- Update the view to include folder_id
        CREATE OR REPLACE VIEW conversation_summaries AS
        SELECT 
            c.id,
            c.user_id,
            c.folder_id,
            c.title,
            c.created_at,
            c.updated_at,
            c.is_archived,
            COUNT(m.id) as message_count,
            MAX(m.created_at) as last_message_at
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversation_id
        GROUP BY c.id, c.user_id, c.folder_id, c.title, c.created_at, c.updated_at, c.is_archived;
        
        RAISE NOTICE 'Added folder_id column and updated view';
    ELSE
        RAISE NOTICE 'folder_id column already exists';
    END IF;
END $$;

-- 3. Verify the view includes folder_id
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'conversation_summaries' 
  AND column_name = 'folder_id';

-- 4. Test query to see conversations with their folder_id
SELECT id, title, folder_id, updated_at 
FROM conversation_summaries 
ORDER BY updated_at DESC 
LIMIT 10;

