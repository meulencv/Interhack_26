import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../providers/route_provider.dart';
import '../models/route_model.dart';
import '../theme/app_theme.dart';
import '../widgets/arrival_modal.dart';

class RouteScreen extends StatefulWidget {
  const RouteScreen({super.key});

  @override
  State<RouteScreen> createState() => _RouteScreenState();
}

class _RouteScreenState extends State<RouteScreen> {
  bool _mapExpanded = false;

  @override
  Widget build(BuildContext context) {
    return Consumer<RouteProvider>(
      builder: (_, prov, __) {
        final activa = prov.paradaActiva;
        final showModal = prov.phase == DeliveryPhase.delivering ||
            prov.phase == DeliveryPhase.returnsPhase;

        return Stack(
          children: [
            CustomScrollView(
              slivers: [
                // Map section
                SliverToBoxAdapter(child: _MapSection(prov: prov, expanded: _mapExpanded, onToggle: () => setState(() => _mapExpanded = !_mapExpanded))),

                // Current stop card
                if (activa != null)
                  SliverToBoxAdapter(child: _CurrentStopCard(parada: activa, prov: prov)),

                // Progress header
                SliverToBoxAdapter(child: _ProgressHeader(prov: prov)),

                // Stops list
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, i) => _StopTile(parada: prov.paradas[i], prov: prov),
                    childCount: prov.paradas.length,
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 20)),
              ],
            ),

            // Arrival modal overlay
            if (showModal)
              Positioned.fill(
                child: Column(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: prov.cancelarModal,
                        child: Container(color: Colors.black54),
                      ),
                    ),
                    SizedBox(
                      height: MediaQuery.of(context).size.height * 0.82,
                      child: const ArrivalModal(),
                    ),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}

class _MapSection extends StatelessWidget {
  final RouteProvider prov;
  final bool expanded;
  final VoidCallback onToggle;
  const _MapSection({required this.prov, required this.expanded, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    final height = expanded ? 300.0 : 180.0;
    final activa = prov.paradaActiva;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      height: height,
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.hardEdge,
      child: Stack(
        children: [
          FlutterMap(
            options: MapOptions(
              initialCenter: activa?.pos ?? const LatLng(41.3908, 2.1694),
              initialZoom: 13.5,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.ddi.smarttruck',
              ),
              // Route polyline
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: prov.paradas.map((p) => p.pos).toList(),
                    strokeWidth: 3,
                    color: AppColors.blue.withOpacity(0.7),
                  ),
                ],
              ),
              // Stop markers
              MarkerLayer(
                markers: prov.paradas.map((p) {
                  final color = p.estado == StopStatus.completada
                      ? AppColors.green
                      : p.estado == StopStatus.activa
                          ? AppColors.amber
                          : AppColors.textMuted;
                  return Marker(
                    point: p.pos,
                    width: 32, height: 32,
                    child: Container(
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                        boxShadow: [BoxShadow(color: color.withOpacity(0.5), blurRadius: 8)],
                      ),
                      child: Center(
                        child: Text('${p.num}',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.white)),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
          // Expand toggle
          Positioned(
            top: 8, right: 8,
            child: GestureDetector(
              onTap: onToggle,
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.surface.withOpacity(0.9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  expanded ? Icons.fullscreen_exit : Icons.fullscreen,
                  color: AppColors.textPrimary, size: 18,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CurrentStopCard extends StatelessWidget {
  final Parada parada;
  final RouteProvider prov;
  const _CurrentStopCard({required this.parada, required this.prov});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.amber.withOpacity(0.12), AppColors.amber.withOpacity(0.04)],
          begin: Alignment.topLeft, end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.amber.withOpacity(0.6), width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.amber.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text('PARADA ACTUAL', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.amber, letterSpacing: 1)),
              ),
              const Spacer(),
              const Icon(Icons.location_on_rounded, color: AppColors.amber, size: 16),
              const SizedBox(width: 4),
              Text(parada.eta, style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.amber)),
            ],
          ),
          const SizedBox(height: 10),
          Text(parada.nombre, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
          const SizedBox(height: 2),
          Row(
            children: [
              const Icon(Icons.location_pin, size: 12, color: AppColors.textMuted),
              const SizedBox(width: 4),
              Expanded(child: Text(parada.direccion, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary))),
            ],
          ),
          const SizedBox(height: 12),

          // Accessibility bar
          Row(
            children: [
              const Text('Accesibilidad carga', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
              const Spacer(),
              Text('${parada.accesibilidad}%',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                  color: parada.accesibilidad >= 80 ? AppColors.green : parada.accesibilidad >= 60 ? AppColors.amber : AppColors.red)),
            ],
          ),
          const SizedBox(height: 4),
          LinearProgressIndicator(
            value: parada.accesibilidad / 100,
            backgroundColor: AppColors.border,
            valueColor: AlwaysStoppedAnimation(
              parada.accesibilidad >= 80 ? AppColors.green : parada.accesibilidad >= 60 ? AppColors.amber : AppColors.red),
            minHeight: 5,
            borderRadius: BorderRadius.circular(3),
          ),

          if (parada.aiTexto != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.purple.withOpacity(0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.purple.withOpacity(0.25)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.auto_awesome, color: AppColors.purple, size: 14),
                  const SizedBox(width: 8),
                  Expanded(child: Text(parada.aiTexto!, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary))),
                ],
              ),
            ),
          ],

          const SizedBox(height: 14),

          // BIG LLEGUÉ button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: prov.marcarLlegada,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.amber,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              icon: const Icon(Icons.place_rounded, size: 22),
              label: const Text('HE LLEGADO', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProgressHeader extends StatelessWidget {
  final RouteProvider prov;
  const _ProgressHeader({required this.prov});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Row(
        children: [
          const Text('RECORRIDO', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1.5)),
          const Spacer(),
          Text(
            '${prov.completadas}/${prov.total} entregas',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _StopTile extends StatelessWidget {
  final Parada parada;
  final RouteProvider prov;
  const _StopTile({required this.parada, required this.prov});

  @override
  Widget build(BuildContext context) {
    final isActiva = parada.estado == StopStatus.activa;
    final isDone = parada.estado == StopStatus.completada;
    final dotColor = isDone ? AppColors.green : isActiva ? AppColors.amber : AppColors.textMuted;

    // Pallets used by this stop
    final paletIds = parada.productos.map((p) => p.paletId).toSet();
    final paletsConfig = prov.paletsConfig;
    final paletNames = paletIds.map((id) => paletsConfig.firstWhere((p) => p.id == id).label).join(', ');

    return Opacity(
      opacity: isDone ? 0.55 : 1,
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isActiva ? AppColors.amber.withOpacity(0.06) : AppColors.surfaceHigh,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isActiva ? AppColors.amber.withOpacity(0.4) : AppColors.border,
          ),
        ),
        child: Row(
          children: [
            // Stop number dot
            Column(
              children: [
                Container(
                  width: 32, height: 32,
                  decoration: BoxDecoration(
                    color: dotColor.withOpacity(0.15),
                    shape: BoxShape.circle,
                    border: Border.all(color: dotColor.withOpacity(0.5)),
                  ),
                  child: Center(
                    child: isDone
                        ? Icon(Icons.check, color: dotColor, size: 16)
                        : Text('${parada.num}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: dotColor)),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 12),

            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(parada.nombre,
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.textPrimary,
                            decoration: isDone ? TextDecoration.lineThrough : null)),
                      ),
                      Text(parada.eta, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Text(parada.tipo, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                      const Text(' · ', style: TextStyle(color: AppColors.textMuted)),
                      Text(parada.direccion, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                    ],
                  ),
                  if (!isDone && paletIds.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        _Tag(label: 'Palés: $paletNames', color: isActiva ? AppColors.amber : AppColors.textMuted),
                        const SizedBox(width: 6),
                        _Tag(label: '${parada.accesibilidad}% acc.', color: _accColor(parada.accesibilidad)),
                        if (parada.aiAdvertencia) ...[
                          const SizedBox(width: 6),
                          _Tag(label: '⚠️ IA sugiere reordenar', color: AppColors.orange),
                        ],
                      ],
                    ),
                  ],
                  if (parada.kmSiguiente != null && !isDone)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text('→ próxima: ${parada.kmSiguiente} km · ~${parada.minSiguiente} min',
                        style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _accColor(int pct) =>
      pct >= 80 ? AppColors.green : pct >= 60 ? AppColors.amber : AppColors.red;
}

class _Tag extends StatelessWidget {
  final String label;
  final Color color;
  const _Tag({required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
    decoration: BoxDecoration(
      color: color.withOpacity(0.1),
      borderRadius: BorderRadius.circular(6),
      border: Border.all(color: color.withOpacity(0.3)),
    ),
    child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color)),
  );
}
