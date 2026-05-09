import 'package:flutter/foundation.dart';
import '../models/route_model.dart';
import '../models/mock_data.dart';

enum DeliveryPhase { idle, arriving, delivering, returnsPhase, done }

class RouteProvider extends ChangeNotifier {
  final List<Parada> paradas = buildMockParadas();
  DeliveryPhase phase = DeliveryPhase.idle;
  List<String> chatMessages = [];
  bool copilotOpen = false;
  int activeTab = 0;

  Parada? get paradaActiva =>
      paradas.where((p) => p.estado == StopStatus.activa).firstOrNull;

  Parada? get proximaParada {
    final pendientes = paradas.where((p) => p.estado == StopStatus.pendiente).toList();
    return pendientes.isEmpty ? null : pendientes.first;
  }

  int get completadas => paradas.where((p) => p.estado == StopStatus.completada).length;
  int get total => paradas.length;

  List<Palet> get paletsConfig => palets6P;

  /// Get the semantic state of a palet for visualization
  String paletState(int paletId) {
    final activa = paradaActiva;
    if (activa == null) return 'libre';

    final isActiveDelivery = activa.productos.any((p) => p.paletId == paletId);
    final isReturnDst = phase == DeliveryPhase.returnsPhase &&
        activa.retornos.any((r) => r.paletDestinoId == paletId && !r.recogido);
    final isPending = paradas
        .where((p) => p.estado == StopStatus.pendiente)
        .any((p) => p.productos.any((prod) => prod.paletId == paletId));

    if (isActiveDelivery && phase == DeliveryPhase.delivering) return 'activo';
    if (isReturnDst) return 'retorno';
    if (isPending) return 'pendiente';
    return 'libre';
  }

  List<Producto> productosEnPalet(int paletId) {
    final activa = paradaActiva;
    if (activa == null) return [];
    return activa.productos.where((p) => p.paletId == paletId).toList();
  }

  /// Driver taps "LLEGUÉ" button
  void marcarLlegada() {
    phase = DeliveryPhase.delivering;
    notifyListeners();
  }

  /// Driver completes the delivery
  void completarEntrega() {
    final activa = paradaActiva;
    if (activa == null) return;

    if (activa.retornos.any((r) => !r.recogido)) {
      phase = DeliveryPhase.returnsPhase;
    } else {
      _avanzarParada(activa);
    }
    notifyListeners();
  }

  /// Driver confirms returns placed
  void confirmarRetornos() {
    final activa = paradaActiva;
    if (activa == null) return;
    for (var r in activa.retornos) {
      r.recogido = true;
    }
    _avanzarParada(activa);
    notifyListeners();
  }

  void _avanzarParada(Parada activa) {
    activa.estado = StopStatus.completada;
    phase = DeliveryPhase.idle;
    final proximas = paradas.where((p) => p.estado == StopStatus.pendiente).toList();
    if (proximas.isNotEmpty) {
      proximas.first.estado = StopStatus.activa;
    }
  }

  void cancelarModal() {
    phase = DeliveryPhase.idle;
    notifyListeners();
  }

  void setTab(int tab) {
    activeTab = tab;
    notifyListeners();
  }

  void addChatMessage(String msg) {
    chatMessages.add(msg);
    notifyListeners();
  }

  void toggleCopilot() {
    copilotOpen = !copilotOpen;
    notifyListeners();
  }
}
