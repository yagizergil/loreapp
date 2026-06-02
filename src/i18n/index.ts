import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './locales/en';
import tr from './locales/tr';

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'tr';
const supportedLngs = ['tr', 'en'];
const lng = supportedLngs.includes(deviceLocale) ? deviceLocale : 'tr';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
    },
    lng,
    fallbackLng: 'tr',
    supportedLngs,
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

export default i18n;
