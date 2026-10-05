// backend/middleware/upload.js
const multer = require("multer");
const path   = require("path");

const ALLOWED_TYPES = ["application/pdf","image/jpeg","image/jpg","image/png"];
const MAX_SIZE      = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage(); // store in memory for hashing before saving

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return cb(new Error("Only PDF, JPG, and PNG files are allowed"), false);
  }
  cb(null, true);
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } });
