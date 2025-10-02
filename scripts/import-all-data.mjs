import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables!');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const users = [
  {
    id: "727da93e-5e0b-4d33-a239-cbff99b8d377",
    email: "mail@nandarpictures.com",
    role: "admin",
    created_at: "2025-09-22 20:38:05.295306+00"
  },
  {
    id: "f5efb45d-1578-45a8-9184-476e293b3428",
    email: "escapehatchfilms@gmail.com",
    first_name: "Brandon",
    last_name: "Green",
    role: "filmmaker",
    created_at: "2025-09-22 21:08:56.215655+00"
  },
  {
    id: "af766898-bf2e-429a-b240-17a337ec7686",
    email: "nancycriss@yahoo.com",
    first_name: "Nancy",
    last_name: "Criss",
    role: "admin",
    created_at: "2025-09-22 20:38:30.141495+00"
  },
  {
    id: "cbdb9366-3647-4942-9a28-4299542743e4",
    email: "criss.nancy@gmail.com",
    first_name: "Nancy",
    last_name: "Criss",
    role: "filmmaker",
    created_at: "2025-09-22 21:52:07.279541+00"
  },
  {
    id: "5e8f7a32-8448-4851-91a6-a2082ffe6d1b",
    email: "matthewhlong@gmail.com",
    role: "filmmaker",
    created_at: "2025-09-22 23:56:37.07045+00"
  }
];

const content = [
  {
    id: "00e07025-3319-4520-b05f-9d3977d8c70c",
    title_name: "Good Grief",
    content_type: "movie",
    filmmaker_id: "f5efb45d-1578-45a8-9184-476e293b3428",
    status: "approved",
    previous_gross_amount: "3732.62",
    previous_expenses: "1572.1",
    previous_distribution_fee: "743.75",
    previous_net_revenue: "1404.78",
    previous_amount_paid: "1399.55",
    previous_balance_due: "5.23",
    created_at: "2025-09-22 23:37:19.460613+00"
  },
  {
    id: "716dc195-3329-489e-a9ed-a5e5f66cb2d6",
    title_name: "THE RED RESURRECTION",
    content_type: "movie",
    filmmaker_id: "5e8f7a32-8448-4851-91a6-a2082ffe6d1b",
    status: "approved",
    previous_gross_amount: "1844.96",
    previous_expenses: "0.06",
    previous_distribution_fee: "368.99",
    previous_net_revenue: "1475.91",
    previous_amount_paid: "1466.23",
    previous_balance_due: "9.68",
    created_at: "2025-09-23 01:50:16.800631+00"
  },
  {
    id: "4c67f4d9-b14a-47e3-9363-f3b767a59b59",
    title_name: "Mahogany Sunrise",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:09:50.217593+00"
  },
  {
    id: "39aba7a2-c563-4579-a56e-ca04ec1d7890",
    title_name: "Forgotten Kingdom: Genesis",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:09:50.456384+00"
  },
  {
    id: "3cc18fc3-2126-4437-9ab6-ed3e3f148ecc",
    title_name: "Angels of Our Better Nature",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:09:50.695906+00"
  },
  {
    id: "7d72f186-76e2-4129-b7cd-c311d0229009",
    title_name: "Before the Dark",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:09:50.927181+00"
  },
  {
    id: "81fea330-a681-4e41-9217-62672da061ca",
    title_name: "The Breakout: A Rock Opera",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:09:51.163443+00"
  },
  {
    id: "2ce855f2-7c1d-4968-9c89-e7b4f26c0f58",
    title_name: "Nowhere to Hide",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:09:51.387883+00"
  },
  {
    id: "30bf9b07-542f-4c53-9b4c-99c5bf7350cd",
    title_name: "The Colors of Emily",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:09:51.631132+00"
  },
  {
    id: "766a43c9-a5b0-4321-8f8d-f0cd8c857b91",
    title_name: "Twenty Years Later",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:09:51.859734+00"
  },
  {
    id: "9c91a68a-087d-49b7-be71-2286b9c1b527",
    title_name: "Bluff",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:10:34.994399+00"
  },
  {
    id: "ec8ff407-3b5a-4bc6-849d-ef9a266ec418",
    title_name: "Da Dealership",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:10:36.047186+00"
  },
  {
    id: "308d2f44-234d-4b35-9c5c-6d068d326b48",
    title_name: "The Sparrows: Nesting",
    content_type: "movie",
    filmmaker_id: "cbdb9366-3647-4942-9a28-4299542743e4",
    status: "approved",
    created_at: "2025-10-02 12:10:34.644384+00"
  },
  {
    id: "caaff9e4-2001-4478-8cb2-a45eafa1e421",
    title_name: "Painted Horses",
    content_type: "movie",
    filmmaker_id: "cbdb9366-3647-4942-9a28-4299542743e4",
    status: "approved",
    created_at: "2025-10-02 12:10:35.25423+00"
  },
  {
    id: "c0b5b0cd-bc69-4c8e-bfa0-e7325be318c7",
    title_name: "Finding Mr. Wright",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:30:52.626874+00"
  },
  {
    id: "fb56fdcf-fa60-409e-a52b-927bcf478a12",
    title_name: "Creepy Chronicles",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:30:53.391635+00"
  },
  {
    id: "d1f5c9a3-94cf-48be-8f2b-ab399db6d52c",
    title_name: "Cry",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:30:54.175778+00"
  },
  {
    id: "0b0cc964-3ede-4a4f-923a-ff7b98923f9e",
    title_name: "Submerge: Echo 51",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:30:55.138716+00"
  },
  {
    id: "09983994-0657-4e74-a443-1b56d4c3e823",
    title_name: "Love or War",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:30:55.374479+00"
  },
  {
    id: "51da7eb5-6046-41b9-b1e8-966588c8240b",
    title_name: "Unsigned",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:30:55.595978+00"
  },
  {
    id: "d6c980ee-bfab-4314-b91c-54a0eadf68f4",
    title_name: "The Wrestler: A Q.T. Marshall Story",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:30:55.872114+00"
  },
  {
    id: "537a856a-4688-4bc3-a22a-724348e08bb1",
    title_name: "#HatersMakeMeFamous",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:30:56.789326+00"
  },
  {
    id: "a780355d-73fe-4262-9ff1-dc0e2c0530d5",
    title_name: "Melody on Earth",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:30:57.538681+00"
  },
  {
    id: "f3e0a847-c75f-4c12-8b4c-ec87d2dabe5d",
    title_name: "Sinking Sand",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:31:45.047862+00"
  },
  {
    id: "7804d7dc-9e5b-4d92-babe-888fb71ad9d2",
    title_name: "Broken: A Musical",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:32:04.477076+00"
  },
  {
    id: "826f4ea8-39e9-4da3-91b5-9a1f885f0186",
    title_name: "Alone in the Universe",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:32:55.933897+00"
  },
  {
    id: "2ba014fb-1174-4976-a399-16c2c4159ad6",
    title_name: "The Tommy Movie",
    content_type: "movie",
    status: "approved",
    created_at: "2025-10-02 12:32:57.957673+00"
  }
];

