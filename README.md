# Aura Essences — catálogo y pedidos por WhatsApp

Primer prototipo funcional de una tienda estática de perfumes. No procesa pagos: el cliente
elige una presentación, arma su carrito y envía el pedido listo a WhatsApp.

## Qué ya funciona

- Catálogo responsive en español y solamente en modo claro.
- Búsqueda por perfume, marca, familia o nota.
- Filtros para mujer, hombre y unisex.
- Filtros por decant, frasco sellado y frasco parcial.
- Detalle de cada perfume con presentación, precio, stock y cantidad.
- Carrito persistente en el navegador.
- Pedido prellenado a `+591 75070523` mediante WhatsApp.
- Solicitud de cata con nombre, fecha, hora y preferencias.
- Conexión opcional con Google Sheets mediante una URL de Apps Script.
- Conexión opcional con una página de reservas de Google Calendar.

Los productos y precios incluidos son datos de demostración. Antes de publicar hay que
reemplazarlos por el inventario real.

## Cómo verlo localmente

No requiere instalar dependencias. Con Node.js disponible:

```powershell
npm start
```

Luego abrir `http://127.0.0.1:4173`.

## Arquitectura recomendada de costo cero

```text
Google Sheet privado (administración)
          │
          │ Apps Script expone solo campos comerciales
          ▼
      JSON público ──────────────┐
                                 ▼
Cloudinary (fotos) ───────► GitHub Pages (HTML/CSS/JS)
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
          WhatsApp pedido             Google Calendar citas
```

### Cuentas

1. Crear un Gmail exclusivo para el negocio, por ejemplo `auraessences...@gmail.com`.
   No usar la cuenta personal. El nombre y la foto de este perfil pueden aparecer en la
   página pública de reservas de Google Calendar.
2. Crear o usar una cuenta GitHub. El repositorio puede alojar el sitio con GitHub Pages.
3. Crear una cuenta Cloudinary para administrar las fotos. Supabase no es necesario en esta
   etapa; tendría sentido si más adelante se reemplaza Sheets por una base de datos real.
4. Usar Google Calendar desde la cuenta del negocio para crear una agenda de citas.

Nunca se comparte una contraseña. Si otra persona administrará el negocio, se la invita como
editora del Google Sheet y, si corresponde, como integrante de Cloudinary o colaboradora del
repositorio.

### Qué ve el comprador

El comprador ve el catálogo y la página pública de reservas. No puede abrir ni editar el
Google Sheet privado. Apps Script se ejecuta como el propietario y devuelve solamente los
campos elegidos en `google-sheets/Code.gs`.

No guardar en las pestañas expuestas:

- costos de compra;
- datos de proveedores;
- notas internas;
- teléfonos, correos o datos personales de clientes;
- credenciales o tokens.

## Configuración rápida

Editar [config.js](./config.js):

```js
window.AURA_CONFIG = {
  whatsappNumber: "59175070523",
  catalogEndpoint: "URL_DE_APPS_SCRIPT",
  bookingUrl: "URL_DE_PAGINA_DE_RESERVAS",
  calendarEmbedUrl: "URL_DEL_CALENDARIO_EMBEBIDO",
  locationUrl: "URL_DE_GOOGLE_MAPS",
  appointmentDurationMinutes: 60,
  businessHours: {
    weekday: "Lun–Vie · 09:00–17:00",
    weekend: "Sáb–Dom · 09:00–15:00",
  },
  currency: "BOB",
  locale: "es-BO",
};
```

- `catalogEndpoint` vacío: usa los datos de prueba de `data/products.js`.
- `catalogEndpoint` con URL: intenta cargar Google Sheets; si falla, conserva el catálogo
  local como respaldo.
- `bookingUrl` vacío: la cita se solicita por WhatsApp.
- `bookingUrl` con URL: además muestra el acceso directo a los horarios de Google Calendar.
- `calendarEmbedUrl`: muestra el calendario público dentro del formulario de cita.
- `locationUrl`: enlaza el local con Google Maps.

## Preparar Google Sheets

Usar **un solo archivo** de Google Sheets con dos pestañas:

### `Productos`

Una fila por perfume. Las columnas están en
`google-sheets/Productos-ejemplo.csv`.

| Campo | Uso |
| --- | --- |
| `id` | Identificador estable, sin espacios |
| `nombre` | Nombre visible |
| `marca` | Marca del perfume |
| `genero` | `mujer`, `hombre` o `unisex` |
| `familia` | Familia olfativa |
| `notas` | Notas separadas por `|` |
| `descripcion` | Texto breve de venta |
| `imagen_url` | URL pública de Cloudinary |
| `destacado` | Número para ordenar |
| `activo` | `SI` o `NO` |

