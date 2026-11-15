// Configuración de la carga por voz: palabras que apuntan a una categoría o a un medio de pago.
// Este archivo es solo una lista: se puede editar sin tocar la lógica (js/voz-interpretar.js).
//
// Cómo funciona:
// - El nombre de cada categoría, medio y vehículo ya se reconoce solo; acá van las palabras EXTRA.
// - Escribí en minúsculas; las tildes y los plurales no importan ("súper" = "super", "peajes" = "peaje").
// - Una entrada puede tener varias palabras ("estacion de servicio").
// - Si una palabra apunta a dos categorías distintas, la app no elige: muestra las dos como opciones.
// - Las claves de `categorias` son el nombre de la categoría tal como figura en Ajustes. Si renombrás
//   una categoría, cambiá también la clave acá. Las claves "tipo:…" siguen a las categorías especiales
//   de vehículos aunque les cambies el nombre.

export const SINONIMOS = {
  // Palabras sueltas que nunca cuentan como categoría, aunque coincidan con un nombre ("otro café" no es el rubro Otros).
  ignorar: ['otro', 'otros', 'varios', 'gasto', 'gastos'],

  categorias: {
    'tipo:combustible': ['nafta', 'combustible', 'ypf', 'shell', 'axion', 'puma', 'gasoil', 'diesel', 'gnc', 'carga', 'estacion de servicio'],
    'tipo:mantenimiento': ['mecanico', 'taller', 'gomeria', 'lavadero', 'service'],

    'Supermercado': ['super', 'supermercado', 'coto', 'carrefour', 'jumbo', 'disco', 'vea', 'changomas', 'la anonima', 'mayorista'],
    'Almacén y verdulería': ['verdura', 'fruta', 'despensa'],
    'Carnicería': ['carne', 'pollo'],
    'Delivery': ['pedidosya', 'pedidos ya', 'rappi'],
    'Restaurante': ['restaurant', 'parrilla'],
    'Café y snacks': ['cafeteria', 'kiosco', 'medialunas'],

    'Transporte público': ['colectivo', 'bondi', 'subte', 'tren', 'sube'],
    'Taxi / Uber': ['cabify', 'didi', 'remis'],
    'Peajes y estacionamiento': ['cochera', 'parking'],
    'Seguro auto': ['seguro del auto'],

    'Luz': ['edenor', 'edesur', 'epec'],
    'Gas': ['metrogas', 'ecogas'],
    'Agua': ['aysa'],
    'Internet': ['wifi', 'fibertel'],
    'Celular': ['telefono', 'movistar'],
    'Streaming y suscripciones': ['netflix', 'spotify', 'disney', 'youtube', 'hbo'],

    'Prepaga / obra social': ['osde', 'swiss medical'],
    'Farmacia': ['remedio', 'medicamento', 'farmacity'],
    'Consultas': ['medico', 'dentista', 'odontologo'],
    'Gimnasio y deporte': ['gym'],

    'Ropa': ['remera', 'pantalon', 'campera'],
    'Calzado': ['zapatillas', 'zapatos'],
    'Peluquería y cuidado personal': ['barberia', 'corte de pelo'],

    'Salidas': ['cine', 'bar', 'boliche', 'teatro'],
    'Viajes': ['pasaje', 'hotel'],
    'Veterinario': ['veterinaria'],
    'Alimento': ['alimento balanceado', 'comida del perro', 'comida del gato'],
    'Impuestos': ['afip', 'arca', 'monotributo', 'abl'],
  },

  // Medios de pago. `tipos` apunta a todos los medios de ese tipo (efectivo, debito, credito,
  // transferencia, billetera); `nombre` apunta a un medio puntual tal como figura en Ajustes.
  medios: [
    { tipos: ['efectivo'], palabras: ['efectivo', 'cash', 'billete'] },
    { tipos: ['debito'], palabras: ['debito', 'tarjeta de debito'] },
    { tipos: ['credito'], palabras: ['credito', 'tarjeta de credito'] },
    { tipos: ['credito', 'debito'], palabras: ['tarjeta'] },
    { tipos: ['transferencia'], palabras: ['transferencia', 'transferi'] },
    { tipos: ['billetera'], palabras: ['billetera', 'qr'] },
    { nombre: 'Mercado Pago', palabras: ['mercadopago', 'mp'] },
  ],
};
