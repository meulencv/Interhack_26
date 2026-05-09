import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';
import '../providers/app_provider.dart';
import 'resultado_screen.dart';

class CamionScreen extends StatelessWidget {
  const CamionScreen({super.key});

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
              // Header
              const Text(
                'Camión',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 24),

              // Truck side view illustration
              _TruckSideView(),
              const SizedBox(height: 24),

              // Legend
              Container(
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Contenido',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _LegendItem(
                            color: AppColors.purple,
                            label: 'Palés',
                            value: '${provider.totalPales}',
                          ),
                        ),
                        Expanded(
                          child: _LegendItem(
                      color: AppColors.orange,
                      value: '${provider.totalPedidos}',
                      label: 'Pedidos',
                    ),    ),
                        Expanded(
                          child: _LegendItem(
                            color: AppColors.green,
                            label: 'Entregados',
                            value: '${provider.pedidosEntregados}',
                          ),
                        ),
                        Expanded(
                          child: _LegendItem(
                            color: AppColors.textMuted,
                            label: 'Pendientes',
                            value: '${provider.pedidosPendientes}',
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Interior button
              AppWidgets.primaryButton(
                label: 'VER INTERIOR DEL CAMIÓN',
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const InteriorCamionScreen()),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TruckSideView extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 160,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: CustomPaint(
        painter: _TruckSidePainter(),
      ),
    );
  }
}

class _TruckSidePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final bodyPaint = Paint()
      ..color = const Color(0xFF2A2A2A)
      ..style = PaintingStyle.fill;

    final borderPaint = Paint()
      ..color = const Color(0xFF4A4A4A)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    final windowPaint = Paint()
      ..color = const Color(0xFF3B82F6).withOpacity(0.3)
      ..style = PaintingStyle.fill;

    final wheelPaint = Paint()
      ..color = const Color(0xFF374151)
      ..style = PaintingStyle.fill;

    final wheelBorderPaint = Paint()
      ..color = const Color(0xFF6B7280)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    final double startX = 20;
    final double endX = size.width - 20;
    final double topY = 30;
    final double bottomY = size.height - 40;
    final double cabWidth = 80;

    // Cargo body
    final cargoRect = RRect.fromRectAndRadius(
      Rect.fromLTRB(startX + cabWidth, topY, endX, bottomY),
      const Radius.circular(4),
    );
    canvas.drawRRect(cargoRect, bodyPaint);
    canvas.drawRRect(cargoRect, borderPaint);

    // Cargo content squares (suggesting packed items)
    final cargoPaint = Paint()..style = PaintingStyle.fill;
    final cols = [AppColors.purple, AppColors.orange, AppColors.purple];
    for (int i = 0; i < 3; i++) {
      cargoPaint.color = cols[i % cols.length].withOpacity(0.6);
      final x = startX + cabWidth + 10 + i * 50.0;
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(x, topY + 15, 38, 50),
          const Radius.circular(4),
        ),
        cargoPaint,
      );
    }

    // Cab
    final cabPath = Path()
      ..moveTo(startX, bottomY)
      ..lineTo(startX, topY + 20)
      ..quadraticBezierTo(startX, topY, startX + 20, topY)
      ..lineTo(startX + cabWidth, topY)
      ..lineTo(startX + cabWidth, bottomY)
      ..close();
    canvas.drawPath(cabPath, bodyPaint);
    canvas.drawPath(cabPath, borderPaint);

    // Window
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTRB(startX + 8, topY + 12, startX + cabWidth - 8, topY + 50),
        const Radius.circular(4),
      ),
      windowPaint,
    );

    // Wheels
    final wheelY = bottomY + 10;
    // Front wheel
    canvas.drawCircle(Offset(startX + 30, wheelY), 16, wheelPaint);
    canvas.drawCircle(Offset(startX + 30, wheelY), 16, wheelBorderPaint);
    canvas.drawCircle(Offset(startX + 30, wheelY), 6, Paint()..color = const Color(0xFF6B7280));

    // Rear wheels
    canvas.drawCircle(Offset(endX - 35, wheelY), 16, wheelPaint);
    canvas.drawCircle(Offset(endX - 35, wheelY), 16, wheelBorderPaint);
    canvas.drawCircle(Offset(endX - 35, wheelY), 6, Paint()..color = const Color(0xFF6B7280));

    canvas.drawCircle(Offset(endX - 65, wheelY), 16, wheelPaint);
    canvas.drawCircle(Offset(endX - 65, wheelY), 16, wheelBorderPaint);
    canvas.drawCircle(Offset(endX - 65, wheelY), 6, Paint()..color = const Color(0xFF6B7280));

    // Ground line
    canvas.drawLine(
      Offset(startX - 10, bottomY + 26),
      Offset(endX + 10, bottomY + 26),
      Paint()
        ..color = const Color(0xFF374151)
        ..strokeWidth = 2,
    );
  }

  @override
  bool shouldRepaint(_) => false;
}

