import { useSelector } from "react-redux";
import HomeRedirect from "./HomeRedirect";
import Landing from "../../pages/Landing";

// "/" is public: visitors see the landing page, signed-in users go to their home.
const PublicHome = () => {
	const token = useSelector((state) => state.auth.token);
	return token ? <HomeRedirect /> : <Landing />;
};

export default PublicHome;
