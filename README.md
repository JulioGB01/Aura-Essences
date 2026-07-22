# Aura Essences

> Catálogo estático de perfumería con carrito de consulta por WhatsApp y solicitudes de cata.

Aura Essences es una tienda web ligera pensada para mostrar un catálogo curado, consultar disponibilidad y convertir el interés del cliente en un pedido claro por WhatsApp. No procesa pagos ni almacena datos de clientes en un servidor propio.

## Funcionalidades

- Catálogo responsive con búsqueda, filtros y ordenamiento.
- Fichas de producto con variantes, precio referencial y disponibilidad.
- Carrito persistente en el navegador.
- Pedido prellenado para WhatsApp.
- Solicitud de cata y enlace opcional a una agenda pública.
- Catálogo local de respaldo y carga opcional desde Google Sheets mediante Apps Script.

## Vista local

No requiere instalación de dependencias de producción. Con Node.js disponible:

```powershell
npm start
```

Después, abre `http://127.0.0.1:4173`.

## Configuración pública

Los enlaces comerciales se centralizan en [`config.js`](config.js): número de WhatsApp, endpoint público del catálogo, agenda o calendario público, ubicación, horarios, moneda y formato regional.

Nunca subas contraseñas, tokens, datos de clientes, costos de compra ni información de proveedores. Si usas Google Sheets, el endpoint público debe exponer únicamente los campos que un comprador pueda ver.

## Datos del catálogo

- [`data/products.js`](data/products.js) contiene los datos de respaldo para desarrollo y demostración.
- [`google-sheets/Productos-ejemplo.csv`](google-sheets/Productos-ejemplo.csv) y [`google-sheets/Variantes-ejemplo.csv`](google-sheets/Variantes-ejemplo.csv) documentan la estructura esperada.
- [`google-sheets/Code.gs`](google-sheets/Code.gs) es una implementación opcional para publicar datos comerciales desde Google Sheets.

Antes de lanzar el sitio, reemplaza todos los productos, precios, stock e imágenes de ejemplo por información verificada y autorizada.

## Estructura

```text
.
├── index.html              # Punto de entrada del catálogo
├── styles.css              # Diseño responsive
├── app.js                  # Interfaz, carrito y enlaces de consulta
├── config.js               # Configuración comercial pública
├── data/                   # Catálogo local de respaldo
├── google-sheets/          # Ejemplos y endpoint opcional
└── tools/dev-server.mjs    # Servidor local de desarrollo
```

## Publicación

El proyecto puede alojarse en GitHub Pages o en cualquier hosting estático. Para GitHub Pages, publica la rama `main` desde la carpeta raíz y valida, antes de anunciarlo, la navegación móvil, el carrito, el texto de WhatsApp, los enlaces de agenda y los datos visibles del catálogo.

## Contribuciones

Consulta [`CONTRIBUTING.md`](CONTRIBUTING.md) antes de abrir un issue o pull request.