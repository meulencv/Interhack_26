import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/models.dart';

class SupabaseDemoRoute {
  final String routeId;
  final String routeCode;
  final List<Parada> paradas;
  final List<Pedido> pedidos;
  final List<Pale> pales;

  SupabaseDemoRoute({
    required this.routeId,
    required this.routeCode,
    required this.paradas,
    required this.pedidos,
    required this.pales,
  });
}

class SupabaseDemoService {
  static const url = 'https://xbymkwixdcmwciiepmjx.supabase.co';
  static const anonKey = 'sb_publishable_FHvAva9DO-btov_WYvH0_Q_Lh-i-9fb';
  static const routeCode = 'DR0031';

  bool get enabled => url.isNotEmpty && anonKey.isNotEmpty;

  Uri _uri(String path) =>
      Uri.parse('${url.replaceAll(RegExp(r'/$'), '')}/rest/v1/$path');

  Map<String, String> get _headers => {
    'apikey': anonKey,
    'Authorization': 'Bearer $anonKey',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  Future<List<dynamic>> _get(String path) async {
    if (!enabled) return [];
    final res = await http.get(_uri(path), headers: _headers);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Supabase ${res.statusCode}: ${res.body}');
    }
    return jsonDecode(res.body) as List<dynamic>;
  }

  Future<void> _patch(String path, Map<String, dynamic> body) async {
    if (!enabled) return;
    final res = await http.patch(
      _uri(path),
      headers: _headers,
      body: jsonEncode(body),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Supabase ${res.statusCode}: ${res.body}');
    }
  }

  Future<void> _post(String path, Map<String, dynamic> body) async {
    if (!enabled) return;
    final res = await http.post(
      _uri(path),
      headers: _headers,
      body: jsonEncode(body),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Supabase ${res.statusCode}: ${res.body}');
    }
  }

  Future<SupabaseDemoRoute?> fetchRoute() async {
    if (!enabled) return null;
    final routes = await _get(
      'routes?route_code=eq.$routeCode&select=id,route_code,status,total_zce',
    );
    if (routes.isEmpty) return null;
    final route = routes.first as Map<String, dynamic>;
    final routeId = route['id'] as String;

    final stopsRaw = await _get(
      'route_stops?route_id=eq.$routeId&select=id,stop_index,client_names,town,address,status,arrival_time,parking_optimization_reason,latitude,longitude&order=stop_index.asc',
    );
    final deliveriesRaw = await _get(
      'deliveries?route_id=eq.$routeId&select=id,external_delivery_id,stop_id,status,client_name,total_zce&order=created_at.asc',
    );

    final paradas = stopsRaw.map((raw) {
      final row = raw as Map<String, dynamic>;
      final names =
          (row['client_names'] as List?)
              ?.cast<dynamic>()
              .map((e) => '$e')
              .toList() ??
          const <String>[];
      final status = '${row['status'] ?? 'pending'}';
      final index = (row['stop_index'] as num?)?.toInt() ?? 0;
      return Parada(
        num: index,
        remoteId: row['id'] as String?,
        nombre: names.isNotEmpty ? names.join(' + ') : 'Parada $index',
        direccion: '${row['address'] ?? row['town'] ?? 'Ruta $routeCode'}',
        hora: '${row['arrival_time'] ?? '--:--'}'.substring(0, 5),
        accesibilidad: row['parking_optimization_reason'] == null ? 86 : 94,
        latitude: (row['latitude'] as num?)?.toDouble(),
        longitude: (row['longitude'] as num?)?.toDouble(),
        estado: status == 'completed'
            ? EstadoParada.completada
            : status == 'active' || status == 'arrived'
            ? EstadoParada.activa
            : EstadoParada.pendiente,
      );
    }).toList();

    if (paradas.isNotEmpty &&
        !paradas.any((p) => p.activa) &&
        paradas.any((p) => p.pendiente)) {
      paradas.firstWhere((p) => p.pendiente).estado = EstadoParada.activa;
    }

    final stopIndexById = {
      for (final p in paradas)
        if (p.remoteId != null) p.remoteId!: p.num,
    };
    final pedidos = deliveriesRaw.map((raw) {
      final row = raw as Map<String, dynamic>;
      final zce = ((row['total_zce'] as num?) ?? 0).round();
      final externalId = '${row['external_delivery_id'] ?? row['id']}';
      return Pedido(
        id: externalId,
        remoteId: row['id'] as String?,
        remoteStopId: row['stop_id'] as String?,
        paradaNum: stopIndexById[row['stop_id']] ?? 0,
        estado: row['status'] == 'delivered'
            ? EstadoItem.entregado
            : EstadoItem.pendiente,
        referencia: 'ZCE ${zce == 0 ? '-' : zce}',
        cliente: '${row['client_name'] ?? 'Cliente'}',
        productos: [
          ProductoPedido(
            paleId:
                'BOX-${(stopIndexById[row['stop_id']] ?? 0).toString().padLeft(2, '0')}',
            descripcion:
                'Entrega $externalId · ${zce == 0 ? 'contenido mixto' : '$zce ZCE'}',
            cantidad: zce == 0 ? 1 : zce,
            remoteId: row['id'] as String?,
          ),
        ],
      );
    }).toList();

    final pales = paradas.map((p) {
      final total = pedidos
          .where((pedido) => pedido.paradaNum == p.num)
          .fold<int>(
            0,
            (sum, pedido) =>
                sum +
                pedido.productos.fold<int>(0, (s, prod) => s + prod.cantidad),
          );
      final delivered = pedidos
          .where((pedido) => pedido.paradaNum == p.num && pedido.entregado)
          .fold<int>(
            0,
            (sum, pedido) =>
                sum +
                pedido.productos.fold<int>(0, (s, prod) => s + prod.cantidad),
          );
      return Pale(
        id: 'BOX-${p.num.toString().padLeft(2, '0')}',
        contenido: p.nombre,
        elementosTotales: total == 0 ? 1 : total,
        elementosRestantes: (total - delivered).clamp(
          0,
          total == 0 ? 1 : total,
        ),
        peso: '${((total == 0 ? 1 : total) * 2.4).round()} kg',
        volumen: '${((total == 0 ? 1 : total) * 0.02).toStringAsFixed(1)} m³',
        fila: (p.num - 1) ~/ 2,
        columna: (p.num - 1) % 2,
      );
    }).toList();

    return SupabaseDemoRoute(
      routeId: routeId,
      routeCode: routeCode,
      paradas: paradas,
      pedidos: pedidos,
      pales: pales,
    );
  }

