# Foodie Restaurant

Node + Express + MongoDB site. Customers browse dishes and send orders or table reservations to WhatsApp. The owner manages dishes at `/admin`.

## Deploy (GitHub + Render)
1. Push this folder to a GitHub repo.
2. On Render: New > Web Service > pick the repo. Build command `npm install`, start command `npm start`.
3. Add these environment variables:
   - `MONGODB_URI` (MongoDB Atlas connection string)
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `ADMIN_PASSWORD` (what the owner types to log in)
   - `JWT_SECRET` (any long random text)
   - `WHATSAPP_NUMBER` (country code first, e.g. 2348012345678)
4. Open `yoursite.onrender.com/admin`, log in, add dishes. The WhatsApp number, address and hours can be changed later under "Contact info".

Dish photos live on Cloudinary and dish data in MongoDB, so nothing is lost when Render restarts.

## Run locally
Copy `.env.example` to `.env`, fill it in, then `npm install` and `npm start`.
