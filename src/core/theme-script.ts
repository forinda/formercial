export const THEME_KEY = 'formercial-theme'

/** Runs in the page's <head>, so a saved theme is on before the first paint. */
export const THEME_SCRIPT = `<script>try{var t=localStorage.getItem('${THEME_KEY}');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>`
