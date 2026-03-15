const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || null;

// Trust proxy penting kalau pakai Cloudflare / reverse proxy
app.set('trust proxy', true);

// Database Sederhana (JSON)
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Pastikan folder ada
fs.ensureDirSync(UPLOADS_DIR);
fs.ensureDirSync(path.join(__dirname, 'data'));
fs.ensureDirSync(path.join(__dirname, 'public', 'donate'));

if (!fs.existsSync(DB_PATH)) {
  fs.writeJsonSync(DB_PATH, { globalCounter: 0, totalSize: 0, files: [] });
}

// Helper untuk ambil base URL yang benar
function getBaseUrl(req) {
  if (BASE_URL) return BASE_URL;

  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');

  return `${protocol}://${host}`;
}

// Konfigurasi Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const db = fs.readJsonSync(DB_PATH);
    db.globalCounter++;

    const date = new Date();
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();

    const ext = path.extname(file.originalname);
    const newName = `${dd}${mm}${yyyy}_${db.globalCounter}${ext}`;

    // Simpan info sementara ke object file
    file.savedName = newName;
    file.counterAtUpload = db.globalCounter;

    fs.writeJsonSync(DB_PATH, db);
    cb(null, newName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiter
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, message: "Terlalu banyak upload, coba lagi nanti." }
});

// --- ROUTES ---

// Halaman Utama
app.get('/', (req, res) => {
  const currentBaseUrl = getBaseUrl(req);
  res.render('index', { baseUrl: currentBaseUrl });
});

// API: Stats
app.get('/api/stats', (req, res) => {
  const db = fs.readJsonSync(DB_PATH);
  res.json({
    totalFiles: db.globalCounter,
    totalSize: db.totalSize
  });
});

// API: Upload
app.post('/api/upload', uploadLimiter, upload.array('files'), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "Tidak ada file yang dipilih" });
    }

    const db = fs.readJsonSync(DB_PATH);
    const userId = req.headers['x-user-id'] || 'anonymous';
    const currentBaseUrl = getBaseUrl(req);

    const uploadedFiles = req.files.map(file => {
      const fileData = {
        originalName: file.originalname,
        savedName: file.savedName,
        extension: path.extname(file.originalname).replace('.', ''),
        size: file.size,
        url: `${currentBaseUrl}/${file.savedName}`,
        uploadedAt: new Date(),
        userId: userId
      };

      db.files.push(fileData);
      db.totalSize += file.size;
      return fileData;
    });

    fs.writeJsonSync(DB_PATH, db);

    res.json({
      success: true,
      message: "File uploaded successfully",
      files: uploadedFiles
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: User History
app.get('/api/my-files', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.json([]);

  const db = fs.readJsonSync(DB_PATH);
  const userFiles = db.files.filter(f => f.userId === userId).reverse();
  res.json(userFiles);
});

// Akses File Langsung
app.get('/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  return res.status(404).send('File tidak ditemukan');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Base URL: ${BASE_URL || `dynamic (auto detect from request)`}`);
});
