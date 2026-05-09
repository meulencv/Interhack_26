import 'package:flutter/foundation.dart';
import '../models/models.dart';
import '../data/mock_data.dart';

class AppProvider extends ChangeNotifier {
  int _activeTab = 0;
  late List<Parada> _paradas;
  late List<Item> _items;

  AppProvider() {
    _paradas = buildParadas();
    _items = buildItems();
  }

  int get activeTab => _activeTab;
  List<Parada> get paradas => _paradas;
  List<Item> get items => _items;

  void setTab(int tab) {
    _activeTab = tab;
    notifyListeners();
  }

  Parada? get paradaActiva {
    try {
      return _paradas.firstWhere((p) => p.activa);
    } catch (_) {
      return null;
    }
  }

  List<Parada> get paradasPendientes =>
      _paradas.where((p) => p.pendiente || p.activa).toList();

  List<Parada> get paradasCompletadas =>
      _paradas.where((p) => p.completada).toList();

  int get totalParadas => _paradas.length;
  int get completadas => _paradas.where((p) => p.completada).length;
  int get pendientes => _paradas.where((p) => p.pendiente || p.activa).length;

  int get totalPales => _items.where((i) => i.esPale).length;
  int get totalPaquetes => _items.where((i) => i.esPaquete).length;
  int get itemsEntregados => _items.where((i) => i.entregado).length;
  int get itemsPendientes => _items.where((i) => !i.entregado).length;

  List<Item> getItemsByParada(int num) =>
      _items.where((i) => i.paradaNum == num).toList();

  List<Item> searchItems(String query) {
    if (query.isEmpty) return [];
    final q = query.toLowerCase();
    return _items
        .where((i) =>
            i.id.toLowerCase().contains(q) ||
            i.referencia.toLowerCase().contains(q))
        .toList();
  }

  void marcarEntregado(String itemId) {
    final idx = _items.indexWhere((i) => i.id == itemId);
    if (idx != -1) {
      _items[idx].estado = EstadoItem.entregado;
      notifyListeners();
    }
  }

  void marcarLlegada(int paradaNum) {
    final idx = _paradas.indexWhere((p) => p.num == paradaNum);
    if (idx != -1) {
      _paradas[idx].estado = EstadoParada.completada;
      // Set next pending as active
      final next = _paradas.firstWhere(
        (p) => p.pendiente,
        orElse: () => _paradas[idx],
      );
      if (next.pendiente) {
        next.estado = EstadoParada.activa;
      }
      notifyListeners();
    }
  }

  // Recent search suggestions (static mock)
  List<Item> get sugerenciasRecientes {
    final ids = ['PAL-001', 'PKG-045', 'PKG-102', 'PAL-003'];
    return ids.map((id) => _items.firstWhere((i) => i.id == id)).toList();
  }
}
