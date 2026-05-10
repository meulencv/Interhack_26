import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../providers/app_provider.dart';
import '../data/demo_route.dart';
import 'parada_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // AppBar row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'SmartTruck DDI',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.green.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: AppColors.green.withOpacity(0.4),
                        width: 1,
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: AppColors.green,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Text(
                          'En ruta',
                          style: TextStyle(
                            color: AppColors.green,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 32),

              // Greeting
              const Text(
                'Buenas, Pedro',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 34,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Tienes ${provider.totalParadas} paradas hoy',
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 10),
              GestureDetector(
                onTap: provider.refreshRemoteRoute,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: provider.supabaseEnabled
                        ? AppColors.blue.withOpacity(0.12)
                        : AppColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: provider.supabaseEnabled
                          ? AppColors.blue.withOpacity(0.35)
                          : AppColors.border,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        provider.supabaseEnabled ? Icons.sync : Icons.route,
                        size: 16,
                        color: provider.supabaseEnabled
                            ? AppColors.blue
                            : AppColors.textMuted,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        provider.loadingRemote
                            ? 'Sincronizando ruta...'
                            : provider.connectionLabel,
                        style: TextStyle(
                          color: provider.supabaseEnabled
                              ? AppColors.blue
                              : AppColors.textSecondary,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 28),

              _RouteMapCard(provider: provider),
              const SizedBox(height: 18),

              // Stat cards
              _StatCard(
                icon: Icons.location_on,
                iconColor: AppColors.blue,
                value: '${provider.totalParadas}',
                label: 'Paradas',
                linkLabel: 'Ver ruta',
                onTap: () {
                  context.read<AppProvider>().setTab(1);
                },
              ),
              const SizedBox(height: 12),
              _StatCard(
                icon: Icons.check_circle,
                iconColor: AppColors.green,
                value: '${provider.completadas}',
                label: 'Entregadas',
                linkLabel: 'Ver completadas',
                onTap: () {
                  context.read<AppProvider>().setTab(1);
                },
              ),
              const SizedBox(height: 12),
              _StatCard(
                icon: Icons.inventory_2,
                iconColor: AppColors.orange,
                value: '${provider.pendientes}',
                label: 'Pendientes',
                linkLabel: 'Ver pendientes',
                onTap: () {
                  context.read<AppProvider>().setTab(1);
                },
              ),
              const SizedBox(height: 28),

              // Parada activa card
              if (provider.paradaActiva != null) ...[
                const Text(
                  'Parada actual',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) =>
                            ParadaScreen(parada: provider.paradaActiva!),
                      ),
                    );
                  },
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                    ),
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: AppColors.primaryYellow.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.local_shipping,
                            color: AppColors.primaryYellow,
                            size: 26,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                provider.paradaActiva!.nombre,
                                style: const TextStyle(
                                  color: AppColors.textPrimary,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                provider.paradaActiva!.direccion,
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Column(
                          children: [
                            Text(
                              provider.paradaActiva!.hora,
                              style: const TextStyle(
                                color: AppColors.primaryYellow,
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const Icon(
                              Icons.chevron_right,
                              color: AppColors.textMuted,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _RouteMapCard extends StatefulWidget {
  final AppProvider provider;

  const _RouteMapCard({required this.provider});

  @override
  State<_RouteMapCard> createState() => _RouteMapCardState();
}

class _RouteMapCardState extends State<_RouteMapCard> {
  final MapController _mapController = MapController();
  Timer? _timer;
  double _pathIndex = 0.0;
  bool _flipTruck = false;

  static const _tickMs = 33; // ~30 fps for smooth movement
  static const double _stepSize = 0.002; // Very slow, real-time speed

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: _tickMs), _tick);
  }

  void _tick(Timer _) {
    if (!mounted) return;

    final nextIndex = (_pathIndex + _stepSize) % kDemoRoutePath.length;

    final currFloor = _pathIndex.floor() % kDemoRoutePath.length;
    final nextFloor = nextIndex.floor() % kDemoRoutePath.length;

    bool flip = _flipTruck;
    if (currFloor != nextFloor) {
      final currPt = kDemoRoutePath[currFloor];
      final nextPt = kDemoRoutePath[nextFloor];
      flip = nextPt.longitude < currPt.longitude;
    }

    setState(() {
      _pathIndex = nextIndex;
      _flipTruck = flip;
    });
    // Keep map centered on truck
    try {
      _mapController.move(_truckPos, _mapController.camera.zoom);
    } catch (_) {}
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  LatLng get _truckPos {
    int curr = _pathIndex.floor() % kDemoRoutePath.length;
    int next = (curr + 1) % kDemoRoutePath.length;
    double t = _pathIndex - _pathIndex.floor();

    final p1 = kDemoRoutePath[curr];
    final p2 = kDemoRoutePath[next];

    return LatLng(
      p1.latitude + (p2.latitude - p1.latitude) * t,
      p1.longitude + (p2.longitude - p1.longitude) * t,
    );
  }

  @override
  Widget build(BuildContext context) {
    final active = widget.provider.paradaActiva;
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.map_outlined, color: AppColors.blue, size: 20),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Mapa de ruta',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Text(
                widget.provider.connectionLabel,
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 220,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Stack(
                children: [
                  FlutterMap(
                    mapController: _mapController,
                    options: MapOptions(
                      initialCenter: kDemoCenter,
                      initialZoom: 16.5,
                      interactionOptions: const InteractionOptions(
                        flags: InteractiveFlag.none,
                      ),
                    ),
                    children: [
                      TileLayer(
                        urlTemplate:
                            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        userAgentPackageName: 'com.smarttruck.driver',
                        tileDisplay: const TileDisplay.fadeIn(),
                      ),
                      PolylineLayer(
                        polylines: [
                          Polyline(
                            points: kDemoRoutePath,
                            color: const Color(0xFF3B82F6),
                            strokeWidth: 3.5,
                          ),
                        ],
                      ),
                      CircleLayer(
                        circles: kDemoRouteStops
                            .map(
                              (p) => CircleMarker(
                                point: p,
                                radius: 5,
                                color: const Color(0xFF3B82F6),
                                borderColor: Colors.white,
                                borderStrokeWidth: 1.5,
                              ),
                            )
                            .toList(),
                      ),
                      MarkerLayer(
                        markers: [
                          Marker(
                            point: _truckPos,
                            width: 64,
                            height: 46,
                            child: Transform.scale(
                              scaleX: _flipTruck ? -1.0 : 1.0,
                              child: Image.asset(
                                'assets/truck.png',
                                fit: BoxFit.contain,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  // Info overlay bottom-left
                  Positioned(
                    bottom: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.background.withOpacity(0.82),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Text(
                        active == null
                            ? 'Ruta completada'
                            : 'Ahora: parada ${active.num} · ${active.hora}',
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String value;
  final String label;
  final String linkLabel;
  final VoidCallback onTap;

  const _StatCard({
    required this.icon,
    required this.iconColor,
    required this.value,
    required this.label,
    required this.linkLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.15),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: iconColor, size: 28),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    value,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 30,
                      fontWeight: FontWeight.bold,
                      height: 1,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    label,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              linkLabel,
              style: const TextStyle(
                color: AppColors.blue,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(width: 4),
            const Icon(
              Icons.chevron_right,
              color: AppColors.textMuted,
              size: 18,
            ),
          ],
        ),
      ),
    );
  }
}
