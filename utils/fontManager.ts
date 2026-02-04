
import { CustomFont } from '../types';

let cachedIranSansBase64: string | null = null;

// --- Helper Functions ---

/**
 * Loads the static IranSans font file from the public utils folder and converts it to Base64.
 * This is used for embedding the font into generated PDFs.
 */
export const getPdfFont = async (): Promise<CustomFont | null> => {
    if (cachedIranSansBase64) {
        return { id: 'iransans', name: 'IranSans', base64: cachedIranSansBase64 };
    }

    try {
        // Attempt to fetch the file from the public directory
        // Assuming the build process or server serves /utils/IranSans.ttf
        const response = await fetch('/utils/IranSans.ttf');
        
        if (!response.ok) {
            console.warn('Failed to fetch IranSans.ttf from /utils/. Using fallback if available.');
            return null;
        }

        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                // reader.result is like "data:font/ttf;base64,....."
                const result = reader.result as string;
                const base64 = result.split(',')[1];
                cachedIranSansBase64 = base64;
                resolve({ id: 'iransans', name: 'IranSans', base64 });
            };
            reader.onerror = (e) => {
                console.error("Error reading font blob", e);
                reject(e);
            };
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Error loading IranSans for PDF:", e);
        return null;
    }
};

/**
 * Legacy initialization - now empty as font is handled via CSS in index.html
 */
export const initFonts = async () => {
    // No dynamic font loading needed. CSS handles IranSans globally.
    console.log("Fonts initialized via CSS.");
};

// Deprecated functions kept to prevent import errors in other files if any remain,
// though SettingsPage was the main consumer and has been updated.
export const getSavedFonts = async () => [];
export const addFont = async () => {};
export const removeFont = async () => {};
export const getAppFontName = async () => 'IranSans';
export const setAppFont = async () => {};
export const setPdfFont = async () => {};
