
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yasouj.airport.assets',
  appName: 'مدیریت اموال فرودگاه یاسوج',
  webDir: 'dist', // اگر از Vite استفاده میکنید dist و اگر از CRA استفاده میکنید build بگذارید
  server: {
    androidScheme: 'https'
  },
  plugins: {
    // تنظیمات پلاگین‌ها در صورت نیاز اینجا قرار می‌گیرد
  }
};

export default config;
