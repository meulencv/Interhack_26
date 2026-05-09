import 'package:latlong2/latlong.dart';

enum StopStatus { completada, activa, pendiente }
enum PaletSide { izquierdo, derecho }
enum PaletPos { frontal, central, trasero }

class Producto {
  final String id;
  final String nombre;
  final int qty;
  final int paletId;
  final bool retornable;

  const Producto({
    required this.id,
    required this.nombre,
    required this.qty,
    required this.paletId,
    required this.retornable,
  });
}

class Retorno {
  final String id;
  final String nombre;
  final int qty;
  final int paletDestinoId;
  bool recogido;

  Retorno({
    required this.id,
    required this.nombre,
    required this.qty,
    required this.paletDestinoId,
    this.recogido = false,
  });
}

class Parada {
  final int id;
  final int num;
  final String nombre;
  final String tipo;
  final String direccion;
  final LatLng pos;
  final String eta;
  StopStatus estado;
  final int accesibilidad;
  final String? aiTexto;
  final bool aiAdvertencia;
  final List<Producto> productos;
  final List<Retorno> retornos;
  final double? kmSiguiente;
  final int? minSiguiente;
  String? tiempoReal;

  Parada({
    required this.id,
    required this.num,
    required this.nombre,
    required this.tipo,
    required this.direccion,
    required this.pos,
    required this.eta,
    required this.estado,
    required this.accesibilidad,
    this.aiTexto,
    this.aiAdvertencia = false,
    required this.productos,
    required this.retornos,
    this.kmSiguiente,
    this.minSiguiente,
    this.tiempoReal,
  });
}

class Palet {
  final int id;
  final PaletSide lado;
  final PaletPos pos;
  final String label;
  final String nombre;

  const Palet({
    required this.id,
    required this.lado,
    required this.pos,
    required this.label,
    required this.nombre,
  });
}

class DriverInfo {
  final String nombre;
  final String ruta;
  final String matricula;
  final String tipoVehiculo;
  final String zona;
  final String turnoInicio;
  final int totalZCE;

  const DriverInfo({
    required this.nombre,
    required this.ruta,
    required this.matricula,
    required this.tipoVehiculo,
    required this.zona,
    required this.turnoInicio,
    required this.totalZCE,
  });
}

// Truck pallet configurations
const palets6P = [
  Palet(id: 1, lado: PaletSide.izquierdo, pos: PaletPos.frontal,  label: 'I·F', nombre: 'Izq. Frontal'),
  Palet(id: 2, lado: PaletSide.izquierdo, pos: PaletPos.central,  label: 'I·C', nombre: 'Izq. Central'),
  Palet(id: 3, lado: PaletSide.izquierdo, pos: PaletPos.trasero,  label: 'I·T', nombre: 'Izq. Trasero'),
  Palet(id: 4, lado: PaletSide.derecho,   pos: PaletPos.frontal,  label: 'D·F', nombre: 'Der. Frontal'),
  Palet(id: 5, lado: PaletSide.derecho,   pos: PaletPos.central,  label: 'D·C', nombre: 'Der. Central'),
  Palet(id: 6, lado: PaletSide.derecho,   pos: PaletPos.trasero,  label: 'D·T', nombre: 'Der. Trasero'),
];

const palets8P = [
  Palet(id: 1, lado: PaletSide.izquierdo, pos: PaletPos.frontal,  label: 'I·1', nombre: 'Izq. Frente'),
  Palet(id: 2, lado: PaletSide.izquierdo, pos: PaletPos.central,  label: 'I·2', nombre: 'Izq. C.Front'),
  Palet(id: 3, lado: PaletSide.izquierdo, pos: PaletPos.central,  label: 'I·3', nombre: 'Izq. C.Tras'),
  Palet(id: 4, lado: PaletSide.izquierdo, pos: PaletPos.trasero,  label: 'I·4', nombre: 'Izq. Trasero'),
  Palet(id: 5, lado: PaletSide.derecho,   pos: PaletPos.frontal,  label: 'D·1', nombre: 'Der. Frente'),
  Palet(id: 6, lado: PaletSide.derecho,   pos: PaletPos.central,  label: 'D·2', nombre: 'Der. C.Front'),
  Palet(id: 7, lado: PaletSide.derecho,   pos: PaletPos.central,  label: 'D·3', nombre: 'Der. C.Tras'),
  Palet(id: 8, lado: PaletSide.derecho,   pos: PaletPos.trasero,  label: 'D·4', nombre: 'Der. Trasero'),
];
