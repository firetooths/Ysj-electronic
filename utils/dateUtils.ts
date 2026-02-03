
/**
 * توابع تبدیل تاریخ شمسی و میلادی
 * استفاده از کتابخانه استاندارد jalaali-js برای تضمین صحت محاسبات
 */
import { toJalaali, toGregorian as toGregorianLib, jalaaliMonthLength as jML, isLeapJalaaliYear as isLeap } from 'jalaali-js';

export const JALALI_MONTH_NAMES = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export const JALALI_WEEK_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

/**
 * تبدیل میلادی به شمسی
 * @returns [jy, jm, jd]
 */
export function toJalali(gy: number, gm: number, gd: number) {
    const { jy, jm, jd } = toJalaali(gy, gm, gd);
    return [jy, jm, jd];
}

/**
 * تبدیل شمسی به میلادی
 * @returns [gy, gm, gd]
 */
export function toGregorian(jy: number, jm: number, jd: number) {
    const { gy, gm, gd } = toGregorianLib(jy, jm, jd);
    return [gy, gm, gd];
}

/**
 * بررسی کبیسه بودن سال جلالی
 */
export function isLeapJalaliYear(jy: number) {
    return isLeap(jy);
}

/**
 * تعداد روزهای ماه جلالی
 */
export function jalaliMonthLength(jy: number, jm: number) {
    return jML(jy, jm);
}

/**
 * دریافت تاریخ شمسی امروز به صورت رشته YYYY/MM/DD
 */
export function getTodayJalali() {
    const now = new Date();
    const [y, m, d] = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
}

/**
 * تبدیل رشته تاریخ میلادی (ISO YYYY-MM-DD) به رشته شمسی (YYYY/MM/DD)
 * این تابع برای جلوگیری از تغییر منطقه زمانی، رشته را مستقیما پارس می‌کند
 */
export function formatGregorianToJalali(dateStr: string) {
    if (!dateStr) return '';
    try {
        let gy, gm, gd;
        // اگر فرمت YYYY-MM-DD باشد، دستی پارس می‌کنیم تا درگیر Timezone نشویم
        const parts = dateStr.split('T')[0].split('-');
        if (parts.length === 3) {
            gy = parseInt(parts[0], 10);
            gm = parseInt(parts[1], 10);
            gd = parseInt(parts[2], 10);
        } else {
            // فال‌بک به آبجکت تاریخ
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            gy = d.getFullYear();
            gm = d.getMonth() + 1;
            gd = d.getDate();
        }
        
        const [jy, jm, jd] = toJalali(gy, gm, gd);
        return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
    } catch (e) {
        console.error("Error formatting date:", e);
        return dateStr;
    }
}
