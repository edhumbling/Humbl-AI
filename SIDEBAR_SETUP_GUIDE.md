# Sidebar & Conversation Management Setup Guide

## Overview
This guide will help you set up the new sidebar with conversation history, user authentication, and database integration.

## 🎯 New Features

### 1. **Slide-out Sidebar**
- Smooth slide animation (300ms ease-out)
- Click outside to close
- Backdrop with opacity transition
- Mobile-friendly (touch gestures supported)
- Theme-aware (dark/light mode)

### 2. **Conversation History**
- List all past conversations
- Auto-generated titles from first message
- Edit conversation names inline
- Delete conversations with confirmation
- Show last updated time and message count
- Highlight currently active conversation

### 3. **User Authentication**
- Login/Signup buttons for non-authenticated users
- User profile at sidebar bottom with avatar and email
- Google profile picture integration
- Logout functionality
- Session persistence

### 4. **Database Integration**
- PostgreSQL database (Neon)
- Store conversations and messages
- User management
- Automatic timestamps
- Efficient indexing

---

## 📋 Setup Steps

### Step 1: Database Setup (Neon PostgreSQL)

1. **Create a Neon Account**
   - Go to [https://console.neon.tech](https://console.neon.tech)
   - Sign up for a free account
   - Create a new project

2. **Run the Database Schema**
   - Open your Neon SQL Editor
   - Copy the contents of `DATABASE_SCHEMA.sql`
   - Run the SQL to create all tables, indexes, and functions
   
   ```sql
   -- Tables created:
   - users (stores user profiles)
   - conversations (stores conversation metadata)
   - messages (stores all chat messages)
   - conversation_summaries (view for easy queries)
   ```

3. **Get Your Connection String**
   - Go to your Neon project dashboard
   - Copy the connection string (starts with `postgresql://`)
   - Add it to your `.env.local`:
   
   ```env
   DATABASE_URL=postgresql://user:password@host/database?sslmode=require
   ```

### Step 2: Stack Auth Setup

1. **Create Stack Auth Project**
   - Go to [https://app.stack-auth.com](https://app.stack-auth.com)
   - Create a new project
   - Configure Google OAuth provider
   
2. **Get API Credentials**
   - Copy your Project ID
   - Copy your Publishable Client Key
   - Copy your Secret Server Key

3. **Add to Environment Variables**
   
   Update your `.env.local`:
   ```env
   NEXT_PUBLIC_STACK_PROJECT_ID=your_project_id
   NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=your_publishable_key
   STACK_SECRET_SERVER_KEY=your_secret_key
   ```

4. **Add to Vercel Environment Variables** (for deployment)
   - Go to Vercel Project Settings → Environment Variables
   - Add all three Stack Auth variables
   - Set for Production, Preview, and Development
   - Redeploy

### Step 3: Install Dependencies

Run in your terminal:

```bash
npm install @neondatabase/serverless
```

This will install the Neon PostgreSQL client library.

### Step 4: Integrate Sidebar into Main Page

The sidebar is already created in `src/components/Sidebar.tsx`. You need to integrate it into your main page:

**Required imports in `page.tsx`:**
```typescript
import Sidebar from '../components/Sidebar';
import { useUser } from '@stackframe/stack';
```

**Add state for sidebar:**
```typescript
const [showSidebar, setShowSidebar] = useState(false);
const [currentConversationId, setCurrentConversationId] = useState<string | undefined>();
const user = useUser(); // Stack Auth hook
```

**Add sidebar component:**
```typescript
<Sidebar
  isOpen={showSidebar}
  onClose={() => setShowSidebar(false)}
  theme={theme}
  user={user}
  onNewConversation={handleNewConversation}
  onSelectConversation={handleSelectConversation}
  currentConversationId={currentConversationId}
/>
```

**Add hamburger menu button in header:**
```typescript
<button
  onClick={() => setShowSidebar(true)}
  className="p-2 rounded-lg transition-colors"
  style={{ backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}
>
  <Menu size={18} style={{ color: theme === 'dark' ? '#e5e7eb' : '#374151' }} />
</button>
```

### Step 5: Implement Conversation Handlers

Add these handler functions to your main component:

```typescript
const handleNewConversation = async () => {
  // Clear current conversation
  clearConversation();
  setCurrentConversationId(undefined);
  
  // If user is logged in, create new conversation in database
  if (user) {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation' }),
      });
      
      if (response.ok) {
        const { conversation } = await response.json();
        setCurrentConversationId(conversation.id);
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  }
};

const handleSelectConversation = async (conversationId: string) => {
  try {
    const response = await fetch(`/api/conversations/${conversationId}`);
    if (response.ok) {
      const { conversation } = await response.json();
      
      // Load conversation into UI
      setCurrentConversationId(conversationId);
      
      // Clear current conversation and load messages
      clearConversation();
      conversation.messages.forEach((msg: any) => {
        if (msg.role === 'user') {
          addUserMessage(msg.content, JSON.parse(msg.images || '[]'));
        } else {
          addAIMessage(
            msg.content,
            undefined,
            JSON.parse(msg.citations || '[]'),
            undefined,
            undefined,
            msg.mode
          );
        }
      });
      
      startConversation();
    }
  } catch (error) {
    console.error('Failed to load conversation:', error);
  }
};
```

### Step 6: Save Messages to Database

Modify your message handling to save to database:

```typescript
// When user sends a message
const saveUserMessage = async (content: string, images: string[]) => {
  if (user && currentConversationId) {
    try {
      await fetch(`/api/conversations/${currentConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'user',
          content,
          images,
        }),
      });
    } catch (error) {
      console.error('Failed to save user message:', error);
    }
  }
};

