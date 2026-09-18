# La rifa de Juanca ⚽

Marca los números, guarda la selección compartida en **Turso** y descarga el afiche original con balones. Interfaz adaptable a celulares.

## Configurar en Vercel

Importa este repositorio con **Framework Preset: Other**, raíz del repositorio, **Build Command vacío**, **Output Directory: public**, instalación automática (`npm ci`) y **Node.js 22.x**. La salida ya está definida en vercel.json.

Antes del despliegue agrega estas variables en **Settings → Environment Variables**:

| Variable | Valor |
| --- | --- |
| `TURSO_DATABASE_URL` | URL remota, por ejemplo `libsql://mi-base-mi-organizacion.turso.io`. |
| `TURSO_AUTH_TOKEN` | Token de Turso con permiso de lectura y escritura. |
| `ADMIN_PASSWORD` | Clave de edición que usarán los organizadores. |

`.env.example` tiene los nombres listos. **Debes completar los valores reales**; no se incluyen credenciales en GitHub. No uses prefijos públicos como NEXT_PUBLIC_ o VITE_ para los secretos.

Activa las variables para Production. Si usas Preview, configura una base de pruebas distinta para no modificar la rifa real. Si cambias variables después del despliegue, vuelve a desplegar.

La función api/numbers.js conecta con Turso desde el servidor. El navegador nunca recibe el token de Turso. La tabla raffle_state se crea automáticamente en la primera conexión: no necesitas ejecutar SQL. Cada base contiene una sola selección para esta rifa.

## Obtener las credenciales de Turso

Crea una base en tu cuenta de Turso y copia su URL y un token de lectura/escritura desde el panel. Con la CLI de Turso configurada puedes usar:

```sh
turso db create rifa-juanca
turso db show rifa-juanca --url
turso db tokens create rifa-juanca
```

Pega los valores en Vercel, nunca en el repositorio.

## Uso entre dispositivos

1. Abre la app: carga la selección de Turso en modo lectura.
2. Pulsa **Habilitar edición** e ingresa ADMIN_PASSWORD en cada dispositivo autorizado.
3. Toca un número del tablero o del afiche. Se muestra guardado cuando el servidor confirma el cambio.
4. Los demás dispositivos se actualizan cada **5 segundos** mientras la página está visible. También puedes pulsar **Actualizar**.
5. Descarga el PNG original de 1024 × 1536 para compartirlo.

La clave de edición se recuerda solo en la sesión de la pestaña. **Cerrar edición** la elimina. El afiche y la selección son públicos; la clave protege los cambios. Usa una clave larga y compártela solo con organizadores.

Si dos dispositivos editan una misma versión a la vez, uno guarda y el otro recibe la selección actual con un aviso para volver a intentar. No se sobrescriben silenciosamente cambios de otros. Al recibir cambios remotos se limpia el historial de deshacer.

Sin conexión se bloquea la edición. No se acumulan cambios locales para subir después. Si se pierde la respuesta de un guardado, **Actualizar** consulta el estado real antes de permitir editar de nuevo.

**Guardar respaldo** descarga un JSON. **Cargar respaldo** reemplaza la selección compartida, requiere la clave y permite deshacer. Para migrar desde la primera versión local, descarga allí su respaldo y cárgalo aquí; los datos antiguos no se suben automáticamente.

## Desarrollo local

Requiere Node.js 22 y npm. Ejecuta `npm ci`, copia .env.example a .env.local, completa las variables y ejecuta:

```sh
npm run dev
```

Abre http://localhost:3000. Para probar sin Turso puedes usar `TURSO_DATABASE_URL=file:local.db`, dejar el token vacío y asignar una clave. Esto es solo para desarrollo: Vercel exige la URL remota de Turso.

```sh
npm test
```

Las pruebas usan libSQL local para verificar autorización, validación, persistencia, concurrencia y manejo de errores. La conexión a tu instancia remota debe verificarse después de configurar tus credenciales.

## Estructura

- public/: interfaz, afiche original, balón y exportación Canvas.
- api/numbers.js: función de Vercel y conexión a Turso.
- lib/: autorización y persistencia con control de versión.
- scripts/dev.js: servidor local.
- tests/: pruebas.
- .env.example: plantilla de variables sin secretos.

Referencias: [Turso/libSQL](https://tursodatabase.github.io/libsql-client-ts/), [funciones Node.js de Vercel](https://vercel.com/docs/functions/runtimes/node-js), [variables de entorno](https://vercel.com/docs/environment-variables).
