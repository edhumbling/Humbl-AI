-- Check if conversation_summaries view includes folder_id
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'conversation_summaries' 
  AND column_name = 'folder_id';

-- Check actual data - see if any conversations have folder_id set
SELECT id, title, folder_id, updated_at 
FROM conversation_summaries 
ORDER BY updated_at DESC 
LIMIT 10;

-- If the view doesn't have folder_id, update it:
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

