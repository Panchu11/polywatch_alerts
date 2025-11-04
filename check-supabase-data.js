// Check what data is in Supabase
require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkData() {
  console.log('🔍 Checking Supabase data...\n');
  
  // Check users
  console.log('📊 USERS:');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (usersError) {
    console.error('❌ Error:', usersError.message);
  } else {
    console.log(`   Total users: ${users?.length || 0}`);
    users?.forEach(u => {
      console.log(`   - ID: ${u.tg_id}, Username: @${u.username || 'unknown'}, Created: ${new Date(u.created_at).toLocaleString()}`);
    });
  }
  
  // Check watchers
  console.log('\n👀 WATCHERS:');
  const { data: watchers, error: watchersError } = await supabase
    .from('watchers')
    .select('*')
    .order('added_at', { ascending: false });
  
  if (watchersError) {
    console.error('❌ Error:', watchersError.message);
  } else {
    console.log(`   Total watchers: ${watchers?.length || 0}`);
    watchers?.forEach(w => {
      console.log(`   - User ${w.tg_id} watching ${w.address}, Added: ${new Date(w.added_at).toLocaleString()}`);
    });
  }
  
  // Check user settings
  console.log('\n⚙️  USER SETTINGS:');
  const { data: settings, error: settingsError } = await supabase
    .from('user_settings')
    .select('*');
  
  if (settingsError) {
    console.error('❌ Error:', settingsError.message);
  } else {
    console.log(`   Total settings: ${settings?.length || 0}`);
    settings?.forEach(s => {
      console.log(`   - User ${s.tg_id}: min_dm_usd = ${s.min_dm_usd || 'default'}`);
    });
  }
  
  // Check cursors
  console.log('\n📍 CURSORS:');
  const { data: cursors, error: cursorsError } = await supabase
    .from('cursors')
    .select('*')
    .order('updated_at', { ascending: false });
  
  if (cursorsError) {
    console.error('❌ Error:', cursorsError.message);
  } else {
    console.log(`   Total cursors: ${cursors?.length || 0}`);
    cursors?.forEach(c => {
      console.log(`   - Address ${c.address}: last_ts = ${c.last_ts}, Updated: ${new Date(c.updated_at).toLocaleString()}`);
    });
  }
  
  // Check channel posts
  console.log('\n📢 CHANNEL POSTS:');
  const { data: channelPosts, error: channelError } = await supabase
    .from('channel_tx_posted')
    .select('*')
    .order('posted_at', { ascending: false })
    .limit(10);
  
  if (channelError) {
    console.error('❌ Error:', channelError.message);
  } else {
    console.log(`   Total channel posts: ${channelPosts?.length || 0} (showing last 10)`);
    channelPosts?.forEach(p => {
      console.log(`   - TX: ${p.tx_hash}, Posted: ${new Date(p.posted_at).toLocaleString()}`);
    });
  }
  
  // Check DM dedupe
  console.log('\n💬 DM DEDUPE:');
  const { data: dmDedupe, error: dmError } = await supabase
    .from('dm_tx_seen')
    .select('*')
    .order('seen_at', { ascending: false })
    .limit(10);
  
  if (dmError) {
    console.error('❌ Error:', dmError.message);
  } else {
    console.log(`   Total DM dedupe records: ${dmDedupe?.length || 0} (showing last 10)`);
    dmDedupe?.forEach(d => {
      console.log(`   - User ${d.tg_id}, Address ${d.address}, TX: ${d.tx_hash}, Seen: ${new Date(d.seen_at).toLocaleString()}`);
    });
  }
  
  console.log('\n✅ Done!');
}

checkData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

