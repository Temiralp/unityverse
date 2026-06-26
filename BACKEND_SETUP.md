# Unityverse Backend Setup

Bu layihədə statik sayt saxlanılıb, Node.js backend isə ayrıca əlavə edilib.

## Stack

- Node.js + Express
- PostgreSQL
- Prisma ORM
- EJS admin panel

## Lokal başlatma

1. `.env` dəyərlərini yoxla.
2. PostgreSQL-i başlat:

```bash
docker compose up -d postgres
```

Docker yoxdursa, PostgreSQL-i lokal quraşdır və `.env` içindəki `DATABASE_URL` dəyərini ona uyğun dəyiş.

3. Database migration:

```bash
npm run prisma:migrate -- --name init
```

4. Admin user yarat:

```bash
npm run seed
```

5. Serveri başlat:

```bash
npm run dev
```

Admin panel:

```text
http://localhost:8000/admin
```

Default admin:

```text
admin@unityverseacademy.com
ChangeMe123!
```

Production-a çıxmazdan əvvəl `SESSION_SECRET`, `ADMIN_PASSWORD` və SMTP dəyərləri mütləq dəyişdirilməlidir.

## İlk MVP modulları

- Admin login
- Dashboard
- Kateqoriya əlavə etmə və siyahı
- Kurs əlavə etmə və siyahı
- Form müraciətlərinin PostgreSQL-ə yazılması
- Public API: `/api/products`, `/api/categories`, `/api/blog-posts`
