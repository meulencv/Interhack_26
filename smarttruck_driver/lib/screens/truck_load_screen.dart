import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/route_provider.dart';
import '../models/route_model.dart';
import '../theme/app_theme.dart';
import '../widgets/truck_visualizer.dart';

class TruckLoadScreen extends StatefulWidget {
  const TruckLoadScreen({super.key});

  @override
  State<TruckLoadScreen> createState() => _TruckLoadScreenState();
}

class _TruckLoadScreenState extends State<TruckLoadScreen> {
  int? _selectedPalet;

  @override
  Widget build(BuildContext context) {
    return Consumer<RouteProvider>(
      builder: (_, prov, __) {
        final paletsConfig = prov.paletsConfig;

        // Count stats
        int totalProductos = prov.paradas
            .where((p) => p.estado != StopStatus.completada)
            .expand((p) => p.productos)
            .fold(0, (sum, p) => sum + p.qty);
        int totalRetornos = prov.paradas
            .expand((p) => p.retornos)
            .where((r) => !r.recogido)
            .fold(0, (sum, r) => sum + r.qty);

        return SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Vista de Carga', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                      Text('Camión 6P · ${prov.paradaActiva?.nombre ?? "Sin parada activa"}',
                        style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                    ],
                  ),
                  const Spacer(),
                  // Fill percentage
                  _FillGauge(totalProductos: totalProductos),
                ],
              ),
              const SizedBox(height: 16),

              // Stats row
              Row(
                children: [
                  _StatChip(label: 'Pendientes', value: '$totalProductos', color: AppColors.amber, icon: Icons.inventory_2_rounded),
                  const SizedBox(width: 10),
                  _StatChip(label: 'Retornos', value: '$totalRetornos', color: AppColors.blue, icon: Icons.keyboard_return_rounded),
                  const SizedBox(width: 10),
                  _StatChip(label: 'Palés', value: '${paletsConfig.length}', color: AppColors.purple, icon: Icons.grid_view_rounded),
                ],
              ),
              const SizedBox(height: 20),

              // MAIN: Truck Visualizer
              const Text('DISTRIBUCIÓN EN CAMIÓN',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1.5)),
              const SizedBox(height: 10),
              TruckVisualizer(
                palets: paletsConfig,
                getState: (id) {
                  if (_selectedPalet != null && _selectedPalet != id) return 'libre';
                  return prov.paletState(id);
                },
                getProductos: prov.productosEnPalet,
              ),
              const SizedBox(height: 10),
              const TruckLegend(),
              const SizedBox(height: 20),

              // Per-palet detail cards
              const Text('DETALLE POR PALÉ',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1.5)),
              const SizedBox(height: 10),
              ...paletsConfig.map((palet) {
                final productos = _allProductsInPalet(prov, palet.id);
                final retornos = _allRetornosInPalet(prov, palet.id);
                if (productos.isEmpty && retornos.isEmpty) {
                  return _EmptyPaletTile(palet: palet);
                }
                return _PaletDetailCard(
                  palet: palet,
                  productos: productos,
                  retornos: retornos,
                  isSelected: _selectedPalet == palet.id,
                  onTap: () => setState(() => _selectedPalet = _selectedPalet == palet.id ? null : palet.id),
                );
              }),
            ],
          ),
        );
      },
    );
  }

  List<_ProdWithParada> _allProductsInPalet(RouteProvider prov, int paletId) {
    final result = <_ProdWithParada>[];
    for (final parada in prov.paradas.where((p) => p.estado != StopStatus.completada)) {
      for (final prod in parada.productos.where((p) => p.paletId == paletId)) {
        result.add(_ProdWithParada(prod: prod, paradaNombre: parada.nombre, paradaNum: parada.num));
      }
    }
    return result;
  }

  List<_RetornoWithParada> _allRetornosInPalet(RouteProvider prov, int paletId) {
    final result = <_RetornoWithParada>[];
    for (final parada in prov.paradas) {
      for (final r in parada.retornos.where((r) => r.paletDestinoId == paletId && !r.recogido)) {
        result.add(_RetornoWithParada(retorno: r, paradaNombre: parada.nombre, paradaNum: parada.num));
      }
    }
    return result;
  }
}

