
import { CustomFont } from '../types';

let cachedIranSansBase64: string | null = null;

export const getPdfFont = async (): Promise<CustomFont | null> => {
    if (cachedIranSansBase64) {
        return { id: 'iransans', name: 'IranSans', base64: cachedIranSansBase64 };
    }

    try {
        // Look for font at root
        const response = await fetch('/IranSans.ttf');
        
        if (!response.ok) {
            console.warn('Failed to fetch IranSans.ttf from root. Trying legacy path...');
            const legacyRes = await fetch('/utils/IranSans.ttf');
            if (!legacyRes.ok) return null;
            return processResponse(legacyRes);
        }

        return processResponse(response);
    } catch (e) {
        console.error("Error loading IranSans for PDF:", e);
        return null;
    }
};

const processResponse = async (response: Response): Promise<CustomFont | null> => {
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            cachedIranSansBase64 = base64;
            resolve({ id: 'iransans', name: 'IranSans', base64 });
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(blob);
    });
};

export const initFonts = async () => {
    console.log("Fonts managed via HTML/CSS.");
};

export const getSavedFonts = async () => [];
export const addFont = async () => {};
export const removeFont = async () => {};
export const getAppFontName = async () => 'IranSans';
export const setAppFont = async () => {};
export const setPdfFont = async () => {};
