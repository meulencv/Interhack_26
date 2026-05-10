enum EstadoParada { completada, activa, pendiente }

enum EstadoItem { entregado, pendiente }

class Pale {
  final String id;
  final String contenido;
  final int elementosTotales;
  int elementosRestantes;
  final String peso;
  final String volumen;
  final int? fila;
  final int? columna;

  Pale({
    required this.id,
    required this.contenido,
    required this.elementosTotales,
    required this.elementosRestantes,
    required this.peso,
    required this.volumen,
    this.fila,
    this.columna,
  });

  bool get vacio => elementosRestantes <= 0;

  String get ubicacionLabel {
    if (fila == null || columna == null) return 'Sin ubicación asignada';
    final filaStr = fila == 0
        ? 'delantera'
        : fila == 1
        ? 'central'
        : 'trasera';
    final colStr = columna == 0 ? 'Izquierda' : 'Derecha';
    final nivel = fila! + 1;
    return 'Zona $filaStr - $colStr / Nivel $nivel';
  }
}

class ProductoPedido {
  final String paleId;
  final String descripcion;
  final num cantidad;
  final String unidadVenta;
  final double cajasEstadisticas;
  final String? remoteId;

  ProductoPedido({
    required this.paleId,
    required this.descripcion,
    required this.cantidad,
    this.unidadVenta = '',
    this.cajasEstadisticas = 0,
    this.remoteId,
  });
}

class Pedido {
  final String id;
  final String? remoteId;
  final String? remoteStopId;
  final int paradaNum;
  EstadoItem estado;
  final List<ProductoPedido> productos;
  final String referencia;
  final String cliente;

  Pedido({
    required this.id,
    this.remoteId,
    this.remoteStopId,
    required this.paradaNum,
    required this.estado,
    required this.productos,
    required this.referencia,
    required this.cliente,
  });

  bool get entregado => estado == EstadoItem.entregado;
}

class Parada {
  final int num;
  final String? remoteId;
  final String nombre;
  final String direccion;
  final String hora;
  final int accesibilidad;
  final double? latitude;
  final double? longitude;
  EstadoParada estado;

  Parada({
    required this.num,
    this.remoteId,
    required this.nombre,
    required this.direccion,
    required this.hora,
    required this.accesibilidad,
    this.latitude,
    this.longitude,
    required this.estado,
  });

  bool get completada => estado == EstadoParada.completada;
  bool get activa => estado == EstadoParada.activa;
  bool get pendiente => estado == EstadoParada.pendiente;
}
