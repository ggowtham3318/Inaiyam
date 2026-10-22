import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Language = 'en' | 'ta'
type Copy = { about: string; stories: string; contact: string; login: string; begin: string; tagline: string; heroTitle: string; heroBody: string; explore: string }
const copy: Record<Language, Copy> = {
  en: { about: 'About', stories: 'Stories', contact: 'Contact', login: 'Log in', begin: 'Begin your journey', tagline: 'Where two families meet', heroTitle: 'Where two families meet, with care.', heroBody: 'Find a meaningful connection rooted in shared values, family and the future you want to build together.', explore: 'Explore matches' },
  ta: { about: 'எங்களை பற்றி', stories: 'வெற்றி கதைகள்', contact: 'தொடர்பு', login: 'உள்நுழைய', begin: 'உங்கள் பயணத்தை தொடங்குங்கள்', tagline: 'இரு குடும்பங்கள் சந்திக்கும் இடம்', heroTitle: 'இரு குடும்பங்கள் அன்புடன் சந்திக்கும் இடம்.', heroBody: 'பகிர்ந்த மதிப்புகள், குடும்பம் மற்றும் எதிர்காலத்தை மையமாகக் கொண்ட அர்த்தமுள்ள உறவை கண்டறியுங்கள்.', explore: 'துணையை தேடுங்கள்' },
}
const Context = createContext<{ language: Language; setLanguage: (language: Language) => void; t: Copy } | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('inaiyam-language') as Language) || 'en')
  useEffect(() => { localStorage.setItem('inaiyam-language', language) }, [language])
  const value = useMemo(() => ({ language, setLanguage, t: copy[language] }), [language])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useI18n() {
  const context = useContext(Context)
  if (!context) throw new Error('useI18n must be used inside I18nProvider')
  return context
}
