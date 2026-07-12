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
  { code: "US", name: "United States", dialCode: "1", flag: "🇺🇸", placeholder: "2015550123", maxLength: 10 },
  { code: "CA", name: "Canada", dialCode: "1", flag: "🇨🇦", placeholder: "4165550123", maxLength: 10 },
  { code: "AE", name: "United Arab Emirates", dialCode: "971", flag: "🇦🇪", placeholder: "501234567", maxLength: 9 },
  { code: "GB", name: "United Kingdom", dialCode: "44", flag: "🇬🇧", placeholder: "7700900000", maxLength: 10 },
  { code: "IE", name: "Ireland", dialCode: "353", flag: "🇮🇪", placeholder: "850123456", maxLength: 9 },
  { code: "SA", name: "Saudi Arabia", dialCode: "966", flag: "🇸🇦", placeholder: "501234567", maxLength: 9 },
  { code: "QA", name: "Qatar", dialCode: "974", flag: "🇶🇦", placeholder: "31234567", maxLength: 8 },
  { code: "OM", name: "Oman", dialCode: "968", flag: "🇴🇲", placeholder: "90123456", maxLength: 8 },
  { code: "KW", name: "Kuwait", dialCode: "965", flag: "🇰🇼", placeholder: "50123456", maxLength: 8 },
  { code: "BH", name: "Bahrain", dialCode: "973", flag: "🇧🇭", placeholder: "35123456", maxLength: 8 },
  { code: "AT", name: "Austria", dialCode: "43", flag: "🇦🇹", placeholder: "650123456", maxLength: 9 },
  { code: "AU", name: "Australia", dialCode: "61", flag: "🇦🇺", placeholder: "412345678", maxLength: 9 },
  { code: "NZ", name: "New Zealand", dialCode: "64", flag: "🇳🇿", placeholder: "211234567", maxLength: 9 },
  { code: "DE", name: "Germany", dialCode: "49", flag: "🇩🇪", placeholder: "1511234567", maxLength: 10 },
  { code: "FR", name: "France", dialCode: "33", flag: "🇫🇷", placeholder: "612345678", maxLength: 9 },
  { code: "IT", name: "Italy", dialCode: "39", flag: "🇮🇹", placeholder: "3123456789", maxLength: 10 },
  { code: "ES", name: "Spain", dialCode: "34", flag: "🇪🇸", placeholder: "612345678", maxLength: 9 },
  { code: "NL", name: "Netherlands", dialCode: "31", flag: "🇳🇱", placeholder: "612345678", maxLength: 9 },
  { code: "BE", name: "Belgium", dialCode: "32", flag: "🇧🇪", placeholder: "491234567", maxLength: 9 },
  { code: "SE", name: "Sweden", dialCode: "46", flag: "🇸🇪", placeholder: "701234567", maxLength: 9 },
  { code: "NO", name: "Norway", dialCode: "47", flag: "🇳🇴", placeholder: "91234567", maxLength: 8 },
  { code: "DK", name: "Denmark", dialCode: "45", flag: "🇩🇰", placeholder: "20123456", maxLength: 8 },
  { code: "FI", name: "Finland", dialCode: "358", flag: "🇫🇮", placeholder: "401234567", maxLength: 9 },
  { code: "CH", name: "Switzerland", dialCode: "41", flag: "🇨🇭", placeholder: "781234567", maxLength: 9 },
  { code: "PL", name: "Poland", dialCode: "48", flag: "🇵🇱", placeholder: "512345678", maxLength: 9 },
  { code: "PT", name: "Portugal", dialCode: "351", flag: "🇵🇹", placeholder: "912345678", maxLength: 9 },
  { code: "GR", name: "Greece", dialCode: "30", flag: "🇬🇷", placeholder: "6912345678", maxLength: 10 },
  { code: "TR", name: "Turkey", dialCode: "90", flag: "🇹🇷", placeholder: "5321234567", maxLength: 10 },
  { code: "JP", name: "Japan", dialCode: "81", flag: "🇯🇵", placeholder: "8012345678", maxLength: 10 },
  { code: "CN", name: "China", dialCode: "86", flag: "🇨🇳", placeholder: "13800138000", maxLength: 11 },
];

