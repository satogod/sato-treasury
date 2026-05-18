# Sato Treasury — Guía de Deploy

## Stack
- **Frontend:** React + Vite
- **Base de datos + Auth:** Supabase (PostgreSQL)
- **Deploy + CI/CD:** Vercel + GitHub Actions

---

## 1. Supabase — Base de datos

1. Creá cuenta en [supabase.com](https://supabase.com) → New Project
2. Esperá que inicialice (~2 min)
3. Entrá a **SQL Editor** → pegá y ejecutá el contenido de `supabase-schema.sql`
4. En **Project Settings → API** copiá:
   - `Project URL` → será tu `VITE_SUPABASE_URL`
   - `anon public key` → será tu `VITE_SUPABASE_ANON_KEY`
5. En **Authentication → Email** activá "Confirm email" = OFF (para uso interno)

### Crear usuarios manualmente
En Supabase → Authentication → Users → Invite user
Después podés cambiar el rol en la tabla `profiles`:
```sql
update profiles set role = 'admin' where id = 'uuid-del-usuario';
```

**Roles disponibles:**
- `admin` → acceso total, puede cambiar roles
- `operator` → puede registrar operaciones, crear cuentas y clientes
- `viewer` → solo lectura, no puede crear nada

---

## 2. GitHub — Repositorio

```bash
cd sato-treasury
git init
git add .
git commit -m "feat: initial commit"
git remote add origin https://github.com/TU_USUARIO/sato-treasury.git
git push -u origin main
```

El workflow de CI (`.github/workflows/ci.yml`) corre automáticamente en cada push:
- ESLint
- Build de producción

---

## 3. Vercel — Deploy automático

1. Entrá a [vercel.com](https://vercel.com) → New Project
2. Importá el repo de GitHub `sato-treasury`
3. Framework preset: **Vite** (lo detecta solo)
4. En **Environment Variables** agregá:
   ```
   VITE_SUPABASE_URL      = https://xxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJ...
   ```
5. Click **Deploy**

A partir de ahora, **cada push a `main` = deploy automático** en ~30 segundos.

---

## 4. Flujo de trabajo con ramas (CI/CD completo)

```
feature/mi-cambio  →  develop  →  main
                       ↓             ↓
                    CI corre     CI + Deploy
```

```bash
# Desarrollo diario
git checkout -b feature/nueva-pantalla
# ... hacés cambios ...
git commit -m "feat: nueva pantalla de reportes"
git push origin feature/nueva-pantalla

# Abrís un Pull Request en GitHub hacia main
# → GitHub Actions corre lint + build automáticamente
# → Si pasa, merge a main
# → Vercel deploya en producción automáticamente
```

---

## 5. Variables de entorno locales

```bash
cp .env.example .env.local
# Editá .env.local con tus valores reales de Supabase
npm install
npm run dev
# → http://localhost:3000
```

---

## 6. Migrar datos del localStorage al sistema nuevo

Si ya tenés datos en el navegador de las versiones anteriores, podés exportarlos así:

```js
// Pegá esto en la consola del navegador donde está la versión anterior
JSON.stringify(localStorage.getItem('sato_v6'))
```

Guardá el JSON y abrí un issue o pedile a Claude que escriba un script de migración.

---

## Estructura del proyecto

```
sato-treasury/
├── src/
│   ├── components/
│   │   ├── LoginPage.jsx      ← pantalla de login
│   │   └── TreasuryApp.jsx    ← app principal (pegás el JSX del artifact v6)
│   ├── hooks/
│   │   ├── useAuth.jsx        ← sesión, roles, login/logout
│   │   └── useData.js         ← queries a Supabase
│   ├── lib/
│   │   └── supabase.js        ← cliente de Supabase
│   ├── App.jsx                ← auth gate
│   └── main.jsx               ← entry point
├── .github/
│   └── workflows/
│       └── ci.yml             ← GitHub Actions
├── supabase-schema.sql        ← schema completo de la DB
├── .env.example               ← template de variables de entorno
├── vite.config.js
└── package.json
```
