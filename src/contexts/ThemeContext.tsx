import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"

export type ThemeMode = "light" | "dark" | "system"
export type AccentColor = "blue" | "green" | "purple" | "gold" | "red" | "gray" | "teal"
type Theme = "light" | "dark"

interface ThemeContextType {
  theme: Theme
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  themeAccent: AccentColor
  setThemeAccent: (accent: AccentColor) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function resolveTheme(mode: ThemeMode): Theme {
  if (mode === "system" && typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }
  return mode === "dark" ? "dark" : "light"
}

function getInitialThemeMode(): ThemeMode {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("chronos-theme-mode") as ThemeMode | null
    if (stored === "light" || stored === "dark" || stored === "system") return stored
    const storedLegacy = localStorage.getItem("chronos-theme") as Theme | null
    if (storedLegacy === "light" || storedLegacy === "dark") return storedLegacy
    return "system"
  }
  return "light"
}

function getInitialAccent(): AccentColor {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("chronos-accent") as AccentColor | null
    if (["blue", "green", "purple", "gold", "red", "gray", "teal"].includes(stored ?? "")) return stored!
  }
  return "blue"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getInitialThemeMode)
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(getInitialThemeMode()))
  const [themeAccent, setThemeAccentState] = useState<AccentColor>(getInitialAccent)

  const applyAccent = useCallback((accent: AccentColor) => {
    document.documentElement.setAttribute("data-accent", accent)
  }, [])

  const applyTheme = useCallback((mode: ThemeMode) => {
    const resolved = resolveTheme(mode)
    setTheme(resolved)
    const root = document.documentElement
    if (resolved === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
  }, [])

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode)
    localStorage.setItem("chronos-theme-mode", mode)
    applyTheme(mode)
  }, [applyTheme])

  const setThemeAccent = useCallback((accent: AccentColor) => {
    setThemeAccentState(accent)
    localStorage.setItem("chronos-accent", accent)
    applyAccent(accent)
  }, [applyAccent])

  useEffect(() => {
    applyTheme(themeMode)
    applyAccent(themeAccent)
    localStorage.setItem("chronos-theme-mode", themeMode)
    localStorage.setItem("chronos-accent", themeAccent)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (themeMode !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => applyTheme("system")
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [themeMode, applyTheme])

  const toggleTheme = useCallback(() => {
    setThemeMode(theme === "dark" ? "light" : "dark")
  }, [theme, setThemeMode])

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, themeAccent, setThemeAccent, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
