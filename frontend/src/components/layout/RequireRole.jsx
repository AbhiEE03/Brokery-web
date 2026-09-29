import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { homePathFor } from "../../auth/roles";

/**
 * Admin-only screens. The API already refuses these requests (403); this just
 * sends the user to their own home page instead of rendering an error card.
 */
const RequireRole = ({ roles }) => {
	const user = useSelector((state) => state.auth.user);

	if (!roles.includes(user?.role)) {
		return <Navigate to={homePathFor(user)} replace />;
	}

	return <Outlet />;
};

export default RequireRole;
