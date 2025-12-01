# Database Files Summary

This directory contains all the information you need to set up your own database for Commu-Link-Nation.

## 📄 Files Created

### 1. **DATABASE_SCHEMA.sql** ⭐ START HERE
- **Purpose:** Complete, production-ready SQL schema
- **Contains:** All tables, functions, triggers, and RLS policies
- **Usage:** Execute this file in your database to set up the entire schema
- **Size:** ~15KB

### 2. **DATABASE_SETUP_GUIDE.md**
- **Purpose:** Detailed step-by-step setup instructions
- **Covers:**
  - PostgreSQL setup (recommended)
  - Supabase setup
  - Firebase setup
  - Environment variables
  - Storage bucket configuration
  - Security considerations
  - Troubleshooting
- **Read Time:** 10-15 minutes

### 3. **DATABASE_CONNECTIONS.md**
- **Purpose:** Connection examples for 5+ different databases
- **Includes:**
  - Supabase (PostgreSQL) - Recommended
  - Local PostgreSQL
  - Firebase Firestore
  - MongoDB Atlas
  - MySQL/MariaDB
- **Code Examples:** Ready-to-use connection code
- **Data Structures:** Firestore/MongoDB collection layouts

### 4. **MIGRATIONS_REFERENCE.sql**
- **Purpose:** Reference of all incremental migrations
- **Shows:** How the schema evolved from initial setup
- **Use For:** Understanding changes made over time
- **Note:** Use DATABASE_SCHEMA.sql instead for fresh setup

---

## 🚀 Quick Start (5 Minutes)

### Option A: Use Supabase (Easiest)
```bash
1. Go to https://app.supabase.com
2. Create new project
3. Go to SQL Editor
4. Copy entire contents of DATABASE_SCHEMA.sql
5. Execute
6. Update .env with your Supabase credentials
7. Done!
```

### Option B: Use Local PostgreSQL
```bash
1. Install PostgreSQL
2. Create database: createdb commu_link_nation
3. Load schema: psql -U postgres -d commu_link_nation -f DATABASE_SCHEMA.sql
4. Update .env with localhost connection
5. Done!
```

### Option C: Use Your Own Database
```bash
1. Read DATABASE_SETUP_GUIDE.md
2. Choose your database type
3. Follow connection instructions in DATABASE_CONNECTIONS.md
4. Update .env with connection details
5. Done!
```

---

## 📊 Database Structure Overview

```
11 Main Tables:
├── profiles              (user profiles)
├── user_roles            (admin/user roles)
├── posts                 (community posts)
├── post_comments         (comments on posts)
├── post_likes            (likes on posts)
├── tasks                 (community tasks/jobs)
├── task_ratings          (task ratings)
├── friendships           (friend connections)
├── messages              (direct messages)
├── direct_approaches     (support tickets)
└── approach_messages     (support ticket conversations)

4 Enums:
├── app_role              (user, admin)
├── post_status           (pending, approved, rejected)
├── task_status           (open, in_progress, completed, cancelled)
└── approach_status       (open, in_progress, resolved, closed)

Security Features:
├── Row Level Security (RLS) enabled on all tables
├── Role-based access control
├── Foreign key constraints
└── Automatic timestamp management
```

---

## 🔐 Security

- **Row Level Security (RLS):** All tables protected
- **Role-Based Access:** user vs admin roles
- **Foreign Keys:** Data integrity maintained
- **Automatic Triggers:** Timestamps updated automatically
- **Auth Integration:** Uses auth.uid() for access control

---

## 💾 What's Included

### Tables
- User management (profiles, roles)
- Content (posts, comments, likes)
- Tasks/Jobs (tasks, ratings)
- Messaging (messages, direct approaches, approach messages)
- Social (friendships)

### Functions
- `has_role()` - Check user permissions
- `update_updated_at_column()` - Auto-update timestamps
- `handle_new_user()` - Trigger on signup

### Policies (RLS)
- Public read for posts/profiles
- Private reads for personal data (messages, approaches)
- Role-based admin functions
- Self-managed updates

### Features
- Media upload support (avatars, posts, messages)
- Messaging with delivery tracking
- Task/job system with ratings
- Support ticket system
- Admin moderation tools

---

## 🔗 Environment Variables

After setting up your database, update `.env`:

```env
# Supabase/Custom DB
VITE_SUPABASE_URL="your-url"
VITE_SUPABASE_PUBLISHABLE_KEY="your-key"
VITE_SUPABASE_PROJECT_ID="your-id"

# Mapbox (optional)
VITE_MAPBOX_PUBLIC_TOKEN="your-token"
```

---

## 📱 Storage Buckets

Need 4 storage buckets (if using cloud storage):

1. **avatars** (Public)
   - User profile pictures
   - Path: `/avatars/{user_id}/{filename}`

2. **posts** (Public)
   - Post images/videos
   - Path: `/posts/{user_id}/{timestamp}.{ext}`

3. **message-media** (Private)
   - Message attachments
   - Path: `/message-media/{user_id}/{filename}`

4. **approach-media** (Private)
   - Support ticket attachments
   - Path: `/approach-media/{user_id}/{filename}`

---

## ✅ Verification Checklist

After setting up:

- [ ] Database tables created successfully
- [ ] Can connect from application
- [ ] Can create user account
- [ ] Can create a post
- [ ] Can upload images to posts
- [ ] Can send messages
- [ ] Can create tasks
- [ ] Admin features work
- [ ] RLS policies working correctly

---

## 🆘 Common Issues

### "Tables not found"
- Verify DATABASE_SCHEMA.sql executed completely
- Check for SQL errors in database console

### "Cannot connect"
- Verify connection string in .env
- Check database credentials
- Ensure database is running

### "Images not displaying"
- Verify storage buckets created
- Check bucket permissions are public (for public buckets)
- Verify file paths in database

### "RLS denying access"
- Check that auth.uid() is properly set
- Review RLS policies match your use case
- Check user roles are assigned

---

## 📚 Documentation Files

All files are in your project root:

```
commu-link-nation/
├── DATABASE_SCHEMA.sql           ← Execute this for schema
├── DATABASE_SETUP_GUIDE.md       ← Read this for setup
├── DATABASE_CONNECTIONS.md       ← Read for connection examples
├── MIGRATIONS_REFERENCE.sql      ← Reference only
└── .env                          ← Update this after setup
```

---

## 🎯 Next Steps

1. **Choose Your Database**
   - Option 1: Supabase (easiest, PostgreSQL)
   - Option 2: Local PostgreSQL
   - Option 3: Firebase / MongoDB / MySQL

2. **Set Up Database**
   - Follow instructions in DATABASE_SETUP_GUIDE.md
   - Use connection examples from DATABASE_CONNECTIONS.md

3. **Run Schema**
   - Execute DATABASE_SCHEMA.sql in your database

4. **Update Environment**
   - Edit .env with database credentials

5. **Test Connection**
   - Start the app: `npm run dev`
   - Create a test user
   - Test features

6. **Deploy**
   - Your app now uses your own database!

---

## 📞 Support

For database setup help:
- PostgreSQL: https://www.postgresql.org/docs/
- Supabase: https://supabase.com/docs
- Firebase: https://firebase.google.com/docs
- MongoDB: https://docs.mongodb.com/

---

## 📝 Notes

- Lovable created your initial database
- These files allow you to recreate it independently
- All security policies included
- Ready for production use
- Easily extendable for future features

---

**Happy coding! 🚀**
