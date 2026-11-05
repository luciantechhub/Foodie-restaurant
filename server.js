require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cloudinary = require('cloudinary').v2;

const { MONGODB_URI, ADMIN_PASSWORD, JWT_SECRET, WHATSAPP_NUMBER } = process.env;
const PROD = process.env.NODE_ENV === 'production';
if (!MONGODB_URI || !ADMIN_PASSWORD || !JWT_SECRET) {
  console.error('Missing MONGODB_URI, ADMIN_PASSWORD or JWT_SECRET. Set them in your environment.');
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const Dish = mongoose.model('Dish', new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, default: 'Main', trim: true },
  description: { type: String, default: '', trim: true },
  image: String,
  imageId: String,
  soldOut: { type: Boolean, default: false }
}, { timestamps: true }));

const Setting = mongoose.model('Setting', new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  whatsapp: { type: String, default: '' },
  address: { type: String, default: '' },
  hours: { type: String, default: '11:00am – 11:00pm' }
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(/^image\//.test(file.mimetype) ? null : new Error('Please choose an image file'), true)
});

const sendToCloud = buf => new Promise((resolve, reject) => {
  cloudinary.uploader.upload_stream(
    { folder: 'foodie', transformation: [{ width: 900, crop: 'limit', quality: 'auto' }] },
    (err, res) => (err ? reject(err) : resolve(res))
  ).end(buf);
});

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const safeEqual = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

const attempts = new Map();
const auth = (req, res, next) => {
  try { jwt.verify(req.cookies.token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Please log in' }); }
};

const getSettings = async () => {
  let s = await Setting.findOne({ key: 'main' });
  if (!s) s = await Setting.create({ key: 'main', whatsapp: WHATSAPP_NUMBER || '' });
  return s;
};

// ---- public ----
app.get('/api/dishes', async (req, res) => {
  res.json(await Dish.find().sort({ createdAt: -1 }));
});
app.get('/api/settings', async (req, res) => {
  const s = await getSettings();
  res.json({ whatsapp: s.whatsapp, address: s.address, hours: s.hours });
});

// ---- admin ----
app.post('/api/admin/login', (req, res) => {
  const ip = req.ip;
  const a = attempts.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 60 * 1000) { a.n = 0; a.t = Date.now(); }
  if (a.n >= 8) return res.status(429).json({ error: 'Too many tries. Wait a few minutes.' });
  if (!safeEqual(req.body.password || '', ADMIN_PASSWORD)) {
    a.n++; attempts.set(ip, a);
    return res.status(401).json({ error: 'Wrong password' });
  }
  attempts.delete(ip);
  const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 7 * 864e5 });
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });
app.get('/api/admin/me', auth, (req, res) => res.json({ ok: true }));

const fields = b => ({
  name: b.name, price: Number(b.price), category: b.category || 'Main',
  description: b.description || '', soldOut: b.soldOut === 'true' || b.soldOut === true
});

app.post('/api/admin/dishes', auth, upload.single('image'), async (req, res) => {
  const d = new Dish(fields(req.body));
  if (req.file) { const r = await sendToCloud(req.file.buffer); d.image = r.secure_url; d.imageId = r.public_id; }
  await d.save();
  res.json(d);
});
app.put('/api/admin/dishes/:id', auth, upload.single('image'), async (req, res) => {
  const d = await Dish.findById(req.params.id);
  if (!d) return res.status(404).json({ error: 'Dish not found' });
  Object.assign(d, fields(req.body));
  if (req.file) {
    if (d.imageId) cloudinary.uploader.destroy(d.imageId).catch(() => {});
    const r = await sendToCloud(req.file.buffer); d.image = r.secure_url; d.imageId = r.public_id;
  }
  await d.save();
  res.json(d);
});
app.delete('/api/admin/dishes/:id', auth, async (req, res) => {
  const d = await Dish.findByIdAndDelete(req.params.id);
  if (d && d.imageId) cloudinary.uploader.destroy(d.imageId).catch(() => {});
  res.json({ ok: true });
});
app.put('/api/admin/settings', auth, async (req, res) => {
  const s = await getSettings();
  s.whatsapp = String(req.body.whatsapp || '').replace(/\D/g, '');
  s.address = req.body.address || '';
  s.hours = req.body.hours || '';
  await s.save();
  res.json({ ok: true });
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 400).json({ error: err.message || 'Something went wrong' });
});

mongoose.connect(MONGODB_URI).then(() => {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log('Foodie running on ' + port));
}).catch(e => { console.error('Database connection failed:', e.message); process.exit(1); });
