import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/route_provider.dart';
import '../models/route_model.dart';
import '../theme/app_theme.dart';
import 'truck_visualizer.dart';

class ArrivalModal extends StatefulWidget {
  const ArrivalModal({super.key});

  @override
  State<ArrivalModal> createState() => _ArrivalModalState();
}

class _ArrivalModalState extends State<ArrivalModal> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 420));
    _slide = Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SlideTransition(
      position: _slide,
      child: Consumer<RouteProvider>(
        builder: (_, prov, __) {
          final parada = prov.paradaActiva;
          if (parada == null) return const SizedBox();
          final isReturns = prov.phase == DeliveryPhase.returnsPhase;

          return Container(
            decoration: const BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              border: Border(top: BorderSide(color: AppColors.amber, width: 2)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Handle
                Center(
                  child: Container(
                    margin: const EdgeInsets.only(top: 12),
                    width: 40, height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                    child: isReturns
                        ? _RetornosPhase(parada: parada, prov: prov)
                        : _EntregaPhase(parada: parada, prov: prov),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _EntregaPhase extends StatelessWidget {
  final Parada parada;
  final RouteProvider prov;
  const _EntregaPhase({required this.parada, required this.prov});

  @override
  Widget build(BuildContext context) {
    // Determine which side to open
    final activePalets = parada.productos.map((p) => p.paletId).toSet();
    final paletsConfig = prov.paletsConfig;
    final sides = paletsConfig
        .where((p) => activePalets.contains(p.id))
        .map((p) => p.lado)
        .toSet();
    final sideLabel = sides.contains(PaletSide.izquierdo) && sides.contains(PaletSide.derecho)
        ? 'AMBAS LONAS'
        : sides.contains(PaletSide.izquierdo)
            ? 'LONA IZQUIERDA'
            : 'LONA DERECHA';
    final sideColor = sides.contains(PaletSide.izquierdo) && !sides.contains(PaletSide.derecho)
        ? AppColors.amber
        : sides.contains(PaletSide.derecho) && !sides.contains(PaletSide.izquierdo)
            ? AppColors.blue
            : AppColors.purple;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.amber.withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.amber.withOpacity(0.4)),
              ),
              child: Text(
                'PARADA ${parada.num} / ${prov.total}',
                style: const TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w800,
                  color: AppColors.amber, letterSpacing: 1,
                ),
              ),
            ),
            const Spacer(),
            GestureDetector(
              onTap: prov.cancelarModal,
              child: const Icon(Icons.close, color: AppColors.textMuted, size: 22),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(parada.nombre, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
        Text(parada.direccion, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        const SizedBox(height: 18),

        // BIG instruction: open which lona
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: sideColor.withOpacity(0.1),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: sideColor.withOpacity(0.6), width: 2),
          ),
          child: Row(
            children: [
              Icon(Icons.local_shipping_rounded, color: sideColor, size: 32),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'ABRE →',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: sideColor.withOpacity(0.7), letterSpacing: 2),
                    ),
                    Text(
                      sideLabel,
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: sideColor),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Truck visualizer
        TruckVisualizer(
          palets: prov.paletsConfig,
          getState: prov.paletState,
          getProductos: prov.productosEnPalet,
          compact: false,
        ),
        const SizedBox(height: 8),
        const TruckLegend(),
        const SizedBox(height: 18),

        // Products list
        const Text('MERCANCÍA A DESCARGAR',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1.5)),
        const SizedBox(height: 10),
        ...parada.productos.map((prod) => _ProductoTile(prod: prod, paletsConfig: prov.paletsConfig)),
        const SizedBox(height: 20),

        // Complete button
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: prov.completarEntrega,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.green,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 18),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
            icon: const Icon(Icons.check_circle_rounded, size: 22),
            label: const Text('Entrega completada', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }
}

class _RetornosPhase extends StatelessWidget {
  final Parada parada;
  final RouteProvider prov;
  const _RetornosPhase({required this.parada, required this.prov});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.blue.withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.blue.withOpacity(0.4)),
              ),
              child: const Text(
                'RETORNOS',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.blue, letterSpacing: 1),
              ),
            ),
            const Spacer(),
            GestureDetector(
              onTap: prov.cancelarModal,
              child: const Icon(Icons.close, color: AppColors.textMuted, size: 22),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(parada.nombre, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
        const SizedBox(height: 6),
        const Text(
          'Indica dónde guardar los retornos',
          style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 16),

        // Truck with return destinations highlighted
        TruckVisualizer(
          palets: prov.paletsConfig,
          getState: prov.paletState,
          getProductos: prov.productosEnPalet,
        ),
        const SizedBox(height: 16),

        // Returns list
        const Text('UBICA LOS RETORNOS EN:',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1.5)),
        const SizedBox(height: 10),
        ...parada.retornos.map((r) {
          final palet = prov.paletsConfig.firstWhere(
            (p) => p.id == r.paletDestinoId,
            orElse: () => prov.paletsConfig.first,
          );
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.blue.withOpacity(0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.blue.withOpacity(0.3)),
            ),
            child: Row(
              children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.blue.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.keyboard_return_rounded, color: AppColors.blue, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(r.nombre, style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                      Text('Cantidad: ${r.qty}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '→ ${palet.label}',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.blue),
                    ),
                    Text(
                      palet.nombre,
                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ],
            ),
          );
        }),
        const SizedBox(height: 20),

        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: prov.confirmarRetornos,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.blue,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 18),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
            icon: const Icon(Icons.check_circle_rounded, size: 22),
            label: const Text('Retornos guardados', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }
}

class _ProductoTile extends StatelessWidget {
  final Producto prod;
  final List<Palet> paletsConfig;
  const _ProductoTile({required this.prod, required this.paletsConfig});

  @override
  Widget build(BuildContext context) {
    final palet = paletsConfig.firstWhere(
      (p) => p.id == prod.paletId,
      orElse: () => paletsConfig.first,
    );
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.amber.withOpacity(0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.amber.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
              color: AppColors.amber.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text(
                '×${prod.qty}',
                style: const TextStyle(
                  fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.amber,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(prod.nombre, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.textPrimary)),
                Row(
                  children: [
                    if (prod.retornable) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.orange.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text('RETORNABLE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.orange)),
                      ),
                      const SizedBox(width: 6),
                    ],
                    Text('Palé ${palet.label} · ${palet.nombre}',
                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
