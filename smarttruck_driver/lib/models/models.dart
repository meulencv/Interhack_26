enum EstadoParada { completada, activa, pendiente }

enum TipoItem { pale, paquete }

enum EstadoItem { entregado, pendiente }

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

class Item {
  final String id;
  final TipoItem tipo;
  EstadoItem estado;
  final int paradaNum;
  final String contenido;
  final String peso;
  final String volumen;
  final String referencia;

  // Truck position
  final int? fila; // 0=delantera, 1=centro, 2=trasera
  final int? columna; // 0=izquierda, 1=derecha

  Item({
    required this.id,
    required this.tipo,
    required this.estado,
    required this.paradaNum,
    required this.contenido,
    required this.peso,
    required this.volumen,
    required this.referencia,
    this.fila,
    this.columna,
  });

  bool get esPale => tipo == TipoItem.pale;
  bool get esPaquete => tipo == TipoItem.paquete;
  bool get entregado => estado == EstadoItem.entregado;

  String get tipoLabel => tipo == TipoItem.pale ? 'Palé' : 'Paquete';
  String get estadoLabel => estado == EstadoItem.entregado ? 'Entregado' : 'Pendiente';

  String get ubicacionLabel {
    if (fila == null || columna == null) return 'Sin ubicación asignada';
    final filaStr = fila == 0 ? 'delantera' : fila == 1 ? 'central' : 'trasera';
    final colStr = columna == 0 ? 'Izquierda' : 'Derecha';
    final nivel = fila! + 1;
    return 'Zona $filaStr - $colStr / Nivel $nivel';
  }
}
