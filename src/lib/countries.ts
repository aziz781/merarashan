export interface Country {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  placeholder: string;
  maxLength: number;
}

export const COUNTRIES: Country[] = [
  { code: "PK", name: "Pakistan", dialCode: "92", flag: "🇵🇰", placeholder: "3030812222", maxLength: 10 },
  { code: "IN", name: "India", dialCode: "91", flag: "🇮🇳", placeholder: "9876543210", maxLength: 10 },
  { code: "GB", name: "United Kingdom", dialCode: "44", flag: "🇬🇧", placeholder: "7700900000", maxLength: 10 },
  { code: "US", name: "United States", dialCode: "1", flag: "🇺🇸", placeholder: "2015550123", maxLength: 10 },
  { code: "CA", name: "Canada", dialCode: "1", flag: "🇨🇦", placeholder: "4165550123", maxLength: 10 },
  { code: "AE", name: "United Arab Emirates", dialCode: "971", flag: "🇦🇪", placeholder: "501234567", maxLength: 9 },
  { code: "SA", name: "Saudi Arabia", dialCode: "966", flag: "🇸🇦", placeholder: "501234567", maxLength: 9 },
  { code: "QA", name: "Qatar", dialCode: "974", flag: "🇶🇦", placeholder: "31234567", maxLength: 8 },
  { code: "OM", name: "Oman", dialCode: "968", flag: "🇴🇲", placeholder: "90123456", maxLength: 8 },
  { code: "KW", name: "Kuwait", dialCode: "965", flag: "🇰🇼", placeholder: "50123456", maxLength: 8 },
  { code: "BH", name: "Bahrain", dialCode: "973", flag: "🇧🇭", placeholder: "35123456", maxLength: 8 },
];

const TIMEZONE_COUNTRY_MAP: Record<string, string> = {
  "Asia/Karachi": "PK",
  "Asia/Kolkata": "IN",
  "Asia/Dubai": "AE",
  "Asia/Riyadh": "SA",
  "Asia/Doha": "QA",
  "Asia/Muscat": "OM",
  "Asia/Kuwait": "KW",
  "Asia/Bahrain": "BH",
  "Europe/London": "GB",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
};

const LANGUAGE_COUNTRY_MAP: Record<string, string> = {
  "en-PK": "PK",
  "ur-PK": "PK",
  "pa-PK": "PK",
  "sd-PK": "PK",
  "en-IN": "IN",
  "hi-IN": "IN",
  "bn-IN": "IN",
  "ta-IN": "IN",
  "en-GB": "GB",
  "en-US": "US",
  "en-CA": "CA",
  "ar-AE": "AE",
  "ar-SA": "SA",
  "ar-QA": "QA",
  "ar-OM": "OM",
  "ar-KW": "KW",
  "ar-BH": "BH",
};

export function detectCountry(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tzCountry = TIMEZONE_COUNTRY_MAP[timezone];
    if (tzCountry) return tzCountry;
  } catch { /* ignore */ }

  try {
    const language = navigator.language;
    const langCountry = LANGUAGE_COUNTRY_MAP[language];
    if (langCountry) return langCountry;

    // Fallback: map language-only codes to likely countries
    const langPrefix = language.split("-")[0];
    if (langPrefix === "ur" || langPrefix === "sd") return "PK";
    if (langPrefix === "hi" || langPrefix === "bn" || langPrefix === "ta") return "IN";
    if (langPrefix === "ar") return "AE";
  } catch { /* ignore */ }

  return "PK";
}

export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export function formatLocalNumber(input: string, maxLength: number): string {
  return input.replace(/\D/g, "").slice(0, maxLength);
}

export function buildFullNumber(dialCode: string, localNumber: string): string {
  return dialCode + localNumber.replace(/\D/g, "");
}
