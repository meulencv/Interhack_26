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
    final filaStr = fila == 0 ? 'delantera' : fila == 1 ? 'central' : 'trasera';
    final colStr = columna == 0 ? 'Izquierda' : 'Derecha';
    final nivel = fila! + 1;
    return 'Zona $filaStr - $colStr / Nivel $nivel';
  }
}

class ProductoPedido {
  final String paleId;
  final String descripcion;
  final int cantidad;
  ProductoPedido({required this.paleId, required this.descripcion, required this.cantidad});
}

class Pedido {
  final String id;
  final int paradaNum;
  EstadoItem estado;
  final List<ProductoPedido> productos;
  final String referencia;
  final String cliente;

  Pedido({
    required this.id,
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
  final String nombre;
  final String direccion;
  final String hora;
  final int accesibilidad;
  EstadoParada estado;

  Parada({
    required this.num,
    required this.nombre,
    required this.direccion,
    required this.hora,
    required this.accesibilidad,
    required this.estado,
  });

  bool get completada => estado == EstadoParada.completada;
  bool get activa => estado == EstadoParada.activa;
  bool get pendiente => estado == EstadoParada.pendiente;
}
