import styles from './ui.module.css'
import { useI18n } from '../../app/I18nContext'

export function LanguageToggle() {
  const { language, setLanguage } = useI18n()
  return <div className={styles.languageToggle} aria-label="Choose language"><button className={language === 'en' ? styles.languageActive : ''} onClick={() => setLanguage('en')}>EN</button><span>/</span><button className={language === 'ta' ? styles.languageActive : ''} onClick={() => setLanguage('ta')}>தமிழ்</button></div>
}