// When AI responds
const saveAIMessage = async (content: string, citations: any[], mode: string) => {
  if (user && currentConversationId) {
    try {
      await fetch(`/api/conversations/${currentConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'assistant',
          content,
          citations,
          mode,
        }),
      });
      
      // Auto-generate title from first message
      if (conversationHistory.length === 1) {
        await fetch(`/api/conversations/${currentConversationId}/generate-title`, {
          method: 'POST',
        });
      }
    } catch (error) {
      console.error('Failed to save AI message:', error);
    }
  }
};
```

---

## 🎨 Sidebar Features in Detail

### Mobile Optimizations
- **Touch-friendly**: Large tap targets (44px minimum)
- **Swipe gestures**: Swipe left to close sidebar
- **Responsive width**: 320px on mobile, 384px on desktop
- **Scrollable content**: Conversation list scrolls independently
- **Fixed header/footer**: User profile always visible at bottom

### Theme Support
All colors transition smoothly between dark and light modes:

**Dark Theme Colors:**
- Background: `#151514`
- Cards: `#1a1a19`, `#1f1f1f`
- Borders: `rgba(55, 65, 81, 0.6)`
- Text: `#e5e7eb`, `#d1d5db`

**Light Theme Colors:**
- Background: `#ffffff`
- Cards: `#f9fafb`, `#f3f4f6`
- Borders: `rgba(229, 231, 235, 0.6)`
- Text: `#111827`, `#374151`

### Conversation Actions
Each conversation card has a three-dot menu with:
- **Rename**: Click to edit title inline
- **Delete**: Removes conversation and all messages
- Hover effects and smooth transitions
- Only visible on hover (desktop) or tap (mobile)

---

## 🔒 Authentication Flow

### User Login Process:
1. User clicks "Login" in sidebar
2. Redirects to `/handler/login` (Stack Auth)
3. User authenticates with Google
4. Returns to app with session token
5. Sidebar shows user profile and conversation history

### User Logout Process:
1. User clicks their profile in sidebar
2. Clicks "Logout" button
3. Calls `/api/auth/logout`
4. Clears session and redirects to homepage

---

## 📊 Database Schema Details

### `users` Table
```sql
id UUID PRIMARY KEY
stack_user_id VARCHAR(255) UNIQUE  -- Links to Stack Auth
email VARCHAR(255)
display_name VARCHAR(255)
avatar_url TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
last_login TIMESTAMP
```

### `conversations` Table
```sql
id UUID PRIMARY KEY
user_id UUID FOREIGN KEY → users(id)
title VARCHAR(500)
created_at TIMESTAMP
updated_at TIMESTAMP
is_archived BOOLEAN
```

### `messages` Table
```sql
id UUID PRIMARY KEY
conversation_id UUID FOREIGN KEY → conversations(id)
role VARCHAR(20)  -- 'user' or 'assistant'
content TEXT
images JSONB
citations JSONB
mode VARCHAR(20)
created_at TIMESTAMP
```

---

## 🧪 Testing

### Test Checklist:
- [ ] Sidebar opens/closes smoothly
- [ ] Click outside closes sidebar
- [ ] Login/Signup buttons work
- [ ] User profile shows after login
- [ ] New conversation creates database entry
- [ ] Messages save to database
- [ ] Conversation list loads on sidebar open
- [ ] Rename conversation works
- [ ] Delete conversation works
- [ ] Logout clears session
- [ ] Mobile responsive (test on phone)
- [ ] Theme switching works in sidebar
- [ ] Conversations persist after refresh

---

## 🐛 Troubleshooting

### Issue: Sidebar doesn't appear
**Solution:** Check that `showSidebar` state is properly toggled

### Issue: Database connection fails
**Solution:** Verify `DATABASE_URL` in `.env.local` is correct

### Issue: User data doesn't load
**Solution:** Ensure Stack Auth environment variables are set in Vercel

### Issue: Conversations don't save
**Solution:** Check browser console for API errors, verify database tables exist

### Issue: Mobile scrolling broken
**Solution:** Ensure parent elements don't have `overflow: hidden`

---

## 🚀 Deployment

### Vercel Deployment:
1. Push code to GitHub
2. Add environment variables in Vercel dashboard:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_STACK_PROJECT_ID`
   - `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`
   - `STACK_SECRET_SERVER_KEY`
3. Deploy

### Database Migration:
- Run `DATABASE_SCHEMA.sql` in Neon SQL Editor
- Tables will be created automatically
- Indexes optimize query performance

---

## 📱 Mobile-Friendly Features

✅ **Touch Optimized**
- Large tap targets
- Smooth scroll
- Swipe to close

✅ **Performance**
- Lazy loading conversations
- Optimized animations
- Efficient re-renders

✅ **UX Enhancements**
- Pull-to-refresh (future)
- Infinite scroll (future)
- Offline support (future)

---

## 🎉 That's It!

Your sidebar is now fully functional with:
- ✅ Conversation history management
- ✅ User authentication
- ✅ Database persistence
- ✅ Mobile-friendly design
- ✅ Theme support

**Need Help?** Check the inline code comments or create an issue on GitHub.

---

**Version:** 1.0.0  
**Last Updated:** November 2, 2025  
**Status:** ✅ Ready for Production
