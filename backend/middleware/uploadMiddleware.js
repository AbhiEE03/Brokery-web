const multer = require("multer");
const { storeFile } = require("../utils/storage");

const MAX_FILE_SIZE = 5 * 1024 * 1024;

// File signatures ("magic bytes") so we don't trust the client-supplied MIME type alone.
const SIGNATURES = {
	jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
	png: (b) =>
		b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
	webp: (b) =>
		b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
	pdf: (b) => b.toString("ascii", 0, 4) === "%PDF",
};

const IMAGE_MIME_TYPES = {
	"image/jpeg": "jpg",
	"image/jpg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

const detectKind = (mimeType, allowPdf) => {
	const type = mimeType.toLowerCase();
	if (IMAGE_MIME_TYPES[type]) return IMAGE_MIME_TYPES[type];
	if (allowPdf && type === "application/pdf") return "pdf";
	return null;
};

/**
 * Returns [multerSingle, storeInCloudinary] middleware for one "file" field.
 * Multer keeps the file in memory; the second middleware verifies the file
 * signature and stores it, exposing the URL as req.file.path.
 */
const createUpload = ({ folder, allowPdf }) => {
	const allowedLabel = allowPdf ? "PDF and image files" : "image files";

	const parser = multer({
		storage: multer.memoryStorage(),
		limits: { fileSize: MAX_FILE_SIZE, files: 1 },
		fileFilter: (req, file, cb) => {
			if (detectKind(file.mimetype, allowPdf)) return cb(null, true);
			const error = new Error(`Only ${allowedLabel} are allowed`);
			error.name = "UploadRejectedError";
			return cb(error);
		},
	});

	const storeInCloudinary = async (req, res, next) => {
		if (!req.file) return next();

		const kind = detectKind(req.file.mimetype, allowPdf);
		if (!kind || !SIGNATURES[kind](req.file.buffer)) {
			const error = new Error(`File content does not match an allowed type (${allowedLabel})`);
			error.name = "UploadRejectedError";
			return next(error);
		}

		try {
			const result = await storeFile(req.file.buffer, {
				folder,
				extension: kind,
			});
			req.file.path = result.url;
			req.file.publicId = result.publicId;
			req.file.buffer = undefined;
			next();
		} catch (error) {
			next(error);
		}
	};

	return {
		single: (field) => [parser.single(field), storeInCloudinary],
	};
};

const uploadDocument = createUpload({
	folder: "brokery/documents",
	allowPdf: true,
});

const uploadImage = createUpload({
	folder: "brokery/properties",
	allowPdf: false,
});

module.exports = {
	uploadDocument,
	uploadImage,
	SIGNATURES,
};
