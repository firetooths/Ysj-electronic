
import React, { useState, useRef, useEffect } from 'react';
import { 
    toJalali, 
    toGregorian, 
    JALALI_MONTH_NAMES, 
    JALALI_WEEK_DAYS, 
    formatGregorianToJalali,
    jalaliMonthLength
} from '../../utils/dateUtils';

interface Props {
    value: string; // ISO format (YYYY-MM-DD)
    onChange: (isoDate: string) => void;
    placeholder?: string;
    fullWidth?: boolean;
}

export const JalaliDatePicker: React.FC<Props> = ({ value, onChange, placeholder, fullWidth }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(() => {
        let d;
        if (value) {
            const parts = value.split('-').map(Number);
            // Construct date using local time parts to avoid timezone shifts on view
            d = new Date(parts[0], parts[1] - 1, parts[2]);
        } else {
            d = new Date();
        }
        const [y, m] = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        return { year: y, month: m };
    });
    
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && value) {
            const parts = value.split('-').map(Number);
            const [jy, jm] = toJalali(parts[0], parts[1], parts[2]);
            setViewDate({ year: jy, month: jm });
        }
    }, [isOpen, value]);

    const jalaliValue = value ? formatGregorianToJalali(value) : '';

    const getFirstDayOfWeek = (y: number, m: number) => {
        // Find 1st day of Jalali month in Gregorian
        const [gy, gm, gd] = toGregorian(y, m, 1);
        const day = new Date(gy, gm - 1, gd).getDay(); // 0=Sun, 1=Mon...
        // Mapping: Sat=0, Sun=1, Mon=2, Tue=3, Wed=4, Thu=5, Fri=6 for UI grid
        // JS getDay(): Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
        // Our Grid: Sat(0), Sun(1), Mon(2), Tue(3), Wed(4), Thu(5), Fri(6)
        
        // Transform JS day to our grid day:
        // Sun(0) -> 1
        // Mon(1) -> 2
        // ...
        // Fri(5) -> 6
        // Sat(6) -> 0
        return (day + 1) % 7; 
    };

    const days = [];
    const daysInMonth = jalaliMonthLength(viewDate.year, viewDate.month);
    const firstDay = getFirstDayOfWeek(viewDate.year, viewDate.month);

    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const handleSelect = (day: number) => {
        const [gy, gm, gd] = toGregorian(viewDate.year, viewDate.month, day);
        // Format to YYYY-MM-DD ISO
        const iso = `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
        onChange(iso);
        setIsOpen(false);
    };

    const changeMonth = (offset: number) => {
        let newMonth = viewDate.month + offset;
        let newYear = viewDate.year;
        if (newMonth > 12) { newMonth = 1; newYear++; }
        if (newMonth < 1) { newMonth = 12; newYear--; }
        setViewDate({ year: newYear, month: newMonth });
    };

    const goToToday = () => {
        const now = new Date();
        // Use local year, month, day to avoid UTC conversion issues
        const gy = now.getFullYear();
        const gm = now.getMonth() + 1;
        const gd = now.getDate();
        const iso = `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
        onChange(iso);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${fullWidth ? 'w-full' : 'w-64'}`} ref={containerRef}>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white cursor-pointer hover:border-indigo-500 transition-all shadow-sm group"
            >
                <span className={`${jalaliValue ? 'text-gray-900 font-bold' : 'text-gray-400 text-sm'} font-mono`}>
                    {jalaliValue || placeholder || 'انتخاب تاریخ...'}
                </span>
                <i className="fas fa-calendar-alt text-gray-400 group-hover:text-indigo-500 transition-colors"></i>
            </div>

            {isOpen && (
                <div className="absolute z-50 mt-2 p-4 bg-white border border-gray-200 rounded-xl shadow-2xl w-72 animate-fade-in right-0">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                        <button type="button" onClick={() => changeMonth(1)} className="p-1.5 hover:bg-gray-100 rounded-full text-indigo-600 transition-colors">
                            <i className="fas fa-chevron-right"></i>
                        </button>
                        <div className="font-bold text-gray-800 text-sm">
                            {JALALI_MONTH_NAMES[viewDate.month - 1]} {viewDate.year}
                        </div>
                        <button type="button" onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-gray-100 rounded-full text-indigo-600 transition-colors">
                            <i className="fas fa-chevron-left"></i>
                        </button>
                    </div>

                    <div className="grid grid-cols-7 mb-2">
                        {JALALI_WEEK_DAYS.map(w => (
                            <div key={w} className={`text-center text-[10px] font-bold py-1 ${w === 'ج' ? 'text-red-500' : 'text-gray-400'}`}>{w}</div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {days.map((d, i) => (
                            <div key={i} className="aspect-square flex items-center justify-center">
                                {d ? (
                                    <button
                                        type="button"
                                        onClick={() => handleSelect(d)}
                                        className={`w-full h-full rounded-lg text-xs transition-all flex items-center justify-center
                                            ${jalaliValue === `${viewDate.year}/${String(viewDate.month).padStart(2, '0')}/${String(d).padStart(2, '0')}` 
                                                ? 'bg-indigo-600 text-white font-bold shadow-md scale-105' 
                                                : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 hover:font-bold'}`}
                                    >
                                        {d}
                                    </button>
                                ) : null}
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-4 pt-2 border-t text-center">
                        <button 
                            type="button" 
                            onClick={goToToday}
                            className="text-xs text-indigo-600 font-bold hover:underline py-1 px-3 rounded hover:bg-indigo-50 transition-colors"
                        >
                            برو به امروز
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
