
export const persianToEnglishColor = (persianColor: string): string => {
  const colorMap: { [key: string]: string } = {
    'سفید': 'white',
    'قرمز': 'red',
    'مشکی': 'black',
    'زرد': 'yellow',
    'بنفش': 'purple',
    'آبی': 'blue',
    'سبز': 'green',
    'نارنجی': 'orange',
    'قهوه ای': 'saddlebrown',
    'طوسی': 'gray',
  };
  return colorMap[persianColor.trim()] || 'transparent';
};
