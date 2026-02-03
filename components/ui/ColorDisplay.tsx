import React from 'react';

interface ColorDisplayProps {
  value: string; // Hex color for single (#RRGGBB), or two hex colors joined by a pipe for dual (#RRGGBB|#RRGGBB)
  name: string;
  className?: string;
}

export const ColorDisplay: React.FC<ColorDisplayProps> = ({ value, name, className = '' }) => {
  if (!value || value.trim() === '') {
    return (
      <span
        className={`inline-block align-middle w-4 h-4 rounded-full border border-gray-400 bg-gray-200 ${className}`}
        title={name || "انتخاب نشده"}
      ></span>
    );
  }

  const colorParts = value.split('|');

  const style: React.CSSProperties = {};
  if (colorParts.length > 1) {
    style.background = `linear-gradient(to right, ${colorParts[0]} 50%, ${colorParts[1]} 50%)`;
  } else {
    style.backgroundColor = colorParts[0];
  }

  return (
    <span
      className={`inline-block align-middle w-4 h-4 rounded-full border border-gray-400 ${className}`}
      style={style}
      title={name}
    ></span>
  );
};
