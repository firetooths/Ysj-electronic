import { getSupabaseSafe } from './client';
import { STORAGE_BUCKETS } from '../constants';

// --- API Functions for Image Storage ---
export const uploadImage = async (
  file: File,
  assetId: string,
  imageName: string,
): Promise<string> => {
  const client = getSupabaseSafe();
  const filePath = `${assetId}/${Date.now()}_${imageName}`;
  const { data, error } = await client.storage
    .from(STORAGE_BUCKETS.ASSET_IMAGES)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/webp', // Ensure it's WebP
    });

  if (error) {
    console.error('Error uploading image:', error.message);
    throw error;
  }

  const { data: publicUrlData } = client.storage
    .from(STORAGE_BUCKETS.ASSET_IMAGES)
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
};

export const deleteImage = async (imageUrl: string): Promise<void> => {
  const client = getSupabaseSafe();
  const pathSegments = imageUrl.split(STORAGE_BUCKETS.ASSET_IMAGES + '/');
  if (pathSegments.length < 2) {
    console.warn('Invalid image URL for deletion:', imageUrl);
    return;
  }
  const filePath = pathSegments[1];

  const { error } = await client.storage
    .from(STORAGE_BUCKETS.ASSET_IMAGES)
    .remove([filePath]);

  if (error) {
    console.error('Error deleting image:', error.message);
    throw error;
  }
};

export const deleteImages = async (imageUrls: string[]): Promise<void> => {
  const client = getSupabaseSafe();
  const filePaths = imageUrls.map((url) => {
    const pathSegments = url.split(STORAGE_BUCKETS.ASSET_IMAGES + '/');
    return pathSegments.length > 1 ? pathSegments[1] : null;
  }).filter(path => path !== null) as string[];

  if (filePaths.length === 0) return;

  const { error } = await client.storage
    .from(STORAGE_BUCKETS.ASSET_IMAGES)
    .remove(filePaths);

  if (error) {
    console.error('Error deleting multiple images:', error.message);
    throw error;
  }
};
