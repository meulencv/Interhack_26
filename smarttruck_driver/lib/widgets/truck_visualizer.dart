import 'package:flutter/material.dart';
import '../models/route_model.dart';
import '../theme/app_theme.dart';

class TruckVisualizer extends StatelessWidget {
  final List<Palet> palets;
  final String Function(int paletId) getState;
  final List<Producto> Function(int paletId) getProductos;
  final int? highlightPaletId;
  final bool compact;

  const TruckVisualizer({
    super.key,
    required this.palets,
    required this.getState,
    required this.getProductos,
    this.highlightPaletId,
    this.compact = false,
  });

  Color _colorForState(String state) {
    switch (state) {
      case 'activo':   return AppColors.amber;
      case 'retorno':  return AppColors.blue;
      case 'pendiente': return const Color(0xFF1E3A5F);
      default:          return AppColors.surfaceHigh;
    }
  }

  Color _borderForState(String state) {
    switch (state) {
      case 'activo':   return AppColors.amber;
      case 'retorno':  return AppColors.blue;
      case 'pendiente': return AppColors.border;
      default:          return AppColors.border;
    }
  }

  @override
  Widget build(BuildContext context) {
    final izq = palets.where((p) => p.lado == PaletSide.izquierdo).toList();
    final der = palets.where((p) => p.lado == PaletSide.derecho).toList();
    final paletH = compact ? 60.0 : 88.0;

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF070E1C),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          // LONA IZQUIERDA header
          _LonaHeader(label: 'LONA IZQUIERDA', icon: Icons.arrow_upward),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: _PaletRow(
              palets: izq,
              getState: getState,
              getProductos: getProductos,
              height: paletH,
            ),
          ),
          // Truck body divider
          _TruckDivider(),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: _PaletRow(
              palets: der,
              getState: getState,
              getProductos: getProductos,
              height: paletH,
            ),
          ),
          // LONA DERECHA header
          _LonaHeader(label: 'LONA DERECHA', icon: Icons.arrow_downward),
          // Labels: CABINA / TRASERA
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _LabelChip('🚛 CABINA'),
                _LabelChip('TRASERA 📦'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _PaletRow({
    required List<Palet> palets,
    required String Function(int) getState,
    required List<Producto> Function(int) getProductos,
    required double height,
  }) {
    return Row(
      children: palets.map((palet) {
        final state = getState(palet.id);
        final productos = getProductos(palet.id);
        final color = _colorForState(state);
        final border = _borderForState(state);
        final isActive = state == 'activo';

        return Expanded(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 400),
            margin: const EdgeInsets.symmetric(horizontal: 3, vertical: 6),
            height: height,
            decoration: BoxDecoration(
              color: color.withOpacity(isActive ? 0.18 : 0.08),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: border.withOpacity(isActive ? 1 : 0.4),
                width: isActive ? 2 : 1,
              ),
              boxShadow: isActive
                  ? [BoxShadow(color: AppColors.amber.withOpacity(0.3), blurRadius: 12, spreadRadius: 1)]
                  : null,
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  palet.label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: isActive ? AppColors.amber : AppColors.textMuted,
                    letterSpacing: 0.5,
                  ),
                ),
                if (state == 'activo' && productos.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Container(
                    width: 28,
                    height: 2,
                    decoration: BoxDecoration(
                      color: AppColors.amber,
                      borderRadius: BorderRadius.circular(1),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '×${productos.fold(0, (sum, p) => sum + p.qty)}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: AppColors.amber,
                    ),
                  ),
                ] else if (state == 'retorno') ...[
                  const SizedBox(height: 4),
                  const Icon(Icons.keyboard_return_rounded, size: 14, color: AppColors.blue),
                ] else if (state == 'pendiente') ...[
                  const SizedBox(height: 4),
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: AppColors.textMuted,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _LonaHeader extends StatelessWidget {
  final String label;
  final IconData icon;
  const _LonaHeader({required this.label, required this.icon});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 10, 14, 2),
    child: Row(
      children: [
        Icon(icon, size: 11, color: AppColors.textMuted),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: AppColors.textMuted,
            letterSpacing: 1.5,
          ),
        ),
      ],
    ),
  );
}

class _TruckDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
    height: 28,
    decoration: BoxDecoration(
      color: const Color(0xFF0D1525),
      border: Border.symmetric(
        vertical: BorderSide(color: AppColors.border.withOpacity(0.5)),
      ),
    ),
    child: const Center(
      child: Text(
        '━━━━━━━━━━━━━━━━━━━━━━━━  CHASIS  ━━━━━━━━━━━━━━━━━━━━━━━━',
        style: TextStyle(fontSize: 8, color: Color(0xFF1E2D4A), letterSpacing: 2),
        overflow: TextOverflow.clip,
      ),
    ),
  );
}

class _LabelChip extends StatelessWidget {
  final String text;
  const _LabelChip(this.text);

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(
      fontSize: 10,
      fontWeight: FontWeight.w600,
      color: AppColors.textMuted,
      letterSpacing: 0.5,
    ),
  );
}

// Legend widget
class TruckLegend extends StatelessWidget {
  const TruckLegend({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _item(AppColors.amber, 'Entregar ahora'),
        const SizedBox(width: 16),
        _item(AppColors.blue, 'Retornos'),
        const SizedBox(width: 16),
        _item(const Color(0xFF1E3A5F), 'Próximas'),
      ],
    );
  }

  Widget _item(Color color, String label) => Row(
    children: [
      Container(
        width: 10, height: 10,
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3)),
      ),
      const SizedBox(width: 5),
      Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
    ],
  );
}
