
import { getSupabaseSafe } from './client';
import {
  DEFAULT_ASSETS_DATA,
  DEFAULT_CATEGORIES_DATA,
  DEFAULT_LOCATIONS_DATA,
  DEFAULT_WIRE_COLORS,
  TABLES,
  SETTINGS_KEYS,
} from '../constants';
import bcrypt from 'bcryptjs';

// --- Data Seeding ---
export const seedDefaultData = async () => {
  const client = getSupabaseSafe();
  try {
    // --- 1. Seed Roles & Admin User ---
    let adminRoleId: string | null = null;

    // Check if Admin role exists
    const { data: existingRole } = await client.from(TABLES.ROLES).select('id').eq('name', 'Admin').maybeSingle();
    
    if (existingRole) {
        adminRoleId = existingRole.id;
    } else {
        // Create Admin Role if it doesn't exist
        console.log('Seeding Admin role...');
        const { data: newRole, error: roleError } = await client.from(TABLES.ROLES).insert({
            name: 'Admin',
            permissions: ['manage_users', 'manage_roles', 'manage_assets', 'view_reports', 'manage_settings', 'manage_phones', 'manage_cns', 'manage_tasks']
        }).select('id').single();
        
        if (!roleError && newRole) {
            adminRoleId = newRole.id;
            console.log('Admin role created successfully.');
        } else if (roleError) {
            console.error('Error creating Admin role:', JSON.stringify(roleError));
        }
    }

    // Create Admin User if role exists but user doesn't
    if (adminRoleId) {
        const { data: adminUser } = await client.from(TABLES.USERS).select('id').eq('username', 'admin').maybeSingle();
        
        if (!adminUser) {
             console.log('Seeding Admin user...');
             const salt = await bcrypt.genSalt(10);
             const hash = await bcrypt.hash('123456', salt);
             
             const { error: userError } = await client.from(TABLES.USERS).insert({
                 username: 'admin',
                 password_hash: hash,
                 full_name: 'مدیر ارشد سیستم',
                 role_id: adminRoleId,
                 is_active: true
             });
             
             if (!userError) console.log('Admin user (admin/123456) created successfully.');
             else console.error('Error creating Admin user:', JSON.stringify(userError));
        }
    }


    // --- 2. Check and Seed Categories ---
    const { count: categoryCount } = await client
      .from(TABLES.CATEGORIES)
      .select('*', { count: 'exact', head: true });
    if (categoryCount === 0) {
      const { data: insertedCategories, error: categoryError } = await client
        .from(TABLES.CATEGORIES)
        .insert(DEFAULT_CATEGORIES_DATA)
        .select();
      if (categoryError) throw categoryError;
      console.log('Default categories seeded:', insertedCategories);
    }

    // --- 3. Check and Seed Locations ---
    const { count: locationCount } = await client
      .from(TABLES.LOCATIONS)
      .select('*', { count: 'exact', head: true });
    if (locationCount === 0) {
      const { data: insertedLocations, error: locationError } = await client
        .from(TABLES.LOCATIONS)
        .insert(DEFAULT_LOCATIONS_DATA)
        .select();
      if (locationError) throw locationError;
      console.log('Default locations seeded:', insertedLocations);
    }
    
    // --- 4. Check and Seed Statuses ---
    const { count: statusCount } = await client
      .from(TABLES.ASSET_STATUSES)
      .select('*', { count: 'exact', head: true });
    if (statusCount === 0) {
        const defaultStatuses = [
            { name: 'در حال استفاده', color: 'bg-green-100 text-green-700', is_system: false },
            { name: 'نیاز به تعمیر', color: 'bg-yellow-100 text-yellow-700', is_system: false },
            { name: 'در انبار', color: 'bg-blue-100 text-blue-700', is_system: false },
            { name: 'از رده خارج', color: 'bg-red-100 text-red-700', is_system: false },
            { name: 'موجود نیست', color: 'bg-gray-100 text-gray-700', is_system: false },
            { name: 'منتقل شده', color: 'bg-purple-100 text-purple-700', is_system: true },
        ];
        const { error } = await client.from(TABLES.ASSET_STATUSES).insert(defaultStatuses);
        if (error) console.error("Error seeding statuses:", error);
    }

    // --- 5. Check and Seed Assets ---
    const { count: assetCount } = await client
      .from(TABLES.ASSETS)
      .select('*', { count: 'exact', head: true });
    if (assetCount === 0) {
      const { data: categories } = await client
        .from(TABLES.CATEGORIES)
        .select('id, name');
      const { data: locations } = await client
        .from(TABLES.LOCATIONS)
        .select('id, name');

      if (categories && locations) {
        const assetsToInsert = DEFAULT_ASSETS_DATA.map((asset) => {
          const category = categories.find((c) =>
            asset.description?.includes(c.name),
          ); // Simple matching logic
          const location = locations.find((l) =>
            asset.description?.includes(l.name),
          ); // Simple matching logic

          // Override for specific asset data from prompt
          if (asset.asset_id_number === '1001') {
            return {
              ...asset,
              category_id:
                categories.find((c) => c.name === 'ابزار برقی')?.id || null,
              location_id:
                locations.find((l) => l.name === 'انباری اصلی')?.id || null,
            };
          } else if (asset.asset_id_number === '2050') {
            return {
              ...asset,
              category_id:
                categories.find((c) => c.name === 'تجهیزات IT')?.id || null,
              location_id:
                locations.find((l) => l.name === 'بخش حسابداری')?.id || null,
            };
          } else if (asset.asset_id_number === '5003') {
            return {
              ...asset,
              category_id:
                categories.find((c) => c.name === 'ابزار دستی')?.id || null,
              location_id:
                locations.find((l) => l.name === 'کارگاه فنی')?.id || null,
            };
          }

          return {
            ...asset,
            category_id: category?.id || null,
            location_id: location?.id || null,
          };
        });

        const { data: insertedAssets, error: assetError } = await client
          .from(TABLES.ASSETS)
          .insert(assetsToInsert)
          .select();
        if (assetError) throw assetError;
        console.log('Default assets seeded:', insertedAssets);
      }
    }
    
    // --- 6. Check and Seed Settings ---
    const { data: colorsSetting } = await client
      .from(TABLES.APP_SETTINGS)
      .select('key')
      .eq('key', SETTINGS_KEYS.PHONE_WIRE_COLORS)
      .maybeSingle();

    if (!colorsSetting) {
        const { error: colorSeedError } = await client
            .from(TABLES.APP_SETTINGS)
            .insert({ key: SETTINGS_KEYS.PHONE_WIRE_COLORS, value: JSON.stringify(DEFAULT_WIRE_COLORS) });
        if (colorSeedError) throw colorSeedError;
        console.log('Default wire colors seeded.');
    }

  } catch (error: any) {
    console.error('Error seeding default data:', error.message || error);
    // Throw if it's a network error to stop the chain in Context
    if (error.message && error.message.includes('Failed to fetch')) {
        throw error;
    }
  }
};
