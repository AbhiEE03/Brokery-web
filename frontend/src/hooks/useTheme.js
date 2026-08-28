import { useEffect, useState } from "react";

const useTheme = () => {
	const [theme, setTheme] = useState(
		() => localStorage.getItem("theme") || "light",
	);

	useEffect(() => {
		const root = document.documentElement;
		if (theme === "dark") {
			root.classList.add("dark");
		} else {
			root.classList.remove("dark");
		}
		localStorage.setItem("theme", theme);
	}, [theme]);

	const toggleTheme = () => {
		setTheme((current) => (current === "dark" ? "light" : "dark"));
	};

	return { theme, toggleTheme };
};

export default useTheme;
