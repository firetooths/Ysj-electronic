
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Asset, Category, ExportableAsset, Location, PhoneLine } from '../types';
import { getPdfFont } from './fontManager';

const getFullPathName = (
  itemId: string | undefined,
  items: Array<{ id: string; name: string; parent_id: string | null }>,
): string => {
  if (!itemId) return 'نامشخص';
  const item = items.find((i) => i.id === itemId);
  if (!item) return 'نامشخص';
  if (item.parent_id) {
    const parent = items.find((p) => p.id === item.parent_id);
    return parent ? `${parent.name} > ${item.name}` : item.name;
  }
  return item.name;
};

/**
 * Converts a list of assets to an array of exportable objects.
 * @param assets The array of Asset objects.
 * @returns An array of ExportableAsset objects.
 */
const prepareAssetsForExport = (assets: Asset[], allCategories: Category[], allLocations: Location[]): ExportableAsset[] => {
  return assets.map((asset) => ({
    'شماره اموال': asset.asset_id_number,
    'نام تجهیز': asset.name,
    'دسته بندی': getFullPathName(asset.category_id || undefined, allCategories),
    'محل قرارگیری': getFullPathName(asset.location_id || undefined, allLocations),
    'وضعیت': asset.status,
    'تایید شده': asset.is_verified ? 'بله' : 'خیر',
    'اموال تهران (خارج)': asset.is_external ? 'بله' : 'خیر',
    'توضیحات': asset.description,
    'تاریخ ایجاد': new Date(asset.created_at).toLocaleDateString('fa-IR'),
    'تاریخ آخرین بروزرسانی': new Date(asset.updated_at).toLocaleDateString('fa-IR'),
  }));
};

/**
 * Exports a list of assets to an Excel (.xlsx) file.
 * @param assets The array of Asset objects to export.
 * @param fileName The name of the output file (without extension).
 */
export const exportToExcel = (assets: Asset[], allCategories: Category[], allLocations: Location[], fileName: string = 'AssetFlow_Export') => {
  const data = prepareAssetsForExport(assets, allCategories, allLocations);
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

// Helper function to process bidirectional text for PDF output.
// It reverses the word order ONLY for strings containing a mix of RTL and LTR characters,
// as a workaround for jspdf-autotable's rendering issues.
const processBidiText = (text: string | null | undefined | number): string => {
    if (text === null || text === undefined) return '';
    const strText = String(text);

    // Regular expressions to detect RTL (Arabic/Persian) and LTR (Latin/Numeric) characters.
    const rtlRegex = /[\u0600-\u06FF]/;
    const ltrRegex = /[a-zA-Z0-9]/;

    const hasRtl = rtlRegex.test(strText);
    const hasLtr = ltrRegex.test(strText);

    // Apply the reversal workaround only if the string is mixed-directional.
    // For pure RTL or pure LTR strings, we trust the font/renderer to handle it correctly.
    if (hasRtl && hasLtr) {
        return strText.split(' ').reverse().join(' ');
    }
    
    return strText;
};


/**
 * Exports a list of assets to a PDF file with custom font support.
 * @param assets The array of Asset objects to export.
 * @param fileName The name of the output file (without extension).
 */
export const exportToPDF = async (assets: Asset[], allCategories: Category[], allLocations: Location[], fileName: string = 'AssetFlow_Export') => {
  const data = prepareAssetsForExport(assets, allCategories, allLocations);

  if (data.length === 0) {
    alert('No data to export.');
    return;
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Process headers and rows for bidi text
  const headers = Object.keys(data[0]).map(h => processBidiText(h));
  // FIX: Cast Object.values(obj) as (string|number) to satisfy processBidiText type requirement.
  const rows = data.map(obj => Object.values(obj).map(val => processBidiText(val as any)));


  const customFont = await getPdfFont();
  let fontName = 'helvetica'; // Default PDF font

  // If a custom font is selected in settings, load and apply it
  if (customFont) {
    try {
      fontName = customFont.name;
      // The font file needs to be added to the virtual file system of jsPDF
      doc.addFileToVFS(`${fontName}.ttf`, customFont.base64);
      // Add the font to the document
      doc.addFont(`${fontName}.ttf`, fontName, 'normal');
      // Set the font for the document
      doc.setFont(fontName);
    } catch (e) {
      console.error("Failed to load custom PDF font, falling back to default.", e);
      fontName = 'helvetica'; // Fallback on error
    }
  }

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 10,
    theme: 'grid',
    styles: {
      font: fontName, // Use the selected or default font
      fontSize: 8,
      cellPadding: 2,
      halign: 'right',
      fontStyle: 'normal',
      cellWidth: 'wrap'
    },
    headStyles: {
      fillColor: [54, 162, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  });

  doc.save(`${fileName}.pdf`);
};

/**
 * Converts a list of phone lines to an array of exportable objects for Excel.
 * @param lines The array of PhoneLine objects.
 * @returns An array of objects with Persian headers.
 */
const preparePhoneLinesForExport = (lines: PhoneLine[]): any[] => {
  return lines.map(line => ({
    'شماره تلفن': line.phone_number,
    'مصرف کننده/واحد': line.consumer_unit || '',
    'تگ‌ها': line.tags?.map(t => t.name).join(', ') || '',
  }));
};

/**
 * Exports a list of phone lines to an Excel (.xlsx) file.
 * @param lines The array of PhoneLine objects to export.
 * @param fileName The name of the output file (without extension).
 */
export const exportPhoneLinesToExcel = (lines: PhoneLine[], fileName: string = 'PhoneLines_Export') => {
  const data = preparePhoneLinesForExport(lines);
  const worksheet = XLSX.utils.json_to_sheet(data, {
    header: ['شماره تلفن', 'مصرف کننده/واحد', 'تگ‌ها'],
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Phone Lines');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};
