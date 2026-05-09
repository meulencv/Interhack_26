import 'package:latlong2/latlong.dart';
import 'route_model.dart';

final driverInfo = const DriverInfo(
  nombre: 'Pedro Martínez',
  ruta: 'R-01',
  matricula: 'B-4521-KL',
  tipoVehiculo: '6P',
  zona: 'ZM040-BCN-01',
  turnoInicio: '06:30',
  totalZCE: 342,
);

List<Parada> buildMockParadas() => [
  Parada(
    id: 1, num: 1, estado: StopStatus.completada,
    nombre: 'BonPreu Diagonal',
    tipo: 'Supermercado',
    direccion: 'Av. Diagonal, 215',
    pos: const LatLng(41.3908, 2.1694),
    eta: '07:15', tiempoReal: '07:13',
    accesibilidad: 100,
    aiTexto: null,
    productos: const [
      Producto(id: 'p1', nombre: 'Estrella Damm 33cl ×24', qty: 4, paletId: 1, retornable: false),
      Producto(id: 'p2', nombre: 'Barril 30L Estrella Damm', qty: 2, paletId: 2, retornable: true),
    ],
    retornos: [
      Retorno(id: 'r1', nombre: 'Barriles 30L vacíos', qty: 2, paletDestinoId: 1, recogido: true),
    ],
    kmSiguiente: 2.3, minSiguiente: 8,
  ),
  Parada(
    id: 2, num: 2, estado: StopStatus.activa,
    nombre: 'Bar Can Pepet',
    tipo: 'Bar / Restaurante',
    direccion: "C/ de la Marina, 47",
    pos: const LatLng(41.3951, 2.1987),
    eta: '07:32',
    accesibilidad: 95,
    aiTexto: 'Mercancía en lateral IZQ zona central. Acceso directo, 0 recolocaciones.',
    productos: const [
      Producto(id: 'p3', nombre: 'Estrella Damm 1/3 ×20', qty: 3, paletId: 2, retornable: false),
      Producto(id: 'p4', nombre: 'Barril 30L Moritz', qty: 1, paletId: 3, retornable: true),
      Producto(id: 'p5', nombre: 'Voll-Damm 33cl ×24', qty: 2, paletId: 2, retornable: false),
    ],
    retornos: [
      Retorno(id: 'r2', nombre: 'Barriles 30L vacíos', qty: 1, paletDestinoId: 1),
    ],
    kmSiguiente: 1.8, minSiguiente: 7,
  ),
  Parada(
    id: 3, num: 3, estado: StopStatus.pendiente,
    nombre: 'Colmado Múrria',
    tipo: 'Colmado',
    direccion: "C/ Roger de Llúria, 85",
    pos: const LatLng(41.3932, 2.1687),
    eta: '07:50',
    accesibilidad: 88,
    aiTexto: 'Lateral DER zona frontal. Alta accesibilidad, prioritario.',
    productos: const [
      Producto(id: 'p6', nombre: 'Voll-Damm 1/5 ×12', qty: 4, paletId: 4, retornable: false),
      Producto(id: 'p7', nombre: 'Estrella de Levante 33cl ×24', qty: 2, paletId: 5, retornable: false),
    ],
    retornos: [],
    kmSiguiente: 2.1, minSiguiente: 9,
  ),
  Parada(
    id: 4, num: 4, estado: StopStatus.pendiente,
    nombre: 'Hotel Arts Barcelona',
    tipo: 'Hotel',
    direccion: 'C/ de la Marina, 19-21',
    pos: const LatLng(41.3863, 2.1976),
    eta: '08:10',
    accesibilidad: 72,
    aiTexto: 'Lateral DER zona trasera. Entrega antes de Restaurant El Port.',
    productos: const [
      Producto(id: 'p8', nombre: 'Barril 30L Estrella Damm', qty: 3, paletId: 5, retornable: true),
      Producto(id: 'p9', nombre: 'Moritz 33cl ×24', qty: 6, paletId: 6, retornable: false),
    ],
    retornos: [
      Retorno(id: 'r5', nombre: 'Barriles 30L vacíos', qty: 3, paletDestinoId: 2),
    ],
    kmSiguiente: 3.2, minSiguiente: 12,
  ),
  Parada(
    id: 5, num: 5, estado: StopStatus.pendiente,
    nombre: 'Restaurant El Port',
    tipo: 'Restaurante',
    direccion: 'Pg. Joan de Borbó, 12',
    pos: const LatLng(41.3776, 2.1874),
    eta: '08:35',
    accesibilidad: 65,
    aiTexto: '⚠️ Mercancía en zona trasera. Considera entregar después de Hotel Arts.',
    aiAdvertencia: true,
    productos: const [
      Producto(id: 'p10', nombre: 'Barril 20L Estrella Damm', qty: 2, paletId: 6, retornable: true),
      Producto(id: 'p11', nombre: 'Estrella Damm 33cl ×24', qty: 5, paletId: 6, retornable: false),
    ],
    retornos: [
      Retorno(id: 'r3', nombre: 'Barriles 20L vacíos', qty: 2, paletDestinoId: 4),
    ],
    kmSiguiente: 4.1, minSiguiente: 15,
  ),
  Parada(
    id: 6, num: 6, estado: StopStatus.pendiente,
    nombre: 'Supermercats Caprabo',
    tipo: 'Supermercado',
    direccion: "C/ de Provença, 225",
    pos: const LatLng(41.3934, 2.1610),
    eta: '09:00',
    accesibilidad: 90,
    aiTexto: 'Lateral IZQ zona frontal. Fácil acceso, poca mercancía.',
    productos: const [
      Producto(id: 'p12', nombre: 'Estrella Damm 33cl ×24', qty: 8, paletId: 1, retornable: false),
      Producto(id: 'p13', nombre: 'Barril 30L Estrella Damm', qty: 1, paletId: 3, retornable: true),
    ],
    retornos: [],
    kmSiguiente: 1.5, minSiguiente: 5,
  ),
  Parada(
    id: 7, num: 7, estado: StopStatus.pendiente,
    nombre: 'Cervecería Catalana',
    tipo: 'Bar / Restaurante',
    direccion: 'C/ Mallorca, 236',
    pos: const LatLng(41.3929, 2.1585),
    eta: '09:18',
    accesibilidad: 80,
    aiTexto: null,
    productos: const [
      Producto(id: 'p14', nombre: 'Voll-Damm 33cl ×24', qty: 6, paletId: 4, retornable: false),
      Producto(id: 'p15', nombre: 'Barril 20L Moritz', qty: 2, paletId: 5, retornable: true),
    ],
    retornos: [
      Retorno(id: 'r7', nombre: 'Barriles 20L vacíos', qty: 2, paletDestinoId: 3),
    ],
    kmSiguiente: null, minSiguiente: null,
  ),
];
