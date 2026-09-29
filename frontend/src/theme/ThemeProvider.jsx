import { createContext, useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "theme";

const readInitialTheme = () => {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === "dark" || saved === "light") return saved;
	} catch {
		// Storage can be unavailable (private mode); fall back to the OS preference.
	}
	return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const ThemeContext = createContext(null);

/**
 * One theme state for the whole app. Before this, App and Sidebar each kept
 * their own copy, so toggling from a dark start left a stale "dark" class
 * on the App wrapper and the toggle appeared to do nothing.
 */
const ThemeProvider = ({ children }) => {
	const [theme, setTheme] = useState(readInitialTheme);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
		try {
			localStorage.setItem(STORAGE_KEY, theme);
		} catch {
			// Not persisting is fine.
		}
	}, [theme]);

	const toggleTheme = useCallback(() => setTheme((current) => (current === "dark" ? "light" : "dark")), []);
	const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, toggleTheme]);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export default ThemeProvider;
