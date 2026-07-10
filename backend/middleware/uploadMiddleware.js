const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const imageFormats = ["jpg", "jpeg", "png", "webp"];

const createUpload = ({ folder, allowedFormats }) => {
	const storage = new CloudinaryStorage({
		cloudinary,
		params: {
			folder,
			resource_type: "auto",
			format: async (req, file) => file.mimetype.split("/")[1],
		},
	});

	return multer({
		storage,
		limits: {
			fileSize: 5 * 1024 * 1024,
		},
		fileFilter: (req, file, cb) => {
			const mimeType = file.mimetype.toLowerCase();
			const extension = file.originalname.split(".").pop()?.toLowerCase();
			const isImage = mimeType.startsWith("image/") && allowedFormats.includes(extension);
			const isPdf = mimeType === "application/pdf";

			if (allowedFormats.length === imageFormats.length) {
				if (isImage) return cb(null, true);
				return cb(new Error("Only image files are allowed"));
			}

			if (isImage || isPdf) return cb(null, true);
			return cb(new Error("Only PDF and image files are allowed"));
		},
	});
};

const uploadDocument = createUpload({
	folder: "brokery/documents",
	allowedFormats: ["jpg", "jpeg", "png", "webp"],
});

const uploadImage = createUpload({
	folder: "brokery/properties",
	allowedFormats: imageFormats,
});

module.exports = { uploadDocument, uploadImage };