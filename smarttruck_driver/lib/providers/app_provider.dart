import 'package:flutter/foundation.dart';
import '../models/models.dart';
import '../data/mock_data.dart';

class AppProvider extends ChangeNotifier {
  int _activeTab = 0;
  late List<Parada> _paradas;
  late List<Pale> _pales;
  late List<Pedido> _pedidos;

  AppProvider() {
    _paradas = buildParadas();
    _pales = buildPales();
    _pedidos = buildPedidos();
  }

  int get activeTab => _activeTab;
  List<Parada> get paradas => _paradas;
  List<Pale> get pales => _pales;
  List<Pedido> get pedidos => _pedidos;

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

  List<Parada> get paradasPendientes => _paradas.where((p) => p.pendiente || p.activa).toList();
  List<Parada> get paradasCompletadas => _paradas.where((p) => p.completada).toList();

  int get totalParadas => _paradas.length;
  int get completadas => _paradas.where((p) => p.completada).length;
  int get pendientes => _paradas.where((p) => p.pendiente || p.activa).length;

  int get totalPales => _pales.length;
  int get totalPedidos => _pedidos.length;
  int get pedidosEntregados => _pedidos.where((p) => p.entregado).length;
  int get pedidosPendientes => _pedidos.where((p) => !p.entregado).length;

  List<Pedido> getPedidosByParada(int num) => _pedidos.where((p) => p.paradaNum == num).toList();

  List<dynamic> searchItems(String query) {
    if (query.isEmpty) return [];
    final q = query.toLowerCase();
    List<dynamic> results = [];
    results.addAll(_pedidos.where((p) => p.id.toLowerCase().contains(q) || p.referencia.toLowerCase().contains(q) || p.cliente.toLowerCase().contains(q)));
    results.addAll(_pales.where((p) => p.id.toLowerCase().contains(q)));
    return results;
  }

  void entregarPedido(String pedidoId) {
    final idx = _pedidos.indexWhere((p) => p.id == pedidoId);
    if (idx != -1 && !_pedidos[idx].entregado) {
      _pedidos[idx].estado = EstadoItem.entregado;
      // Deduct from palés
      for (var prod in _pedidos[idx].productos) {
        final paleIdx = _pales.indexWhere((p) => p.id == prod.paleId);
        if (paleIdx != -1) {
          _pales[paleIdx].elementosRestantes -= prod.cantidad;
          if (_pales[paleIdx].elementosRestantes < 0) {
            _pales[paleIdx].elementosRestantes = 0;
          }
        }
      }
      notifyListeners();
    }
  }

  void marcarLlegada(int paradaNum) {
    final idx = _paradas.indexWhere((p) => p.num == paradaNum);
    if (idx != -1) {
      _paradas[idx].estado = EstadoParada.completada;
      final next = _paradas.firstWhere((p) => p.pendiente, orElse: () => _paradas[idx]);
      if (next.pendiente) {
        next.estado = EstadoParada.activa;
      }
      notifyListeners();
    }
  }

  List<dynamic> get sugerenciasRecientes {
    return [_pedidos[0], _pedidos[1], _pales[0]];
  }
}