### `Variantes`

Una fila por presentación vendible. Las columnas están en
`google-sheets/Variantes-ejemplo.csv`.

| Campo | Uso |
| --- | --- |
| `id` | Identificador de la variante dentro del perfume |
| `producto_id` | Debe coincidir con `Productos.id` |
| `tipo` | `decant`, `entero` o `parcial` |
| `etiqueta` | Ej. `Decant 5 ml` o `Parcial · quedan 70 ml` |
| `detalle` | Aclaración corta |
| `precio` | Número en bolivianos, sin `Bs.` |
| `stock` | Unidades disponibles; `0` significa agotado |
| `activo` | `SI` o `NO` |

Separar productos y variantes evita duplicar la descripción y la foto cada vez que un perfume
tiene decant de 5 ml, 10 ml, frasco y parcial.

## Publicar la API de Google Sheets

1. Crear las pestañas `Productos` y `Variantes` con esos encabezados exactos.
2. En la hoja abrir **Extensiones → Apps Script**.
3. Reemplazar el contenido por `google-sheets/Code.gs`.
4. Elegir **Implementar → Nueva implementación → Aplicación web**.
5. Configurar ejecución como el propietario de la cuenta de negocio y acceso para cualquier
   visitante.
6. Copiar la URL terminada en `/exec` y pegarla en `config.js` como `catalogEndpoint`.
7. Abrir esa URL en una pestaña privada: debe mostrar un objeto JSON con `products`.

La URL `/dev` es solo de prueba y requiere permiso de edición; la web pública debe usar `/exec`.

## Agendar catas sin compartir Gmail

En Google Calendar, desde un computador:

1. Crear una **agenda de citas** llamada `Cata de perfumes`.
2. Definir duración, días, horas, anticipación mínima y ubicación.
3. Copiar el enlace público de la página de reservas.
4. Pegar el enlace en `config.js` como `bookingUrl`.

El comprador usa esa página pública. No recibe acceso al calendario ni a Gmail. Las reservas
confirmadas aparecen como eventos en el calendario del negocio. Conviene que el perfil Google
muestre el nombre y logo de Aura Essences, porque la página pública puede mostrarlos.

La URL `calendar.google.com/calendar/embed?...` es un calendario embebido de consulta, no una
página que permita reservar automáticamente. El prototipo ya muestra ese calendario y envía la
solicitud por WhatsApp. Para que el cliente reserve un horario sin intervención manual se debe
crear una **agenda de citas** y colocar su enlace público en `bookingUrl`.

## Imágenes: Cloudinary o Supabase

Para este catálogo se recomienda Cloudinary:

- está especializado en fotos y entrega por CDN;
- permite organizar archivos y copiar una URL pública;
- el plan gratuito actual asigna 25 créditos mensuales combinados entre almacenamiento,
  transformaciones y ancho de banda.

Supabase Free incluye actualmente 1 GB de archivos, CDN básico y 5 GB de egreso en caché más
5 GB sin caché; no incluye transformaciones de imagen y los proyectos gratuitos pueden pausarse
tras una semana sin actividad. Es una buena opción cuando también se necesita Postgres,
autenticación o permisos complejos, pero sería una pieza adicional sin beneficio importante en
esta fase.

Las imágenes del prototipo vienen del HTML de referencia. Deben migrarse a una cuenta propia
antes del lanzamiento.

## Publicar en GitHub Pages

1. Crear un repositorio público en GitHub.
2. Subir estos archivos dejando `index.html` en la raíz.
3. En **Settings → Pages**, elegir publicación desde la rama principal y carpeta raíz.
4. Esperar la URL `https://USUARIO.github.io/REPOSITORIO/`.
5. Probar carrito, WhatsApp y agenda desde un teléfono.

GitHub Pages sirve directamente HTML, CSS y JavaScript, por lo que esta versión no necesita
Vercel, servidor Node en producción ni mantenimiento mensual.

## Antes del lanzamiento

- Reemplazar los datos de demostración y verificar precios/stock.
- Subir fotos propias y optimizadas.
- Confirmar ciudad, dirección y horarios de atención.
- Conectar la agenda pública de Google Calendar.
- Probar el texto de WhatsApp desde Android y iPhone.
- Agregar enlaces reales a Instagram y políticas básicas de cambios/privacidad.
- Inicializar Git, crear el repositorio y activar GitHub Pages.