const titleDistributionSettings = [
  {
    id: "9c03e8c4-0087-4210-99df-b7a0e21ffa53",
    title_id: "00e07025-3319-4520-b05f-9d3977d8c70c",
    distribution_fee_percentage: "20.00",
    created_at: "2025-09-23 01:20:05.582765+00"
  },
  {
    id: "1b4b6e30-11ca-4c79-93a0-f0cc24e46a07",
    title_id: "308d2f44-234d-4b35-9c5c-6d068d326b48",
    distribution_fee_percentage: "20.00",
    created_at: "2025-10-02 12:11:07.677077+00"
  },
  {
    id: "eea79cb9-da79-42ef-b46f-77fe6c6f47b3",
    title_id: "caaff9e4-2001-4478-8cb2-a45eafa1e421",
    distribution_fee_percentage: "20.00",
    created_at: "2025-10-02 12:12:48.5093+00"
  },
  {
    id: "9d6bb7d4-4fb0-4a16-a04a-15edcbc38b0b",
    title_id: "716dc195-3329-489e-a9ed-a5e5f66cb2d6",
    distribution_fee_percentage: "25.00",
    created_at: "2025-10-02 16:52:27.032683+00"
  }
];

const streamingPayments = [
  {
    id: "06a66da2-d3bb-48c3-86e0-3f5e21d2e8f4",
    title_id: "00e07025-3319-4520-b05f-9d3977d8c70c",
    filmmaker_id: "f5efb45d-1578-45a8-9184-476e293b3428",
    platform: "Filmhub",
    period_start: "2025-09-01",
    period_end: "2025-09-30",
    gross_amount: "100.15",
    expenses: "25.00",
    distribution_fee: "20.03",
    net_amount: "55.12",
    payment_date: "2025-09-23",
    status: "completed",
    created_at: "2025-09-23 02:42:08.411605+00"
  },
  {
    id: "7d6bc4f0-88fb-4f35-b27e-dc60eeb73be8",
    title_id: "00e07025-3319-4520-b05f-9d3977d8c70c",
    filmmaker_id: "f5efb45d-1578-45a8-9184-476e293b3428",
    platform: "Amazon Prime",
    period_start: "2025-08-01",
    period_end: "2025-08-31",
    gross_amount: "150.75",
    expenses: "10.50",
    distribution_fee: "30.15",
    net_amount: "110.10",
    payment_date: "2025-09-15",
    status: "completed",
    created_at: "2025-09-23 02:44:37.012445+00"
  },
  {
    id: "c43ac78a-1e6f-4d87-9c66-e98ba3a9e35a",
    title_id: "716dc195-3329-489e-a9ed-a5e5f66cb2d6",
    filmmaker_id: "5e8f7a32-8448-4851-91a6-a2082ffe6d1b",
    platform: "Tubi",
    period_start: "2025-09-01",
    period_end: "2025-09-30",
    gross_amount: "75.50",
    expenses: "5.25",
    distribution_fee: "18.88",
    net_amount: "51.37",
    payment_date: "2025-09-23",
    status: "completed",
    created_at: "2025-09-23 02:44:52.635993+00"
  }
];

