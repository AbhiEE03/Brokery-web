import { useContext } from "react";
import { ToastContext } from "../components/ui/toastContext";

// toast.success("Saved"), toast.error("Couldn't save", { description })
const useToast = () => {
	const context = useContext(ToastContext);
	if (!context) throw new Error("useToast must be used inside <ToastProvider>");
	return context;
};

export default useToast;
