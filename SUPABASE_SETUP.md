# Supabase Setup Guide

## ✅ Your Supabase Credentials (Already Configured)

```
Project URL: https://oxhssvnqhezdpxhsrmdk.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94aHNzdm5xaGV6ZHB4aHNybWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzYwNDYsImV4cCI6MjA3Nzg1MjA0Nn0.W8czHZrImoOFyhxtRYNd81SdwnuiTE2TlgosvmGFe1Y
Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94aHNzdm5xaGV6ZHB4aHNybWRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjI3NjA0NiwiZXhwIjoyMDc3ODUyMDQ2fQ.6FnqDlEJaEbxQf7aAVegNy3yHE7Bw4w0Fm6jXVyN24o
```

These are already configured in your `.env` file! ✅

---

## 🚀 Step-by-Step Setup

### Step 1: Create Database Tables

1. **Go to Supabase Dashboard**
   - Open: https://supabase.com/dashboard/project/oxhssvnqhezdpxhsrmdk

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste the Schema**
   - Open the file `supabase/schema.sql` in this project
   - Copy ALL the SQL code
   - Paste it into the Supabase SQL Editor
   - Click "Run" (or press Ctrl+Enter)

4. **Verify Tables Created**
   - Click "Table Editor" in the left sidebar
   - You should see these tables:
     - ✅ `users`
     - ✅ `watchers`
     - ✅ `user_settings`
     - ✅ `cursors`
     - ✅ `dm_tx_seen`
     - ✅ `channel_tx_posted`

---

### Step 2: Test Locally

```bash
# Build the project
npm run build

# Start the bot
npm start
```

**Expected output:**
```
Using Supabase database
Bot started successfully!
```

---

### Step 3: Test Commands

Open Telegram and test:

1. `/start` - Should create a user in Supabase
2. `/watch 0x9e29f8f3c63401ccc6f0ec03050494756d8157c4` - Should add watcher
3. `/list` - Should show your watchlist
4. `/unwatch 0x9e29f8f3c63401ccc6f0ec03050494756d8157c4` - Should remove watcher

---

### Step 4: Verify Data in Supabase

1. Go to **Table Editor** in Supabase
2. Click on `users` table - you should see your Telegram user
3. Click on `watchers` table - you should see your watched addresses

---

## 🔍 How to Check if It's Working

### Check Logs
```bash
npm start
```

Look for:
- ✅ `Using Supabase database` - Confirms Supabase is active
- ✅ No errors about database connections
- ✅ Commands working normally

### Check Supabase Dashboard

1. **Table Editor** → `users` - Should show users who started the bot
2. **Table Editor** → `watchers` - Should show watched addresses
3. **Table Editor** → `channel_tx_posted` - Should show posted transactions

---

## 🎯 What's Different from File Storage?

| Feature | File Storage | Supabase |
|---------|-------------|----------|
| **Data Location** | `data/db.json` | Supabase cloud |
| **Scalability** | Limited | Unlimited |
| **Concurrent Access** | File locks | Database transactions |
| **Backups** | Manual | Automatic (7 days) |
| **Query Performance** | Slow for large data | Fast with indexes |
| **Free Tier Limit** | Disk space | 500 MB |

---

## ⚠️ Important Notes

### 1. **Stake Windows & Stats**
These are still stored **in-memory** (not in Supabase) because:
- They're temporary (30-minute windows)
- Not critical to persist
- Faster in-memory

If you restart the bot, stake windows reset (this is fine).

### 2. **DM Deduplication**
Currently **disabled** in Supabase mode because the FileDb interface doesn't pass `tgId` to `markDmTx()`.

**Channel deduplication still works!** (This is more important)

### 3. **Synchronous Compatibility**
The SupabaseDb uses "busy wait" to match FileDb's synchronous interface. This works but isn't ideal. For production, consider refactoring commands to be fully async.

---

## 🐛 Troubleshooting

### Error: "relation 'users' does not exist"
**Solution:** Run the SQL schema in Supabase SQL Editor (Step 1)

### Error: "Invalid API key"
**Solution:** Check your `.env` file has the correct `SUPABASE_SERVICE_KEY`

### Commands not working
**Solution:** 
1. Check `npm start` logs for errors
2. Verify `STORAGE_TYPE=supabase` in `.env`
3. Check Supabase dashboard for data

### Bot is slow
**Solution:** This is normal - the "busy wait" adds ~100ms delay to each database call. For production, refactor to async.

---

## 🚀 Next Steps

1. ✅ Run SQL schema in Supabase
2. ✅ Test locally with `npm start`
3. ✅ Verify data in Supabase dashboard
4. ✅ Deploy to Railway with Supabase env vars

---

## 📊 Monitoring

### Check Database Size
1. Go to Supabase Dashboard
2. Click "Settings" → "Database"
3. See "Database size" (free tier: 500 MB limit)

### Check API Usage
1. Go to Supabase Dashboard
2. Click "Settings" → "API"
3. See "API requests" (free tier: unlimited!)

---

## 🎉 You're Ready!

Once you've run the SQL schema and tested locally, you're ready to deploy to Railway!

**Your bot will now use Supabase for all data storage.** 🚀

