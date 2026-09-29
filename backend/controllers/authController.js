const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { HttpError } = require("../utils/httpError");

// Compared against when the email doesn't exist, so response time doesn't
// reveal whether an account is registered.
const DUMMY_HASH = bcrypt.hashSync("brokery-timing-equalizer", 10);

const generateToken = (user) => {
	return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRES_IN || "7d",
	});
};

const publicUser = (user) => ({
	_id: user._id,
	name: user.name,
	email: user.email,
	role: user.role,
});

const register = async (req, res) => {
	const { name, email, password, role } = req.body;

	if (await User.exists({ email })) {
		throw new HttpError(409, "User already exists", { code: "USER_EXISTS" });
	}

	const user = await User.create({
		name,
		email,
		password,
		role: role || "broker",
	});

	res.status(201).json({
		success: true,
		message: "User registered successfully",
		data: publicUser(user),
	});
};

const login = async (req, res) => {
	const { email, password } = req.body;

	const user = await User.findOne({ email });
	const isMatch = await bcrypt.compare(password, user?.password || DUMMY_HASH);

	if (!user || !isMatch) {
		throw new HttpError(401, "Invalid credentials", { code: "INVALID_CREDENTIALS" });
	}

	if (!user.isActive) {
		throw new HttpError(403, "This account has been disabled", { code: "ACCOUNT_DISABLED" });
	}

	res.status(200).json({
		success: true,
		data: {
			token: generateToken(user),
			user: publicUser(user),
		},
	});
};

const getMe = async (req, res) => {
	res.status(200).json({ success: true, data: publicUser(req.user) });
};

const getBrokers = async (req, res) => {
	const brokers = await User.find({ role: "broker" })
		.select("_id name email isActive")
		.sort({ name: 1 })
		.lean();
	res.status(200).json({ success: true, data: brokers });
};

module.exports = { register, login, getMe, getBrokers };
