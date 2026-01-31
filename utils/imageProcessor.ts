/**
 * Resizes and crops an image to a square of the specified size, then converts it to WebP.
 * @param file The image file to process.
 * @param size The desired square dimension (e.g., 500 for 500x500).
 * @returns A Promise that resolves with the processed image as a Blob (WebP format).
 */
export const processImageForUpload = async (file: File, size: number = 500): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context.'));
          return;
        }

        canvas.width = size;
        canvas.height = size;

        // Calculate aspect ratio and crop parameters
        const aspectRatio = img.width / img.height;
        let sx, sy, sWidth, sHeight;

        if (img.width > img.height) {
          // Image is wider than it is tall, crop horizontally
          sHeight = img.height;
          sWidth = img.height * (size / size); // Should be img.height
          sx = (img.width - sWidth) / 2;
          sy = 0;
        } else {
          // Image is taller or square, crop vertically
          sWidth = img.width;
          sHeight = img.width * (size / size); // Should be img.width
          sx = 0;
          sy = (img.height - sHeight) / 2;
        }
        
        // Ensure sWidth and sHeight are positive
        sWidth = Math.max(1, sWidth);
        sHeight = Math.max(1, sHeight);


        // Draw the image onto the canvas, cropping and scaling
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, size, size);

        // Convert canvas content to JPEG Blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to convert canvas to Blob (JPEG).'));
            }
          },
          'image/jpeg',
          0.85, // JPEG quality (0.85 = 85%)
        );
      };
      img.onerror = (error) => reject(new Error('Failed to load image.'));
      img.src = event.target?.result as string;
    };
    reader.onerror = (error) => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
};

/**
 * Converts a Blob to a Base64 string.
 * @param blob The Blob to convert.
 * @returns A Promise that resolves with the Base64 string.
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/webp;base64,")
      resolve(base64String.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};