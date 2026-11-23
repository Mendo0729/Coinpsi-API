# COINPSI API

Node.js 24 · Express · PostgreSQL (Aiven) · Google Drive · Sharp.

## CRÍTICO — rotación de secretos requerida antes del despliegue

La rama original expuso el archivo `Coinpsi-API.env` en un repositorio público. Contenía una cadena PostgreSQL con contraseña y un secreto JWT. **Considerar ambos comprometidos.**

1. Rotar la contraseña del usuario PostgreSQL en Aiven, actualizar `DATABASE_URL` en Render y revocar el acceso anterior.
2. Generar un nuevo `JWT_SECRET` aleatorio (32 bytes o más); actualizar Render. Los tokens previos dejarán de funcionar.
3. Revisar logs y credenciales adicionales de Aiven y Render.
4. Eliminar el archivo del árbol Git **no lo elimina del historial ni de clones**. Coordinar saneamiento histórico posteriormente y nunca volver a publicar secretos.
5. Configurar `DATABASE_SSL=true` y suministrar la CA de Aiven mediante `DATABASE_CA_CERT_PATH` o `DATABASE_CA_CERT`.
6. No compartir secretos en issues, PR, archivos de ejemplo o capturas.
7. El arranque en producción ahora rechaza `DATABASE_SSL` deshabilitado y `JWT_SECRET` menor de 32 bytes; configurar Render **antes** de desplegar.

## Desarrollo

Usar variables de entorno locales no versionadas o secretos de Render. Copiar los campos de `.env.example` sin reutilizar datos del archivo comprometido.

```sh
npm ci
npm test
npm audit --omit=dev --audit-level=high
npm start
```

## Seguridad

- Helmet activo y CORS limitado a los orígenes configurados.
- Límites: 600 solicitudes/IP/15 minutos a nivel general (sin healthcheck), 8 intentos/IP/15 minutos para login.
- `trust proxy=1` en Render; revisar si cambia la topología. Los contadores son **en memoria** y requieren Redis u otro almacén compartido al escalar.
- Autenticación administrativa: JWT HS256 + comprobación en PostgreSQL de rol `admin` y cuenta activa en **cada solicitud**.
- Caché de imágenes con límites de cola y tamaño de fuente mediante `IMAGE_MAX_PENDING_JOBS` y `IMAGE_MAX_BYTES`.
- OAuth de Google Drive utiliza una CSP con nonce en la página de respuesta.

## Compatibilidad

- El OAuth scope `https://www.googleapis.com/auth/drive` se mantiene para no romper la integración actual. Evaluar `drive.file` en una migración independiente con pruebas de accesos.
- En producción, para que una nueva autorización de Google Drive persista se requiere actualizar `GOOGLE_REFRESH_TOKEN` en Render; no se informa como persistida si solamente quedó en memoria. En desarrollo se mantiene un archivo local ignorado por Git.
- Los estados OAuth son en memoria; para varias instancias usar almacenamiento compartido.

## Pendiente de fases adicionales

- Integración de formulario y Resend con validación, persistencia, anti-spam y reintentos.
- Pruebas de integración con PostgreSQL de prueba, control de privilegios del usuario de BD y pruebas de carga de imágenes.
- Consolidación y automatización de las migraciones SQL existentes en `database/migrations` y `migrations`.
- Rate limiting distribuido, persistencia cifrada de tokens Google y rotación programada de secretos.
