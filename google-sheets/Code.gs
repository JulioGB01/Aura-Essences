/**
 * API pública de solo lectura para Aura Essences.
 * Este script debe estar vinculado al Google Sheet del negocio.
 */
function doGet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var productRows = sheetToObjects_(spreadsheet.getSheetByName('Productos'));
  var variantRows = sheetToObjects_(spreadsheet.getSheetByName('Variantes'));

  var variantsByProduct = {};
  variantRows.forEach(function (row) {
    if (!isEnabled_(row.activo) || !row.producto_id) return;
    var productId = String(row.producto_id).trim();
    if (!variantsByProduct[productId]) variantsByProduct[productId] = [];
    variantsByProduct[productId].push({
      id: String(row.id || '').trim(),
      type: normalizeType_(row.tipo),
      label: String(row.etiqueta || '').trim(),
      detail: String(row.detalle || '').trim(),
      price: toNumber_(row.precio),
      stock: Math.max(0, Math.floor(toNumber_(row.stock))),
    });
  });

  var products = productRows
    .filter(function (row) {
      return isEnabled_(row.activo) && row.id && row.nombre;
    })
    .map(function (row, index) {
      var id = String(row.id).trim();
      return {
        id: id,
        name: String(row.nombre || '').trim(),
        brand: String(row.marca || 'Aura Essences').trim(),
        gender: normalizeGender_(row.genero),
        family: String(row.familia || 'Perfumería selecta').trim(),
        notes: String(row.notas || '')
          .split('|')
          .map(function (note) { return note.trim(); })
          .filter(String),
        description: String(row.descripcion || '').trim(),
        image: String(row.imagen_url || '').trim(),
        featured: toNumber_(row.destacado) || index + 1,
        variants: variantsByProduct[id] || [],
      };
    });

  return ContentService
    .createTextOutput(JSON.stringify({
      products: products,
      updatedAt: new Date().toISOString(),
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetToObjects_(sheet) {
  if (!sheet) throw new Error('Falta la pestaña Productos o Variantes.');
  var values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  var headers = values.shift().map(function (header) {
    return String(header).trim().toLowerCase();
  });
  return values.map(function (row) {
    var object = {};
    headers.forEach(function (header, index) {
      if (header) object[header] = row[index];
    });
    return object;
  });
}

function isEnabled_(value) {
  var normalized = String(value == null ? '' : value).trim().toLowerCase();
  return !['no', 'false', '0', 'inactivo'].includes(normalized);
}

function normalizeGender_(value) {
  var normalized = String(value || '').trim().toLowerCase();
  return ['mujer', 'hombre', 'unisex'].includes(normalized) ? normalized : 'unisex';
}

function normalizeType_(value) {
  var normalized = String(value || '').trim().toLowerCase();
  return ['decant', 'entero', 'parcial'].includes(normalized) ? normalized : 'entero';
}

function toNumber_(value) {
  var normalized = String(value == null ? '' : value)
    .replace(/\s/g, '')
    .replace(',', '.');
  var number = Number(normalized);
  return isFinite(number) ? number : 0;
}