class _LegendItem extends StatelessWidget {
  final Color color;
  final String label;
  final String value;

  const _LegendItem({
    required this.color,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textMuted,
            fontSize: 11,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

// ─── Interior del Camión ─────────────────────────────────────────────────────

class InteriorCamionScreen extends StatelessWidget {
  const InteriorCamionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    // Build 3x2 grid: [fila][columna]
    // fila 0=delantera, 1=centro, 2=trasera; columna 0=izq, 1=der
    final grid = List.generate(3, (f) => List.generate(2, (c) {
      try {
        return provider.pales.firstWhere((i) => i.fila == f && i.columna == c);
      } catch (_) {
        return null;
      }
    }));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Interior del camión'),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Label top
            const Center(
              child: Text(
                'Parte delantera',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            const SizedBox(height: 4),
            const _DirectionArrow(up: true),
            const SizedBox(height: 12),

            // Column headers
            Row(
              children: const [
                Expanded(
                  child: Center(
                    child: Text(
                      'Izquierda',
                      style: TextStyle(
                          color: AppColors.textMuted, fontSize: 13),
                    ),
                  ),
                ),
                Expanded(
                  child: Center(
                    child: Text(
                      'Derecha',
                      style: TextStyle(
                          color: AppColors.textMuted, fontSize: 13),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Grid
            ...List.generate(3, (fila) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: List.generate(2, (col) {
                  final item = grid[fila][col];
                  return Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(
                          left: col == 1 ? 5 : 0,
                          right: col == 0 ? 5 : 0),
                      child: GestureDetector(
                        onTap: item != null
                            ? () => Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => ResultadoScreen(item: item),
                                  ),
                                )
                            : null,
                        child: _GridCell(item: item),
                      ),
                    ),
                  );
                }),
              ),
            )),

            const SizedBox(height: 4),
            const _DirectionArrow(up: false),
            const SizedBox(height: 4),
            const Center(
              child: Text(
                'Parte trasera',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            const SizedBox(height: 28),

            // Color legend
            Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    'Leyenda',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  SizedBox(height: 12),
                  _ColorLegendRow(
                      color: AppColors.purple, label: 'Palé (pendiente)'),
                  SizedBox(height: 8),
                  _ColorLegendRow(
                      color: AppColors.orange, label: 'Paquete (pendiente)'),
                  SizedBox(height: 8),
                  _ColorLegendRow(
                      color: AppColors.green, label: 'Entregado'),
                  SizedBox(height: 8),
                  _ColorLegendRow(
                      color: AppColors.border, label: 'Vacío'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GridCell extends StatelessWidget {
  final Pale? item;

  const _GridCell({this.item});

  Color get _cellColor {
    if (item == null) return AppColors.border;
    if (item!.vacio) return AppColors.green;
    return AppColors.purple;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 100,
      decoration: BoxDecoration(
        color: _cellColor.withOpacity(item == null ? 0.1 : 0.2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _cellColor.withOpacity(item == null ? 0.2 : 0.6),
          width: 1.5,
        ),
      ),
      child: item == null
          ? const Center(
              child: Icon(Icons.remove, color: AppColors.textMuted, size: 20),
            )
          : Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.grid_view,
                  color: AppColors.purple,
                  size: 28,
                ),
                const SizedBox(height: 6),
                Text(
                  item!.id,
                  style: TextStyle(
                    color: _cellColor,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (item!.vacio)
                  const Text(
                    'Entregado',
                    style: TextStyle(
                      color: AppColors.green,
                      fontSize: 10,
                    ),
                  ),
              ],
            ),
    );
  }
}

class _DirectionArrow extends StatelessWidget {
  final bool up;
  const _DirectionArrow({required this.up});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Icon(
        up ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
        color: AppColors.textMuted,
        size: 20,
      ),
    );
  }
}

class _ColorLegendRow extends StatelessWidget {
  final Color color;
  final String label;

  const _ColorLegendRow({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(
            color: color.withOpacity(0.5),
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: color, width: 1.5),
          ),
        ),
        const SizedBox(width: 10),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 14,
          ),
        ),
      ],
    );
  }
}
