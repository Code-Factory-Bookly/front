# Bookly Frontend

Front de la plataforma de reservas de servicios del caso 14 de CodeF@ctory. Consume la API de
[`backendcf`](https://github.com/Code-Factory-Bookly/backendcf) y tiene tres experiencias
separadas por rol: cliente, profesional y administrador.

## Tecnologías

| Componente | Tecnología |
|---|---|
| Framework | SvelteKit 2 / Svelte 5 (runes) |
| Build | Vite 5, adaptador estático (`@sveltejs/adapter-static`) |
| Estilos | Sass, con tokens de diseño compartidos en `src/lib/styles/_tokens.scss` |
| Iconos | `lucide-svelte` |
| Código QR (MFA) | `qrcode` |
| Chequeo de tipos | `svelte-check` |

El sistema visual (paleta, tipografía, componentes) sale del handoff de diseño en
[DESIGN-HANDOFF.md](DESIGN-HANDOFF.md); los tokens ya están implementados en
`src/lib/styles/_tokens.scss`, reutilízalos en vez de definir colores nuevos.

## Ejecución local

```bash
npm ci
npm run dev
```

Por defecto, `npm run dev` sirve en `http://127.0.0.1:5173` y las peticiones van a `/api/v1`
relativo al propio origen. Para apuntar a un backend específico (local o desplegado), define
`VITE_API_URL` antes de levantar el servidor:

```bash
VITE_API_URL=http://localhost:8080/api/v1 npm run dev
```

En Windows (PowerShell):

```powershell
$env:VITE_API_URL = "http://localhost:8080/api/v1"; npm run dev
```

El backend necesita tener el origen del front en `FRONTEND_URL` (CORS) para aceptar las
peticiones — ver el [README del backend](https://github.com/Code-Factory-Bookly/backendcf#configuraci%C3%B3n-de-seguridad).

## Build y verificación

```bash
npm run build      # genera el sitio estático en build/
npm run preview    # sirve ese build localmente
npx svelte-check   # chequeo de tipos de todo el proyecto (no hay script "check" en package.json)
```

No hay suite de pruebas automatizadas en este repo todavía.

## Estructura de rutas

Cada rol tiene su propio árbol de rutas y su propio layout (menú lateral, guard de sesión):

| Rol | Rutas |
|---|---|
| Público | `/login`, `/register` |
| Cliente | `/customer`, `/customer/services`, `/customer/services/[id]`, `/customer/agenda`, `/customer/profile` |
| Profesional | `/professional`, `/professional/agenda`, `/professional/schedule`, `/professional/turns`, `/professional/profile` |
| Administrador | `/admin`, `/admin/services`, `/admin/services/new`, `/admin/services/[id]`, `/admin/professionals`, `/admin/roles`, `/admin/agenda`, `/admin/settings` |

El acceso a cada árbol lo decide `auth.ts` a partir del rol que trae el JWT (`CUSTOMER`,
`PROFESSIONAL` o `ADMIN`); no hay rutas que mezclen roles.

## Autenticación y MFA

- El token se guarda en `localStorage` (`bookly.token`); `src/lib/services/api.ts` lo agrega a
  cada petición y lo limpia si el backend responde `401` (salvo que la llamada pase
  `silent401: true`).
- Las cuentas `ADMIN` pasan por un segundo factor (TOTP) la primera vez que inician sesión:
  `/login` cambia a un paso de enrolamiento con QR (`qrcode`) antes de entregar el token. Los
  pasos siguientes de login piden el código, con opción de "confiar en este dispositivo" por 30
  días (`src/lib/stores/auth.ts`, funciones `mfaEnroll`/`mfaVerify`/`mfaSkip`).

## Selector de cuentas de prueba

Para probar los tres roles sin cerrar sesión una y otra vez, el front trae un selector de cuentas
pensado solo para el equipo (`src/lib/components/TestAccountSwitcher.svelte`):

1. Visita cualquier página con `?test=1` una vez (por ejemplo, `/login?test=1`). Queda guardado en
   `localStorage` de ese navegador.
2. Inicia sesión normalmente con cada cuenta que quieras probar (admin, profesional, cliente). Cada
   login exitoso se guarda en la lista.
3. Un botón flotante aparece abajo a la derecha: ábrelo y elige la cuenta para saltar a su panel
   sin volver a escribir usuario y contraseña.

Está apagado por defecto — nadie lo ve sin visitar la URL con `?test=1` primero, y todo vive en el
`localStorage` de ese navegador (nunca en el backend ni compartido entre visitantes).

## Convenciones del proyecto

- Los servicios HTTP viven en `src/lib/services/*.ts`, uno por dominio (`auth`, `booking`,
  `service`, `professional`, `roles`, `schedule`). Todos pasan por `apiFetch` (`api.ts`), que arma
  el contrato de error uniforme (`errorCode`, `message`, `details`, `status`).
- Los tipos que vienen del backend viven en `src/lib/types/*.ts` y deben reflejar la forma real de
  la respuesta (no la deseada) — varias pantallas fallaron en el pasado por asumir campos que el
  backend nunca mandó; antes de cambiar un tipo, revisa el DTO real en `backendcf`.
- Componentes compartidos en `src/lib/components/`; estilos compartidos en `src/lib/styles/`.
