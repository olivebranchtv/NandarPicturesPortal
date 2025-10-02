import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const titles = [
  "THE RED RESURRECTION",
  "Good Grief",
  "Bury Me Twice",
  "The Secrets of Jonathan Sperry",
  "A Horse Called Bear",
  "Hidden Secrets",
  "Hometown Legend",
  "Clancy",
  "My Daddy is in Heaven",
  "Mr. Troop Mom",
  "Like a Country Song",
  "An Interview with God",
  "Road to Victory",
  "The Least of These",
  "The Frontier Boys",
  "Hearts of Spring",
  "Marriage Retreat",
  "Homecoming Christmas",
  "The Mulligan",
  "Love Finds You in Charm",
  "Love Finds You in Valentine",
  "Not My Life",
  "Suing the Devil",
  "Amazing Love",
  "Love Finds You in Sugarcreek",
  "Letters to God",
  "Alleged",
  "The Stream",
  "After the Harvest",
  "Nora Roberts - Tribute",
  "Nora Roberts Angels Fall",
  "Sweet Laurel",
  "Second Chances",
  "Undercover Bridesmaid",
  "Making the Rules",
  "A Cowgirl Story",
  "Dater's Handbook",
  "Love Struck Café",
  "Wedding March",
  "Love on the Menu",
  "The Perfect Bride",
  "Campfire Kiss",
  "Love at First Glance",
  "On the Twelfth Day of Christmas",
  "Christmas Encore",
  "A Bride for Christmas",
  "Season for Love",
  "Christmas Getaway",
  "Appetite for Love",
  "June in January",
  "All of My Heart",
  "Summer in the City",
  "Unleashing Mr. Darcy",
  "Love on a Limb",
  "All Things Valentine",
  "Christmas Under Wraps",
  "My Christmas Dream",
  "A Country Wedding",
  "Window Wonderland",
  "Wedding March 2",
  "Destination Wedding",
  "Love Blossoms",
  "Moonlight in Vermont",
  "Christmas List",
  "The Wishing Tree",
  "Marrying Mr. Darcy",
  "Love at the Shore",
  "Picture Perfect Mysteries",
  "The Convenient Groom",
  "Love Takes Flight",
  "Love by the Book",
  "Follow Your Heart",
  "A Taste of Summer",
  "A Royal Winter",
  "A Christmas Detour",
  "Christmas in Homestead",
  "A Wish for Christmas",
  "Love in Design",
  "Just My Type",
  "The Christmas Cottage",
  "Angel of Christmas",
  "Christmas in Angel Falls",
  "Sweet Mountain Christmas",
  "With Love, Christmas",
  "Christmas Next Door",
  "My Christmas Love",
  "Christmas at Pemberley Manor",
  "Royal Hearts",
  "Love, Once and Always",
  "Surprised by Love",
  "A Princess for Christmas",
  "Crown for Christmas",
  "A Royal Christmas",
  "Wedding Bells",
  "A December Bride",
  "My Summer Prince",
  "The Bridge - Part 2",
  "The Bridge",
  "Karen Kingsbury's Maggie's Christmas Miracle",
  "October Baby",
  "Moms' Night Out",
  "Do You Believe?",
  "God's Not Dead",
  "Forever My Girl",
  "Selfie Dad",
  "Summer of '67",
  "Revelation Road",
  "Revelation Road 2",
  "Revelation Road 3",
  "Revelation Road - Beginning of the End",
  "What Would Jesus Do?",
  "In His Steps",
  "Miracle Maker",
  "Extraordinary",
  "Christmas Child",
  "Crazy Enough",
  "Finding Normal",
  "Champion",
  "Indivisible",
  "The Case for Christ",
  "The Warrant",
  "Woodlawn",
  "Same Kind of Different as Me",
  "I Can Only Imagine",
  "Like Arrows",
  "God's Compass",
  "I'm Not Ashamed",
  "Beautifully Broken",
  "Unplanned",
  "Run the Race",
  "Midway to Heaven",
  "To Save a Life",
  "Courageous",
  "Facing the Giants",
  "Flywheel",
  "Fireproof",
  "War Room",
  "Overcomer",
  "Show Me the Father",
  "The Forge"
];

async function importTitles() {
  console.log(`Starting import of ${titles.length} titles...`);
  console.log('');

  let successCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  for (const titleName of titles) {
    try {
      const { data: existing } = await supabase
        .from('content')
        .select('id, title_name')
        .ilike('title_name', titleName)
        .maybeSingle();

      if (existing) {
        console.log(`⏭️  SKIP: "${titleName}" (already exists)`);
        duplicateCount++;
        continue;
      }

      const { error } = await supabase
        .from('content')
        .insert({
          title_name: titleName,
          content_type: 'movie',
          status: 'approved',
          revenue_total: 0,
          distribution_fee: 0,
          expenses_total: 0,
          net_revenue: 0,
        });

      if (error) {
        console.error(`❌ ERROR: "${titleName}" - ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ SUCCESS: "${titleName}"`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ ERROR: "${titleName}" - ${err.message}`);
      errorCount++;
    }
  }

  console.log('');
  console.log('='.repeat(50));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Successfully imported: ${successCount}`);
  console.log(`⏭️  Skipped (duplicates): ${duplicateCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📊 Total processed: ${titles.length}`);
  console.log('='.repeat(50));
}

importTitles().catch(console.error);
