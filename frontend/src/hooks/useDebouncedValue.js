import { useEffect, useState } from "react";

// The value, but only after it has stopped changing for `delay` ms — so a search
// box sends one request per pause in typing, not one per keystroke.
const useDebouncedValue = (value, delay = 300) => {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);
	return debounced;
};

export default useDebouncedValue;
