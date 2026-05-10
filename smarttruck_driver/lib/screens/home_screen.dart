import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../providers/app_provider.dart';
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

class _RouteMapCard extends StatelessWidget {
  final AppProvider provider;

  const _RouteMapCard({required this.provider});

  @override
  Widget build(BuildContext context) {
    final active = provider.paradaActiva;
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
                  'Mapa simulado del camión',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Text(
                provider.connectionLabel,
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
            height: 170,
            width: double.infinity,
            child: CustomPaint(
              painter: _RouteMapPainter(provider.paradas),
              child: Align(
                alignment: Alignment.bottomLeft,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.background.withOpacity(0.78),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Text(
                    active == null
                        ? 'Ruta completada'
                        : 'Ahora: parada ${active.num} · ${active.hora}',
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RouteMapPainter extends CustomPainter {
  final List<dynamic> paradas;

  _RouteMapPainter(this.paradas);

  @override
  void paint(Canvas canvas, Size size) {
    final points = _points(size);
    if (points.isEmpty) return;

    final gridPaint = Paint()
      ..color = AppColors.border.withOpacity(0.35)
      ..strokeWidth = 1;
    for (var i = 1; i < 4; i++) {
      final y = size.height * i / 4;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (final point in points.skip(1)) {
      path.lineTo(point.dx, point.dy);
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = AppColors.blue
        ..strokeWidth = 4
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );

    for (var i = 0; i < points.length; i++) {
      final parada = paradas[i];
      final point = points[i];
      final color = parada.completada
          ? AppColors.green
          : parada.activa
          ? AppColors.primaryYellow
          : AppColors.textMuted;
      canvas.drawCircle(point, parada.activa ? 9 : 6, Paint()..color = color);
      if (parada.activa) {
        final truckRect = Rect.fromCenter(
          center: point.translate(0, -24),
          width: 32,
          height: 18,
        );
        canvas.drawRRect(
          RRect.fromRectAndRadius(truckRect, const Radius.circular(5)),
          Paint()..color = AppColors.primaryYellow,
        );
        canvas.drawCircle(
          truckRect.bottomLeft.translate(7, 1),
          3,
          Paint()..color = AppColors.background,
        );
        canvas.drawCircle(
          truckRect.bottomRight.translate(-7, 1),
          3,
          Paint()..color = AppColors.background,
        );
      }
    }
  }

  List<Offset> _points(Size size) {
    if (paradas.isEmpty) return const [];
    final coords = paradas
        .map((p) => (lat: p.latitude as double?, lng: p.longitude as double?))
        .toList();
    final hasCoords = coords.every((p) => p.lat != null && p.lng != null);
    if (!hasCoords) {
      return List.generate(paradas.length, (index) {
        final t = paradas.length == 1 ? 0.5 : index / (paradas.length - 1);
        return Offset(
          18 + t * (size.width - 36),
          size.height * (0.65 - 0.28 * (index.isEven ? 1 : -0.2)),
        );
      });
    }

    final lats = coords.map((p) => p.lat!).toList();
    final lngs = coords.map((p) => p.lng!).toList();
    final minLat = lats.reduce((a, b) => a < b ? a : b);
    final maxLat = lats.reduce((a, b) => a > b ? a : b);
    final minLng = lngs.reduce((a, b) => a < b ? a : b);
    final maxLng = lngs.reduce((a, b) => a > b ? a : b);
    final latSpan = (maxLat - minLat).abs() < 0.0001 ? 0.0001 : maxLat - minLat;
    final lngSpan = (maxLng - minLng).abs() < 0.0001 ? 0.0001 : maxLng - minLng;
    return coords.map((p) {
      final x = 18 + ((p.lng! - minLng) / lngSpan) * (size.width - 36);
      final y = 18 + (1 - ((p.lat! - minLat) / latSpan)) * (size.height - 36);
      return Offset(x, y);
    }).toList();
  }

  @override
  bool shouldRepaint(covariant _RouteMapPainter oldDelegate) {
    return oldDelegate.paradas != paradas;
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