  Future<void> markStopArrived(String routeId, Parada parada) async {
    if (parada.remoteId == null) return;
    await _patch('route_stops?id=eq.${parada.remoteId}', {'status': 'arrived'});
    await _post('driver_actions', {
      'route_id': routeId,
      'stop_id': parada.remoteId,
      'action_type': 'arrive_stop',
      'payload': {'source': 'flutter_demo', 'stop_index': parada.num},
    });
  }

  Future<void> completeDelivery(String routeId, Pedido pedido) async {
    if (pedido.remoteId == null) return;
    await _patch('deliveries?id=eq.${pedido.remoteId}', {
      'status': 'delivered',
    });
    await _patch('delivery_items?delivery_id=eq.${pedido.remoteId}', {
      'status': 'delivered',
    });
    await _post('driver_actions', {
      'route_id': routeId,
      'stop_id': pedido.remoteStopId,
      'delivery_id': pedido.remoteId,
      'action_type': 'complete_delivery',
      'payload': {'source': 'flutter_demo', 'external_delivery_id': pedido.id},
    });
  }

  Future<void> markStopCompleted(String routeId, String stopId) async {
    await _patch('route_stops?id=eq.$stopId', {'status': 'completed'});
    await _post('driver_actions', {
      'route_id': routeId,
      'stop_id': stopId,
      'action_type': 'complete_stop',
      'payload': {'source': 'flutter_demo'},
    });
  }

  Future<void> reportDelay(
    String routeId, {
    String? stopId,
    String title = 'Incidencia desde app camionero',
    String description = 'El conductor ha reportado una incidencia en ruta.',
  }) async {
    await _post('operational_events', {
      'event_type': 'delivery_delay',
      'severity': 'medium',
      'route_id': routeId,
      'stop_id': stopId,
      'title': title,
      'description': description,
      'payload': {'source': 'flutter_demo'},
    });
  }
}
