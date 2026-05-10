import 'package:flutter/foundation.dart';
import '../models/models.dart';
import '../data/mock_data.dart';
import '../services/supabase_demo_service.dart';

class AppProvider extends ChangeNotifier {
  int _activeTab = 0;
  late List<Parada> _paradas;
  late List<Pale> _pales;
  late List<Pedido> _pedidos;
  final SupabaseDemoService _supabase = SupabaseDemoService();
  String? _routeId;
  String _connectionLabel = 'Modo simulador';
  bool _loadingRemote = false;

  AppProvider() {
    _paradas = buildParadas();
    _pales = buildPales();
    _pedidos = buildPedidos();
    refreshRemoteRoute();
  }

  int get activeTab => _activeTab;
  List<Parada> get paradas => _paradas;
  List<Pale> get pales => _pales;
  List<Pedido> get pedidos => _pedidos;
  bool get supabaseEnabled => _supabase.enabled;
  bool get loadingRemote => _loadingRemote;
  String get connectionLabel => _connectionLabel;

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

  int get totalPales => _pales.length;
  int get totalPedidos => _pedidos.length;
  int get pedidosEntregados => _pedidos.where((p) => p.entregado).length;
  int get pedidosPendientes => _pedidos.where((p) => !p.entregado).length;

  List<Pedido> getPedidosByParada(int num) =>
      _pedidos.where((p) => p.paradaNum == num).toList();

  List<dynamic> searchItems(String query) {
    if (query.isEmpty) return [];
    final q = query.toLowerCase();
    List<dynamic> results = [];
    results.addAll(
      _pedidos.where(
        (p) =>
            p.id.toLowerCase().contains(q) ||
            p.referencia.toLowerCase().contains(q) ||
            p.cliente.toLowerCase().contains(q),
      ),
    );
    results.addAll(_pales.where((p) => p.id.toLowerCase().contains(q)));
    return results;
  }

  Future<void> refreshRemoteRoute() async {
    if (!_supabase.enabled) return;
    _loadingRemote = true;
    notifyListeners();
    try {
      final route = await _supabase.fetchRoute();
      if (route != null) {
        _routeId = route.routeId;
        _paradas = route.paradas;
        _pedidos = route.pedidos;
        _pales = route.pales;
        _connectionLabel = 'Supabase · ${route.routeCode}';
      } else {
        _connectionLabel = 'Supabase sin ruta demo';
      }
    } catch (error) {
      _connectionLabel = 'Supabase error';
    } finally {
      _loadingRemote = false;
      notifyListeners();
    }
  }

  Future<void> entregarPedido(String pedidoId) async {
    final idx = _pedidos.indexWhere((p) => p.id == pedidoId);
    if (idx != -1 && !_pedidos[idx].entregado) {
      final pedido = _pedidos[idx];
      _pedidos[idx].estado = EstadoItem.entregado;
      final stopIsComplete = _pedidos
          .where((p) => p.paradaNum == pedido.paradaNum)
          .every((p) => p.entregado || p.id == pedido.id);
      if (stopIsComplete) {
        final paradaIdx = _paradas.indexWhere((p) => p.num == pedido.paradaNum);
        if (paradaIdx != -1) {
          _paradas[paradaIdx].estado = EstadoParada.completada;
        }
      }
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
      if (_supabase.enabled && _routeId != null) {
        try {
          await _supabase.completeDelivery(_routeId!, pedido);
          if (stopIsComplete && pedido.remoteStopId != null) {
            await _supabase.markStopCompleted(_routeId!, pedido.remoteStopId!);
          }
          await refreshRemoteRoute();
        } catch (_) {
          _connectionLabel = 'Supabase error al entregar';
          notifyListeners();
        }
      }
    }
  }

  Future<void> marcarLlegada(int paradaNum) async {
    final idx = _paradas.indexWhere((p) => p.num == paradaNum);
    if (idx != -1) {
      final parada = _paradas[idx];
      _paradas[idx].estado = EstadoParada.activa;
      notifyListeners();
      if (_supabase.enabled && _routeId != null) {
        try {
          await _supabase.markStopArrived(_routeId!, parada);
          await refreshRemoteRoute();
        } catch (_) {
          _connectionLabel = 'Supabase error al llegar';
          notifyListeners();
        }
      }
    }
  }

  Future<void> notificarIncidencia([String? detalle]) async {
    if (!_supabase.enabled || _routeId == null) return;
    try {
      await _supabase.reportDelay(
        _routeId!,
        stopId: paradaActiva?.remoteId,
        title: 'Incidencia reportada por conductor',
        description:
            detalle ?? 'El conductor solicita recalculo de ruta desde la app.',
      );
      _connectionLabel = 'Incidencia enviada';
      notifyListeners();
    } catch (_) {
      _connectionLabel = 'Error enviando incidencia';
      notifyListeners();
    }
  }

  List<dynamic> get sugerenciasRecientes {
    return [_pedidos[0], _pedidos[1], _pales[0]];
  }
}
