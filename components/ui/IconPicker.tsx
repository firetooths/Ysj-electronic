import React from 'react';

const ICONS = [
  // General & Office
  { name: 'جعبه', class: 'fas fa-box' },
  { name: 'بایگانی', class: 'fas fa-archive' },
  { name: 'برچسب', class: 'fas fa-tag' },
  { name: 'صندلی', class: 'fas fa-chair' },
  { name: 'مبلمان', class: 'fas fa-couch' },
  { name: 'میز', class: 'fas fa-table-cells' },
  { name: 'کتاب', class: 'fas fa-book' },
  { name: 'ساختمان', class: 'fas fa-building' },
  { name: 'انبار', class: 'fas fa-warehouse' },
  { name: 'کلید', class: 'fas fa-key' },
  { name: 'چاپگر', class: 'fas fa-print' },
  { name: 'لوازم اداری', class: 'fas fa-briefcase' },
  { name: 'سند', class: 'fas fa-file-alt' },
  { name: 'پوشه', class: 'fas fa-folder' },
  { name: 'تخته سفید', class: 'fas fa-chalkboard' },
  { name: 'ماشین حساب', class: 'fas fa-calculator' },
  { name: 'قیچی', class: 'fas fa-cut' },

  // IT, Network, Electrical
  { name: 'لپتاپ', class: 'fas fa-laptop' },
  { name: 'کامپیوتر', class: 'fas fa-desktop' },
  { name: 'سرور', class: 'fas fa-server' },
  { name: 'شبکه', class: 'fas fa-network-wired' },
  { name: 'روتر', class: 'fas fa-ethernet' },
  { name: 'وای فای', class: 'fas fa-wifi' },
  { name: 'هارد دیسک', class: 'fas fa-hdd' },
  { name: 'حافظه', class: 'fas fa-memory' },
  { name: 'میکروچیپ', class: 'fas fa-microchip' },
  { name: 'موبایل', class: 'fas fa-mobile-alt' },
  { name: 'تبلت', class: 'fas fa-tablet-alt' },
  { name: 'برق', class: 'fas fa-bolt' },
  { name: 'پریز', class: 'fas fa-plug' },
  { name: 'باتری', class: 'fas fa-car-battery' },
  { name: 'دوربین مداربسته', class: 'fas fa-video' },
  { name: 'ماوس', class: 'fas fa-mouse' },
  { name: 'صفحه کلید', class: 'fas fa-keyboard' },
  { name: 'ارائه', class: 'fas fa-person-chalkboard' },
  { name: 'کابل', class: 'fas fa-plug-circle-bolt' },
  { name: 'رک شبکه', class: 'fas fa-layer-group' },

  // Tools & Equipment
  { name: 'ابزار', class: 'fas fa-tools' },
  { name: 'آچار', class: 'fas fa-wrench' },
  { name: 'پیچ گوشتی', class: 'fas fa-screwdriver' },
  { name: 'چکش', class: 'fas fa-hammer' },
  { name: 'جعبه ابزار', class: 'fas fa-toolbox' },
  { name: 'اره', class: 'fas fa-saw' },
  { name: 'دریل', class: 'fas fa-screwdriver-wrench' },
  { name: 'دوربین', class: 'fas fa-camera-retro' },
  { name: 'ایمنی', class: 'fas fa-hard-hat' },
  { name: 'آتش نشانی', class: 'fas fa-fire-extinguisher' },
  { name: 'آزمایشگاه', class: 'fas fa-flask' },
  { name: 'پزشکی', class: 'fas fa-medkit' },
  { name: 'نردبان', class: 'fas fa-stairs' },

  // Vehicles & Transport
  { name: 'خودرو', class: 'fas fa-car' },
  { name: 'کامیون', class: 'fas fa-truck' },
  { name: 'هواپیما', class: 'fas fa-plane' },
  { name: 'پهپاد', class: 'fas fa-helicopter' },
  { name: 'دوچرخه', class: 'fas fa-bicycle' },
  { name: 'موتورسیکلت', class: 'fas fa-motorcycle' },
  { name: 'اتوبوس', class: 'fas fa-bus' },
  
  // Misc
  { name: 'متفرقه', class: 'fas fa-asterisk' },
  { name: 'تهویه', class: 'fas fa-fan' },
  { name: 'گیاه', class: 'fas fa-leaf' },
  { name: 'قفل', class: 'fas fa-lock' },
];

interface IconPickerProps {
    value: string;
    onSelect: (iconClass: string) => void;
}

export const IconPicker: React.FC<IconPickerProps> = ({ value, onSelect }) => {
    return (
        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-2 border rounded-md max-h-48 overflow-y-auto custom-scrollbar">
            {ICONS.map((icon) => (
                <button
                    key={icon.class}
                    type="button"
                    onClick={() => onSelect(icon.class)}
                    className={`p-2 rounded-md transition-colors aspect-square flex items-center justify-center text-xl ${value === icon.class ? 'bg-indigo-100 ring-2 ring-indigo-500' : 'hover:bg-gray-100'}`}
                    title={icon.name}
                >
                    <i className={`${icon.class} text-gray-700`}></i>
                </button>
            ))}
        </div>
    );
};