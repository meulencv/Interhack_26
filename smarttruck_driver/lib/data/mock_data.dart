import '../models/models.dart';

List<Parada> buildParadas() => [
  Parada(
    num: 1,
    nombre: 'Bar Can Pepet',
    direccion: 'C/ de la Marina, 47 Barcelona',
    hora: '07:32',
    accesibilidad: 95,
    estado: EstadoParada.completada,
  ),
  Parada(
    num: 2,
    nombre: 'Hotel Arts Barcelona',
    direccion: 'Marina 19-21, Barcelona',
    hora: '08:10',
    accesibilidad: 88,
    estado: EstadoParada.completada,
  ),
  Parada(
    num: 3,
    nombre: 'Restaurante El Port',
    direccion: 'Moll de la Barceloneta 1, Barcelona',
    hora: '08:35',
    accesibilidad: 72,
    estado: EstadoParada.completada,
  ),
  Parada(
    num: 4,
    nombre: 'Cervecería Catalana',
    direccion: 'C/ Mallorca 236, Barcelona',
    hora: '09:18',
    accesibilidad: 90,
    estado: EstadoParada.activa,
  ),
  Parada(
    num: 5,
    nombre: 'Bar Marsella',
    direccion: 'C/ dels Escudellers 65, Barcelona',
    hora: '09:45',
    accesibilidad: 60,
    estado: EstadoParada.pendiente,
  ),
  Parada(
    num: 6,
    nombre: 'La Pepita',
    direccion: 'C/ del Parlament 25, Barcelona',
    hora: '10:15',
    accesibilidad: 85,
    estado: EstadoParada.pendiente,
  ),
  Parada(
    num: 7,
    nombre: 'Bodega Sepúlveda',
    direccion: 'C/ de Sepúlveda 173, Barcelona',
    hora: '10:50',
    accesibilidad: 78,
    estado: EstadoParada.pendiente,
  ),
];

List<Pale> buildPales() => [
  Pale(
    id: 'PAL-001',
    contenido: 'Bebidas Mixtas',
    elementosTotales: 120,
    elementosRestantes: 120,
    peso: '120 kg',
    volumen: '1,2 m³',
    fila: 0,
    columna: 0,
  ),
  Pale(
    id: 'PAL-002',
    contenido: 'Conservas',
    elementosTotales: 95,
    elementosRestantes: 95,
    peso: '95 kg',
    volumen: '1,0 m³',
    fila: 1,
    columna: 0,
  ),
  Pale(
    id: 'PAL-003',
    contenido: 'Lácteos',
    elementosTotales: 80,
    elementosRestantes: 80,
    peso: '80 kg',
    volumen: '0,9 m³',
    fila: 2,
    columna: 0,
  ),
  Pale(
    id: 'PAL-004',
    contenido: 'Vinos',
    elementosTotales: 50,
    elementosRestantes: 0,
    peso: '110 kg',
    volumen: '1,1 m³',
    fila: 0,
    columna: 1,
  ),
  Pale(
    id: 'PAL-005',
    contenido: 'Cervezas',
    elementosTotales: 130,
    elementosRestantes: 0,
    peso: '130 kg',
    volumen: '1,3 m³',
    fila: 1,
    columna: 1,
  ),
  Pale(
    id: 'PAL-006',
    contenido: 'Refrescos',
    elementosTotales: 100,
    elementosRestantes: 100,
    peso: '100 kg',
    volumen: '1,0 m³',
    fila: 2,
    columna: 1,
  ),
];

List<Pedido> buildPedidos() => [
  Pedido(
    id: 'PED-1001',
    paradaNum: 4,
    estado: EstadoItem.pendiente,
    cliente: 'Cervecería Catalana',
    referencia: 'REF-2024-1001',
    productos: [
      ProductoPedido(
        paleId: 'PAL-001',
        descripcion: 'Estrella Damm 33cl (Cajas)',
        cantidad: 10,
      ),
      ProductoPedido(
        paleId: 'PAL-006',
        descripcion: 'Coca-Cola 33cl (Cajas)',
        cantidad: 5,
      ),
    ],
  ),
  Pedido(
    id: 'PED-1002',
    paradaNum: 4,
    estado: EstadoItem.pendiente,
    cliente: 'Cervecería Catalana',
    referencia: 'REF-2024-1002',
    productos: [
      ProductoPedido(
        paleId: 'PAL-002',
        descripcion: 'Olivas La Española (Lotes)',
        cantidad: 2,
      ),
    ],
  ),
  Pedido(
    id: 'PED-1003',
    paradaNum: 5,
    estado: EstadoItem.pendiente,
    cliente: 'Bar Marsella',
    referencia: 'REF-2024-1003',
    productos: [
      ProductoPedido(
        paleId: 'PAL-001',
        descripcion: 'Voll-Damm 33cl (Cajas)',
        cantidad: 8,
      ),
    ],
  ),
  Pedido(
    id: 'PED-1004',
    paradaNum: 6,
    estado: EstadoItem.pendiente,
    cliente: 'La Pepita',
    referencia: 'REF-2024-1004',
    productos: [
      ProductoPedido(
        paleId: 'PAL-003',
        descripcion: 'Leche Pascual (Cajas)',
        cantidad: 15,
      ),
    ],
  ),
  Pedido(
    id: 'PED-1005',
    paradaNum: 7,
    estado: EstadoItem.pendiente,
    cliente: 'Bodega Sepúlveda',
    referencia: 'REF-2024-1005',
    productos: [
      ProductoPedido(
        paleId: 'PAL-001',
        descripcion: 'Agua Veri 1.5L (Cajas)',
        cantidad: 20,
      ),
      ProductoPedido(
        paleId: 'PAL-002',
        descripcion: 'Atún Claro (Cajas)',
        cantidad: 5,
      ),
    ],
  ),
  Pedido(
    id: 'PED-0999',
    paradaNum: 1,
    estado: EstadoItem.entregado,
    cliente: 'Bar Can Pepet',
    referencia: 'REF-2024-0999',
    productos: [
      ProductoPedido(
        paleId: 'PAL-004',
        descripcion: 'Vino Tinto (Cajas)',
        cantidad: 12,
      ),
    ],
  ),
  Pedido(
    id: 'PED-1000',
    paradaNum: 2,
    estado: EstadoItem.entregado,
    cliente: 'Hotel Arts',
    referencia: 'REF-2024-1000',
    productos: [
      ProductoPedido(
        paleId: 'PAL-005',
        descripcion: 'Cervezas Variadas (Lotes)',
        cantidad: 25,
      ),
    ],
  ),
];
