import { CustomFont } from '../types';
import { getSetting, setSetting } from '../supabaseService';
import { SETTINGS_KEYS } from '../constants';

const STYLE_ELEMENT_ID = 'custom-fonts-style';
const DEFAULT_SYSTEM_FONT = 'sans-serif';
const SYSTEM_FONT_FALLBACK_NAME = 'System Default'; // A non-CSS name for UI/DB

// --- Helper Functions ---

const getStyleElement = (): HTMLStyleElement => {
  let styleEl = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ELEMENT_ID;
    document.head.appendChild(styleEl);
  }
  return styleEl;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // remove "data:font/ttf;base64," prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

const updateInjectedFontFaces = (fonts: CustomFont[]) => {
  const styleEl = getStyleElement();
  const fontFaceRules = fonts
    .map(
      (font) => `
    @font-face {
      font-family: "${font.name}";
      src: url(data:font/ttf;base64,${font.base64}) format('truetype');
    }
  `,
    )
    .join('\n');
  styleEl.innerHTML = fontFaceRules;
};

// --- Public API ---

/**
 * Gets the list of all custom fonts from Supabase settings.
 */
export const getSavedFonts = async (): Promise<CustomFont[]> => {
  try {
    const fontsJson = await getSetting(SETTINGS_KEYS.FONTS);
    return JSON.parse(fontsJson || '[]');
  } catch (e: any) {
    console.error('Failed to parse fonts from settings:', e.message);
    return [];
  }
};

/**
 * Saves the list of fonts to Supabase settings.
 */
const saveFonts = async (fonts: CustomFont[]) => {
  await setSetting(SETTINGS_KEYS.FONTS, JSON.stringify(fonts));
  updateInjectedFontFaces(fonts);
};

/**
 * Adds a new font to the system.
 * @param name The display name for the font.
 * @param file The .ttf font file.
 */
export const addFont = async (name: string, file: File): Promise<void> => {
  if (!name.trim()) throw new Error('نام فونت نمی‌تواند خالی باشد.');
  const fonts = await getSavedFonts();
  if (fonts.some((font) => font.name.toLowerCase() === name.trim().toLowerCase())) {
    throw new Error('فونت با این نام از قبل موجود است.');
  }

  const base64 = await fileToBase64(file);
  const newFont: CustomFont = {
    id: Date.now().toString(),
    name: name.trim(),
    base64,
  };
  await saveFonts([...fonts, newFont]);
};

/**
 * Removes a font from the system by its ID.
 */
export const removeFont = async (id: string) => {
  let fonts = await getSavedFonts();
  const fontToRemove = fonts.find(f => f.id === id);
  if (!fontToRemove) return;

  const currentAppFontName = await getAppFontName();
  const currentPdfFont = await getPdfFont();

  if (currentAppFontName === fontToRemove.name) {
    await setAppFont(SYSTEM_FONT_FALLBACK_NAME); // Revert to default
  }
  if (currentPdfFont?.id === id) {
    await setPdfFont(''); // Revert to default (empty string for no selection)
  }

  fonts = fonts.filter((font) => font.id !== id);
  await saveFonts(fonts);
};

// --- App Font Settings ---

/**
 * Gets the selected application font name from Supabase.
 */
export const getAppFontName = async (): Promise<string> => {
  const fontName = await getSetting(SETTINGS_KEYS.APP_FONT);
  return fontName || SYSTEM_FONT_FALLBACK_NAME;
};

/**
 * Applies the selected font to the document body.
 */
export const applyAppFont = (fontName: string) => {
  const fontFamily = fontName === SYSTEM_FONT_FALLBACK_NAME
    ? DEFAULT_SYSTEM_FONT
    : `"${fontName}", ${DEFAULT_SYSTEM_FONT}`;
  document.body.style.fontFamily = fontFamily;
};

/**
 * Sets and applies the application font, saving to Supabase.
 */
export const setAppFont = async (fontName: string) => {
  await setSetting(SETTINGS_KEYS.APP_FONT, fontName);
  applyAppFont(fontName);
};

// --- PDF Font Settings ---

/**
 * Gets the full CustomFont object for the selected PDF font from Supabase.
 */
export const getPdfFont = async (): Promise<CustomFont | null> => {
  const fonts = await getSavedFonts();
  const fontId = await getSetting(SETTINGS_KEYS.PDF_FONT);

  if (!fontId) {
    return null; // No default font, return null if nothing is selected.
  }
  return fonts.find((font) => font.id === fontId) || null;
};

/**
 * Sets the PDF font by its ID in Supabase.
 */
export const setPdfFont = async (fontId: string) => {
  await setSetting(SETTINGS_KEYS.PDF_FONT, fontId || '');
};

/**
 * Initializes the font system on app startup from Supabase.
 * Loads custom fonts and applies the selected application font.
 */
export const initFonts = async () => {
  try {
    const fonts = await getSavedFonts();
    // If fonts exist, inject them into a style tag.
    if (fonts.length > 0) {
      updateInjectedFontFaces(fonts);
    }
    
    // Get the saved app font name (or the fallback) and apply it.
    const appFontName = await getAppFontName();
    applyAppFont(appFontName);
  } catch (error: any) {
    console.error("Could not initialize fonts:", error.message);
    // Fallback to system font if there's any error during initialization.
    applyAppFont(SYSTEM_FONT_FALLBACK_NAME);
  }
};
