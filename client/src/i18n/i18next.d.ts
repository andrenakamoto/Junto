import 'i18next';
import fr from './fr';

// Clés de traduction vérifiées par TypeScript (source : le français)
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof fr };
    returnNull: false;
  }
}