const filmmakerBalances = [
  {
    id: "c0b3d7b2-5eba-4125-975e-854a9e82f2bd",
    filmmaker_id: "f5efb45d-1578-45a8-9184-476e293b3428",
    total_earned: "78.4275",
    total_paid: "0",
    available_balance: "78.4275",
    last_updated: "2025-09-23 02:42:08.411605+00"
  },
  {
    id: "76002509-b83f-4f02-8422-9a4d38aceaf4",
    filmmaker_id: "5e8f7a32-8448-4851-91a6-a2082ffe6d1b",
    total_earned: "29.2575",
    total_paid: "0",
    available_balance: "29.2575",
    last_updated: "2025-09-23 02:44:52.635993+00"
  }
];

async function importData() {
  console.log('Starting data import...\n');

  console.log('1. Importing users...');
  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .upsert(users, { onConflict: 'id' });

  if (usersError) {
    console.error('Error importing users:', usersError);
    return;
  }
  console.log(`✓ Imported ${users.length} users\n`);

  console.log('2. Importing content...');
  const { data: contentData, error: contentError } = await supabase
    .from('content')
    .upsert(content, { onConflict: 'id' });

  if (contentError) {
    console.error('Error importing content:', contentError);
    return;
  }
  console.log(`✓ Imported ${content.length} titles\n`);

  console.log('3. Importing title distribution settings...');
  const { data: settingsData, error: settingsError } = await supabase
    .from('title_distribution_settings')
    .upsert(titleDistributionSettings, { onConflict: 'id' });

  if (settingsError) {
    console.error('Error importing distribution settings:', settingsError);
    return;
  }
  console.log(`✓ Imported ${titleDistributionSettings.length} distribution settings\n`);

  console.log('4. Importing streaming payments...');
  const { data: paymentsData, error: paymentsError } = await supabase
    .from('streaming_payments')
    .upsert(streamingPayments, { onConflict: 'id' });

  if (paymentsError) {
    console.error('Error importing streaming payments:', paymentsError);
    return;
  }
  console.log(`✓ Imported ${streamingPayments.length} streaming payments\n`);

  console.log('5. Importing filmmaker balances...');
  const { data: balancesData, error: balancesError } = await supabase
    .from('filmmaker_balances')
    .upsert(filmmakerBalances, { onConflict: 'id' });

  if (balancesError) {
    console.error('Error importing filmmaker balances:', balancesError);
    return;
  }
  console.log(`✓ Imported ${filmmakerBalances.length} filmmaker balances\n`);

  console.log('✓ Data import completed successfully!');
  console.log('\nSummary:');
  console.log(`- ${users.length} users`);
  console.log(`- ${content.length} titles`);
  console.log(`- ${titleDistributionSettings.length} distribution settings`);
  console.log(`- ${streamingPayments.length} streaming payments`);
  console.log(`- ${filmmakerBalances.length} filmmaker balances`);
}

importData().catch(console.error);
