import { useLanguage } from '../i18n';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-1 text-sm">
      <button
        className={`px-2 py-1 rounded transition-colors ${
          language === 'en' 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
        }`}
        onClick={() => setLanguage('en')}
        title="English"
      >
        EN
      </button>
      <button
        className={`px-2 py-1 rounded transition-colors ${
          language === 'he' 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
        }`}
        onClick={() => setLanguage('he')}
        title="עברית"
      >
        עב
      </button>
    </div>
  );
}