const TIMEZONE_COUNTRY_MAP: Record<string, string> = {
  "Asia/Karachi": "PK",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "Asia/Dubai": "AE",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Asia/Riyadh": "SA",
  "Asia/Qatar": "QA",
  "Asia/Muscat": "OM",
  "Asia/Kuwait": "KW",
  "Asia/Bahrain": "BH",
  "Europe/Vienna": "AT",
  "Pacific/Auckland": "NZ",
  "Europe/Berlin": "DE",
  "Europe/Paris": "FR",
  "Europe/Rome": "IT",
  "Europe/Madrid": "ES",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI",
  "Europe/Zurich": "CH",
  "Europe/Warsaw": "PL",
  "Europe/Lisbon": "PT",
  "Europe/Athens": "GR",
  "Europe/Istanbul": "TR",
  "Asia/Tokyo": "JP",
  "Asia/Shanghai": "CN",
  "Asia/Hong_Kong": "CN",
  "Asia/Beijing": "CN",
  "Asia/Chongqing": "CN",
  "Asia/Urumqi": "CN",
};

const LANGUAGE_COUNTRY_MAP: Record<string, string> = {
  "en-PK": "PK",
  "ur-PK": "PK",
  "pa-PK": "PK",
  "sd-PK": "PK",
  "en-US": "US",
  "en-CA": "CA",
  "fr-CA": "CA",
  "en-AE": "AE",
  "ar-AE": "AE",
  "en-GB": "GB",
  "en-IE": "IE",
  "ar-SA": "SA",
  "ar-QA": "QA",
  "ar-OM": "OM",
  "ar-KW": "KW",
  "ar-BH": "BH",
  "de-AT": "AT",
  "de-DE": "DE",
  "en-NZ": "NZ",
  "fr-FR": "FR",
  "it-IT": "IT",
  "es-ES": "ES",
  "nl-NL": "NL",
  "fr-BE": "BE",
  "nl-BE": "BE",
  "sv-SE": "SE",
  "nb-NO": "NO",
  "nn-NO": "NO",
  "da-DK": "DK",
  "fi-FI": "FI",
  "de-CH": "CH",
  "fr-CH": "CH",
  "it-CH": "CH",
  "pl-PL": "PL",
  "pt-PT": "PT",
  "el-GR": "GR",
  "tr-TR": "TR",
  "ja-JP": "JP",
  "zh-CN": "CN",
  "zh-HK": "CN",
  "zh-SG": "CN",
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
    if (langPrefix === "en") return "US";
    if (langPrefix === "ar") return "AE";
    if (langPrefix === "de") return "DE";
    if (langPrefix === "fr") return "FR";
    if (langPrefix === "it") return "IT";
    if (langPrefix === "es") return "ES";
    if (langPrefix === "nl") return "NL";
    if (langPrefix === "sv") return "SE";
    if (langPrefix === "nb" || langPrefix === "nn") return "NO";
    if (langPrefix === "da") return "DK";
    if (langPrefix === "fi") return "FI";
    if (langPrefix === "pl") return "PL";
    if (langPrefix === "pt") return "PT";
    if (langPrefix === "el") return "GR";
    if (langPrefix === "tr") return "TR";
    if (langPrefix === "ja") return "JP";
    if (langPrefix === "zh") return "CN";
  } catch { /* ignore */ }

  return "PK";
}

export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export function formatLocalNumber(input: string, maxLength: number): string {
  return input.replace(/\D/g, "").replace(/^0+/, "").slice(0, maxLength);
}

export function buildFullNumber(dialCode: string, localNumber: string): string {
  return dialCode + localNumber.replace(/\D/g, "").replace(/^0+/, "");
}
