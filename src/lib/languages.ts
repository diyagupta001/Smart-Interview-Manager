// Single source of truth for the languages the AI interview engine supports.
// The core interview engine never changes per language — only this parameter does.

export interface InterviewLanguage {
  code: string;
  label: string;
  nativeLabel: string;
  flag: string;
  /** BCP-47 tag used for speech recognition and text-to-speech. */
  locale: string;
}

export const INTERVIEW_LANGUAGES: InterviewLanguage[] = [
  { code: "en", label: "English", nativeLabel: "English", flag: "🇬🇧", locale: "en-US" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", flag: "🇮🇳", locale: "hi-IN" },
  { code: "pa", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ", flag: "🇮🇳", locale: "pa-IN" },
  { code: "hr-haryanvi", label: "Haryanvi", nativeLabel: "हरियाणवी", flag: "🇮🇳", locale: "hi-IN" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা", flag: "🇮🇳", locale: "bn-IN" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी", flag: "🇮🇳", locale: "mr-IN" },
  { code: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી", flag: "🇮🇳", locale: "gu-IN" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்", flag: "🇮🇳", locale: "ta-IN" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు", flag: "🇮🇳", locale: "te-IN" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ", flag: "🇮🇳", locale: "kn-IN" },
  { code: "ml", label: "Malayalam", nativeLabel: "മലയാളം", flag: "🇮🇳", locale: "ml-IN" },
  { code: "ur", label: "Urdu", nativeLabel: "اردو", flag: "🇮🇳", locale: "ur-IN" },
  { code: "or", label: "Odia", nativeLabel: "ଓଡ଼ିଆ", flag: "🇮🇳", locale: "or-IN" },
  { code: "as", label: "Assamese", nativeLabel: "অসমীয়া", flag: "🇮🇳", locale: "as-IN" },
  { code: "es", label: "Spanish", nativeLabel: "Español", flag: "🇪🇸", locale: "es-ES" },
  { code: "fr", label: "French", nativeLabel: "Français", flag: "🇫🇷", locale: "fr-FR" },
  { code: "de", label: "German", nativeLabel: "Deutsch", flag: "🇩🇪", locale: "de-DE" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", flag: "🇸🇦", locale: "ar-SA" },
];

/** Languages shown first on the candidate welcome screen. */
export const PRIMARY_LANGUAGE_CODES = [
  "en", "hi", "pa", "hr-haryanvi", "bn", "mr", "gu", "ta", "te", "kn", "ml",
];

export const DEFAULT_LANGUAGE_CODE = "en";

export const getLanguage = (code: string | null | undefined): InterviewLanguage =>
  INTERVIEW_LANGUAGES.find((l) => l.code === code) ?? INTERVIEW_LANGUAGES[0];

export const languageLabel = (code: string | null | undefined) => {
  const l = getLanguage(code);
  return `${l.flag} ${l.label}`;
};

export type AnswerLanguageOption = "same" | "english" | "both";

export const ANSWER_LANGUAGE_OPTIONS: { value: AnswerLanguageOption; label: string; description: string }[] = [
  { value: "same", label: "Same as interview language", description: "Answer in the language the AI is speaking." },
  { value: "english", label: "English", description: "Questions in your language, answers in English." },
  { value: "both", label: "Both / mixed", description: "Mix freely — you won't be penalised for it." },
];
