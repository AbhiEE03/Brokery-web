const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const cloudinary = require("../config/cloudinary");

const uploadToCloudinary = (buffer, folder) =>
	new Promise((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(
			{ folder, resource_type: "auto" },
			(error, result) =>
				error ? reject(error) : (
					resolve({ url: result.secure_url, publicId: result.public_id })
				),
		);
		stream.end(buffer);
	});

// Development/test driver: writes to backend/.dev-uploads, served by app.js.
const uploadToLocalDisk = async (buffer, folder, extension) => {
	const dir = path.join(__dirname, "..", ".dev-uploads", folder);
	await fs.mkdir(dir, { recursive: true });
	const name = `${crypto.randomUUID()}.${extension}`;
	await fs.writeFile(path.join(dir, name), buffer);
	const base = process.env.PUBLIC_API_ORIGIN || `http://localhost:${process.env.PORT || 5000}`;
	return { url: `${base}/dev-uploads/${folder}/${name}`, publicId: `${folder}/${name}` };
};

const storeFile = (buffer, { folder, extension }) => {
	if (process.env.UPLOAD_DRIVER === "local") {
		return uploadToLocalDisk(buffer, folder, extension);
	}
	return uploadToCloudinary(buffer, folder);
};

module.exports = { storeFile };
