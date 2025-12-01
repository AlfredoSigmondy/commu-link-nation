# Database Schema - Which File to Use?

## ❌ DON'T USE - Has Issues

### `DATABASE_SCHEMA.sql`
- References `auth.users` which doesn't exist in standard PostgreSQL
- **Error:** "schema 'auth' does not exist"
- Only works with Supabase
- **Solution:** Use one of the corrected files below instead

---

## ✅ USE ONE OF THESE:

### 1. **DATABASE_SCHEMA_POSTGRESQL.sql**

**Use this if:**
- ✅ You want standalone PostgreSQL (no Supabase)
- ✅ Running locally or self-hosted
- ✅ Using Docker or custom deployment
- ✅ You have your own PostgreSQL server

**What's included:**
- All 11 tables
- Built-in `auth_users` table for authentication
- Indexes for performance
- Triggers and functions
- No Row Level Security (RLS) - you handle auth in backend

**Setup:**
```bash
psql -U postgres -d commu_link_nation -f DATABASE_SCHEMA_POSTGRESQL.sql
```

**Requirements:**
- PostgreSQL 12+ installed locally
- Backend handles authentication (password hashing, JWT tokens, etc.)
- You implement login/signup endpoints

---

### 2. **DATABASE_SCHEMA_SUPABASE.sql**

**Use this if:**
- ✅ Using Supabase (cloud PostgreSQL with auth)
- ✅ Want Row Level Security (RLS)
- ✅ Want automatic storage bucket management
- ✅ Want automatic user onboarding

**What's included:**
- All 11 tables
- Row Level Security (RLS) policies
- Storage buckets (avatars, posts, messages, approaches)
- Storage policies
- Integrates with Supabase auth
- Automatic user profile creation on signup

**Setup:**
1. Go to https://app.supabase.com
2. Create new project
3. Go to SQL Editor → New Query
4. Copy entire `DATABASE_SCHEMA_SUPABASE.sql`
5. Execute
6. Update `.env`:
```env
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
```

**Benefits:**
- No backend needed for auth
- Automatic user profile creation
- Built-in security with RLS
- Cloud storage included
- Real-time updates supported

---

## 📊 Comparison Table

| Feature | PostgreSQL | Supabase |
|---------|-----------|----------|
| Database Type | Standalone | Managed/Cloud |
| Auth System | Built-in (auth_users) | Supabase Auth |
| Row Level Security | No | ✅ Yes |
| Storage | File system | ✅ Cloud buckets |
| Setup | ⚡ 5 minutes | ⚡ 5 minutes |
| Cost | Free (self-hosted) | Free tier available |
| Backend Required | ✅ Yes | Optional |
| Scalability | Manual | Auto-scaling |

---

## 🚀 Quick Decision

**I want the fastest setup:** → `DATABASE_SCHEMA_SUPABASE.sql`

**I want full control:** → `DATABASE_SCHEMA_POSTGRESQL.sql`

**I'm unsure:** → Start with `DATABASE_SCHEMA_SUPABASE.sql`

---

## 🔧 If You Already Started With DATABASE_SCHEMA.sql

**To fix:**

### If using Supabase:
1. Use `DATABASE_SCHEMA_SUPABASE.sql` instead
2. Go to Supabase SQL Editor
3. Copy the entire content
4. Execute

### If using local PostgreSQL:
1. Use `DATABASE_SCHEMA_POSTGRESQL.sql` instead
2. Run: `psql -U postgres -d commu_link_nation -f DATABASE_SCHEMA_POSTGRESQL.sql`
3. Done!

---

## 📝 File Sizes

- `DATABASE_SCHEMA_POSTGRESQL.sql` - ~20KB (with auth_users table)
- `DATABASE_SCHEMA_SUPABASE.sql` - ~25KB (with RLS and storage policies)
- `DATABASE_SCHEMA.sql` - ~15KB (broken - don't use)

---

## ✨ Troubleshooting

**Error: "schema 'auth' does not exist"**
- You used `DATABASE_SCHEMA.sql` with local PostgreSQL
- Solution: Use `DATABASE_SCHEMA_POSTGRESQL.sql` instead

**Error: "references undefined table auth.users"**
- You used `DATABASE_SCHEMA.sql` with local PostgreSQL
- Solution: Use `DATABASE_SCHEMA_POSTGRESQL.sql` instead

**Error: "storage.buckets does not exist"**
- You used `DATABASE_SCHEMA_SUPABASE.sql` with local PostgreSQL
- Solution: Use `DATABASE_SCHEMA_POSTGRESQL.sql` instead

---

## 📚 Other Files Explained

- **DATABASE_SCHEMA.sql** - Original (has auth.users issue) - DON'T USE
- **DATABASE_README.md** - Overview of all database files
- **DATABASE_SETUP_GUIDE.md** - Detailed setup instructions
- **DATABASE_CONNECTIONS.md** - Connection examples for 5+ databases
- **MIGRATIONS_REFERENCE.sql** - Shows how schema evolved (reference only)

---

## Next Steps

1. **Choose your schema file** (PostgreSQL or Supabase)
2. **Execute the SQL**
3. **Update `.env`** with connection details
4. **Start your app:** `npm run dev`
5. **Test:** Create account, post, message, etc.

**Done! 🎉**
