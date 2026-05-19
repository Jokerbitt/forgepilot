export type Theme = 'dark' | 'light'

const THEME_KEY = 'fp-theme'
export const defaultTheme: Theme = 'dark'

export function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return defaultTheme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function getTheme(): Theme {
  if (typeof window === 'undefined') return defaultTheme
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  return defaultTheme
}

export function setTheme(theme: Theme): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
}

export function applyTheme(theme: Theme): void {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

/** Inline script source — injected as blocking <script> in <head> to prevent flash */
export const themeScriptContent = `
(function(){
  try {
    var t = localStorage.getItem('fp-theme');
    if (t === 'light') { document.documentElement.classList.remove('dark'); }
    else { document.documentElement.classList.add('dark'); }
  } catch(e) {
    document.documentElement.classList.add('dark');
  }
})();
`.trim()
