import React from 'react';

interface TagProps {
  name: string;
  color?: string | null;
}

export const Tag: React.FC<TagProps> = ({ name, color }) => {
  const bgColor = color || '#6c757d'; // default gray

  const isLightColor = (hex: string) => {
    try {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return (r * 0.299 + g * 0.587 + b * 0.114) > 186;
    } catch (e) {
        return true; // Default to light if color is invalid
    }
  };
  const textColor = isLightColor(bgColor) ? 'text-black' : 'text-white';

  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${textColor}`}
      style={{ backgroundColor: bgColor }}
    >
      {name}
    </span>
  );
};
