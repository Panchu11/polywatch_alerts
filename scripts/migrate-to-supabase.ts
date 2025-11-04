/**
 * Migration Script: File DB → Supabase
 * 
 * This script migrates all data from data/db.json to Supabase
 */

import { FileDb } from '../src/store/filedb';
import { supabase } from '../src/store/supabase';

async function migrate() {
  console.log('🚀 Starting migration to Supabase...\n');
  
  try {
    // Load file database
    const fileDb = new FileDb();
    const data = fileDb.data;
    
    console.log('📊 Data to migrate:');
    console.log(`  - Users: ${data.users.length}`);
    console.log(`  - Watchers: ${data.watchers.length}`);
    console.log(`  - Cursors: ${Object.keys(data.cursors).length}`);
    console.log(`  - User Settings: ${Object.keys(data.userSettings).length}\n`);
    
    // Migrate users
    if (data.users.length > 0) {
      console.log('👥 Migrating users...');
      const usersToInsert = data.users.map(u => ({
        tg_id: u.tgId,
        username: u.username,
        first_name: u.firstName,
        referred_by: u.referredBy,
      }));
      
      const { error } = await supabase.from('users').upsert(usersToInsert, {
        onConflict: 'tg_id',
        ignoreDuplicates: false,
      });
      
      if (error) {
        console.error('❌ Error migrating users:', error);
      } else {
        console.log(`✅ Migrated ${usersToInsert.length} users\n`);
      }
    }
    
    // Migrate watchers
    if (data.watchers.length > 0) {
      console.log('👀 Migrating watchers...');
      const watchersToInsert = data.watchers.map(w => ({
        tg_id: w.tgId,
        address: w.address.toLowerCase(),
      }));
      
      const { error } = await supabase.from('watchers').upsert(watchersToInsert, {
        onConflict: 'tg_id,address',
        ignoreDuplicates: true,
      });
      
      if (error) {
        console.error('❌ Error migrating watchers:', error);
      } else {
        console.log(`✅ Migrated ${watchersToInsert.length} watchers\n`);
      }
    }
    
    // Migrate cursors
    const cursorEntries = Object.entries(data.cursors);
    if (cursorEntries.length > 0) {
      console.log('📍 Migrating cursors...');
      const cursorsToInsert = cursorEntries.map(([address, cursor]) => ({
        address: address.toLowerCase(),
        last_ts: cursor.lastTs,
        last_tx: cursor.lastTx,
      }));
      
      const { error } = await supabase.from('cursors').upsert(cursorsToInsert, {
        onConflict: 'address',
        ignoreDuplicates: false,
      });
      
      if (error) {
        console.error('❌ Error migrating cursors:', error);
      } else {
        console.log(`✅ Migrated ${cursorsToInsert.length} cursors\n`);
      }
    }
    
    // Migrate user settings
    const settingsEntries = Object.entries(data.userSettings);
    if (settingsEntries.length > 0) {
      console.log('⚙️  Migrating user settings...');
      const settingsToInsert = settingsEntries
        .filter(([_, settings]) => settings.minDmUsd !== undefined)
        .map(([tgId, settings]) => ({
          tg_id: parseInt(tgId),
          min_dm_usd: settings.minDmUsd,
        }));
      
      if (settingsToInsert.length > 0) {
        const { error } = await supabase.from('user_settings').upsert(settingsToInsert, {
          onConflict: 'tg_id',
          ignoreDuplicates: false,
        });
        
        if (error) {
          console.error('❌ Error migrating settings:', error);
        } else {
          console.log(`✅ Migrated ${settingsToInsert.length} user settings\n`);
        }
      }
    }
    
    // Verify migration
    console.log('🔍 Verifying migration...');
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    const { count: watcherCount } = await supabase
      .from('watchers')
      .select('*', { count: 'exact', head: true });
    
    const { count: cursorCount } = await supabase
      .from('cursors')
      .select('*', { count: 'exact', head: true });
    
    console.log('\n📊 Verification:');
    console.log(`  - Users in Supabase: ${userCount}`);
    console.log(`  - Watchers in Supabase: ${watcherCount}`);
    console.log(`  - Cursors in Supabase: ${cursorCount}`);
    
    console.log('\n✅ Migration complete!');
    console.log('\n💡 Next steps:');
    console.log('  1. Verify data in Supabase dashboard');
    console.log('  2. Update .env with STORAGE_TYPE=supabase');
    console.log('  3. Test bot locally');
    console.log('  4. Deploy to Railway with new env vars');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate().catch(console.error);

