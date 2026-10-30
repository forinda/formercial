// The app's theme. Scenes keep their own colors: this never reaches the video.
import { IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { THEME_KEY as KEY } from '@/core/theme-script'
import { IconButton } from './icon-button'

const NEXT = { system: 'light', light: 'dark', dark: 'system' } as const
const ICON = { system: IconDeviceDesktop, light: IconSun, dark: IconMoon }
type Theme = keyof typeof NEXT

function read(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  useEffect(() => setTheme(read()), [])
  const Icon = ICON[theme]
  return (
    <IconButton
      label={`Theme: ${theme}. Switch to ${NEXT[theme]}`}
      onClick={() => {
        const next = NEXT[theme]
        setTheme(next)
        if (next === 'system') delete document.documentElement.dataset.theme
        else document.documentElement.dataset.theme = next
        try {
          if (next === 'system') localStorage.removeItem(KEY)
          else localStorage.setItem(KEY, next)
        } catch {
          // Storage blocked: the choice lasts until the page is closed.
        }
      }}
    >
      <Icon />
    </IconButton>
  )
}
