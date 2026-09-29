import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { homePathFor } from "../../auth/roles";

const HomeRedirect = () => {
	const user = useSelector((state) => state.auth.user);
	return <Navigate to={user ? homePathFor(user) : "/login"} replace />;
};

export default HomeRedirect;