class _ProdWithParada {
  final Producto prod;
  final String paradaNombre;
  final int paradaNum;
  _ProdWithParada({required this.prod, required this.paradaNombre, required this.paradaNum});
}

class _RetornoWithParada {
  final Retorno retorno;
  final String paradaNombre;
  final int paradaNum;
  _RetornoWithParada({required this.retorno, required this.paradaNombre, required this.paradaNum});
}

class _FillGauge extends StatelessWidget {
  final int totalProductos;
  const _FillGauge({required this.totalProductos});

  @override
  Widget build(BuildContext context) {
    final pct = (totalProductos / 50).clamp(0.0, 1.0);
    return SizedBox(
      width: 56, height: 56,
      child: Stack(
        children: [
          CircularProgressIndicator(
            value: pct,
            strokeWidth: 5,
            backgroundColor: AppColors.border,
            valueColor: AlwaysStoppedAnimation(
              pct > 0.7 ? AppColors.green : pct > 0.3 ? AppColors.amber : AppColors.red),
          ),
          Center(child: Text('${(pct * 100).round()}%',
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.textPrimary))),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;
  const _StatChip({required this.label, required this.value, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: color)),
          Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
        ],
      ),
    ),
  );
}

class _EmptyPaletTile extends StatelessWidget {
  final Palet palet;
  const _EmptyPaletTile({required this.palet});

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
    decoration: BoxDecoration(
      color: AppColors.surfaceHigh,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: AppColors.border),
    ),
    child: Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(6)),
          child: Text(palet.label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
        ),
        const SizedBox(width: 12),
        Text(palet.nombre, style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
        const Spacer(),
        const Text('Vacío', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
      ],
    ),
  );
}

class _PaletDetailCard extends StatelessWidget {
  final Palet palet;
  final List<_ProdWithParada> productos;
  final List<_RetornoWithParada> retornos;
  final bool isSelected;
  final VoidCallback onTap;
  const _PaletDetailCard({
    required this.palet, required this.productos, required this.retornos,
    required this.isSelected, required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final hasActive = productos.any((p) => p.paradaNum == 2); // activa
    final color = hasActive ? AppColors.amber : AppColors.purple;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withOpacity(isSelected ? 0.1 : 0.05),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(isSelected ? 0.6 : 0.2), width: isSelected ? 2 : 1),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(palet.label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: color)),
                ),
                const SizedBox(width: 10),
                Text(palet.nombre, style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                const Spacer(),
                Icon(isSelected ? Icons.expand_less : Icons.expand_more, color: AppColors.textMuted, size: 20),
              ],
            ),
            if (isSelected) ...[
              const SizedBox(height: 12),
              ...productos.map((pw) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Container(
                      width: 22, height: 22,
                      decoration: BoxDecoration(
                        color: AppColors.amber.withOpacity(0.15),
                        shape: BoxShape.circle,
                      ),
                      child: Center(child: Text('${pw.paradaNum}',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.amber))),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(pw.prod.nombre, style: const TextStyle(fontSize: 13, color: AppColors.textPrimary, fontWeight: FontWeight.w500)),
                          Text(pw.paradaNombre, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                        ],
                      ),
                    ),
                    Text('×${pw.prod.qty}', style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.amber)),
                  ],
                ),
              )),
              if (retornos.isNotEmpty) ...[
                const Divider(color: AppColors.border),
                ...retornos.map((rw) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      const Icon(Icons.keyboard_return_rounded, color: AppColors.blue, size: 18),
                      const SizedBox(width: 8),
                      Expanded(child: Text('${rw.retorno.nombre} (${rw.paradaNombre})',
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary))),
                      Text('×${rw.retorno.qty}', style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.blue)),
                    ],
                  ),
                )),
              ],
            ] else
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  '${productos.length} productos · ${productos.fold(0, (s, p) => s + p.prod.qty)} unidades · toca para ver',
                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
