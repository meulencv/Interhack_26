import 'package:flutter/material.dart';
import 'package:nfc_manager/nfc_manager.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';
import '../providers/app_provider.dart';

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
                          ),
                        ),
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
                      builder: (_) => const InteriorCamionScreen(),
                    ),
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
      child: CustomPaint(painter: _TruckSidePainter()),
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
    canvas.drawCircle(
      Offset(startX + 30, wheelY),
      6,
      Paint()..color = const Color(0xFF6B7280),
    );

    // Rear wheels
    canvas.drawCircle(Offset(endX - 35, wheelY), 16, wheelPaint);
    canvas.drawCircle(Offset(endX - 35, wheelY), 16, wheelBorderPaint);
    canvas.drawCircle(
      Offset(endX - 35, wheelY),
      6,
      Paint()..color = const Color(0xFF6B7280),
    );

    canvas.drawCircle(Offset(endX - 65, wheelY), 16, wheelPaint);
    canvas.drawCircle(Offset(endX - 65, wheelY), 16, wheelBorderPaint);
    canvas.drawCircle(
      Offset(endX - 65, wheelY),
      6,
      Paint()..color = const Color(0xFF6B7280),
    );

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
          style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

// ─── Interior del Camión ─────────────────────────────────────────────────────

class InteriorCamionScreen extends StatefulWidget {
  const InteriorCamionScreen({super.key});

  @override
  State<InteriorCamionScreen> createState() => _InteriorCamionScreenState();
}

class _InteriorCamionScreenState extends State<InteriorCamionScreen> {
  String? _selectedPaleId;

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    Pale? selectedPale;
    for (final pale in provider.pales) {
      if (pale.id == _selectedPaleId) {
        selectedPale = pale;
        break;
      }
    }
    final effectiveSelected =
        selectedPale ??
        (provider.pales.isNotEmpty ? provider.pales.first : null);

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
            _InteriorTruck3D(
              pales: provider.pales,
              selectedPaleId: effectiveSelected?.id,
              onPaleSelected: (pale) {
                setState(() => _selectedPaleId = pale.id);
              },
            ),
            const SizedBox(height: 18),
            _PaleContentPanel(
              pale: effectiveSelected,
              pedidos: provider.pedidos,
            ),
            const SizedBox(height: 20),

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
                    color: AppColors.purple,
                    label: 'Palé con contenido pendiente',
                  ),
                  SizedBox(height: 8),
                  _ColorLegendRow(
                    color: AppColors.orange,
                    label: 'Palé seleccionado',
                  ),
                  SizedBox(height: 8),
                  _ColorLegendRow(color: AppColors.green, label: 'Entregado'),
                  SizedBox(height: 8),
                  _ColorLegendRow(color: AppColors.border, label: 'Vacío'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InteriorTruck3D extends StatelessWidget {
  final List<Pale> pales;
  final String? selectedPaleId;
  final ValueChanged<Pale> onPaleSelected;

  const _InteriorTruck3D({
    required this.pales,
    required this.selectedPaleId,
    required this.onPaleSelected,
  });

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1.18,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final size = Size(constraints.maxWidth, constraints.maxHeight);
          return Stack(
            children: [
              Positioned.fill(
                child: CustomPaint(
                  painter: _InteriorTruckPainter(
                    pales: pales,
                    selectedPaleId: selectedPaleId,
                  ),
                ),
              ),
              ...pales.map((pale) {
                final center = _slotCenter(
                  size,
                  pale.fila ?? 0,
                  pale.columna ?? 0,
                );
                return Positioned(
                  left: center.dx - 30,
                  top: center.dy - 30,
                  width: 60,
                  height: 60,
                  child: Semantics(
                    button: true,
                    label: 'Ver contenido del palet ${pale.id}',
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => onPaleSelected(pale),
                      child: const SizedBox.expand(),
                    ),
                  ),
                );
              }),
            ],
          );
        },
      ),
    );
  }
}

class _InteriorTruckPainter extends CustomPainter {
  final List<Pale> pales;
  final String? selectedPaleId;

  const _InteriorTruckPainter({
    required this.pales,
    required this.selectedPaleId,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final floor = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF101216), Color(0xFF07080A)],
      ).createShader(Offset.zero & size);
    final frame = Paint()
      ..color = Colors.white.withOpacity(0.5)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    final glow = Paint()
      ..color = AppColors.blue.withOpacity(0.16)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 18);

    final cargo = _cargoRect(size);
    canvas.drawRRect(
      RRect.fromRectAndRadius(cargo.inflate(4), const Radius.circular(18)),
      glow,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(cargo, const Radius.circular(14)),
      floor,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(cargo, const Radius.circular(14)),
      frame,
    );

    final gridPaint = Paint()
      ..color = Colors.white.withOpacity(0.16)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (var i = 1; i < 3; i++) {
      final y = cargo.top + cargo.height * i / 3;
      canvas.drawLine(Offset(cargo.left, y), Offset(cargo.right, y), gridPaint);
    }
    canvas.drawLine(
      Offset(cargo.center.dx, cargo.top),
      Offset(cargo.center.dx, cargo.bottom),
      gridPaint,
    );

    final cab = Path()
      ..moveTo(cargo.left + cargo.width * 0.2, cargo.top - 14)
      ..lineTo(cargo.right - cargo.width * 0.2, cargo.top - 14)
      ..lineTo(cargo.right - cargo.width * 0.08, cargo.top + 30)
      ..lineTo(cargo.left + cargo.width * 0.08, cargo.top + 30)
      ..close();
    canvas.drawPath(cab, Paint()..color = const Color(0xFF151A22));
    canvas.drawPath(cab, frame);

    for (final pale in pales) {
      _drawPale(canvas, size, pale);
    }

    final labelStyle = TextStyle(
      color: AppColors.textMuted.withOpacity(0.9),
      fontSize: 11,
      fontWeight: FontWeight.w600,
    );
    _drawText(
      canvas,
      'CABINA',
      Offset(cargo.center.dx - 22, cargo.top - 44),
      labelStyle,
    );
    _drawText(
      canvas,
      'PUERTAS',
      Offset(cargo.center.dx - 25, cargo.bottom + 18),
      labelStyle,
    );
  }

  void _drawPale(Canvas canvas, Size size, Pale pale) {
    final selected = pale.id == selectedPaleId;
    final center = _slotCenter(size, pale.fila ?? 0, pale.columna ?? 0);
    final w = size.width * 0.27;
    final h = size.height * 0.12;
    final depth = size.height * 0.035;
    final top = Rect.fromCenter(
      center: center.translate(0, -depth),
      width: w,
      height: h,
    );
    final front = Path()
      ..moveTo(top.left, top.bottom)
      ..lineTo(top.right, top.bottom)
      ..lineTo(top.right - depth, top.bottom + depth)
      ..lineTo(top.left - depth, top.bottom + depth)
      ..close();
    final side = Path()
      ..moveTo(top.left, top.top)
      ..lineTo(top.left, top.bottom)
      ..lineTo(top.left - depth, top.bottom + depth)
      ..lineTo(top.left - depth, top.top + depth)
      ..close();
    final color = pale.vacio
        ? AppColors.green
        : selected
        ? AppColors.orange
        : AppColors.purple;

    canvas.drawPath(front, Paint()..color = color.withOpacity(0.48));
    canvas.drawPath(side, Paint()..color = color.withOpacity(0.34));
    canvas.drawRRect(
      RRect.fromRectAndRadius(top, const Radius.circular(8)),
      Paint()..color = color.withOpacity(selected ? 0.88 : 0.68),
    );

    final border = Paint()
      ..color = selected ? Colors.white : color.withOpacity(0.95)
      ..style = PaintingStyle.stroke
      ..strokeWidth = selected ? 2.2 : 1.3;
    canvas.drawRRect(
      RRect.fromRectAndRadius(top, const Radius.circular(8)),
      border,
    );
    if (selected) {
      canvas.drawCircle(
        center,
        5,
        Paint()..color = Colors.white.withOpacity(0.95),
      );
    }

    _drawText(
      canvas,
      pale.id,
      Offset(top.left + 10, top.top + 9),
      const TextStyle(
        color: Colors.white,
        fontSize: 11,
        fontWeight: FontWeight.w800,
      ),
    );
  }

  @override
  bool shouldRepaint(covariant _InteriorTruckPainter oldDelegate) =>
      oldDelegate.pales != pales ||
      oldDelegate.selectedPaleId != selectedPaleId;
}

class _PaleContentPanel extends StatefulWidget {
  final Pale? pale;
  final List<Pedido> pedidos;

  const _PaleContentPanel({required this.pale, required this.pedidos});

  @override
  State<_PaleContentPanel> createState() => _PaleContentPanelState();
}

class _PaleContentPanelState extends State<_PaleContentPanel> {
  bool _isScanningNfc = false;
  String? _certifiedPaleId;
  String? _nfcStatus;

  @override
  void didUpdateWidget(covariant _PaleContentPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pale?.id != widget.pale?.id) {
      _stopNfcSession();
      setState(() {
        _certifiedPaleId = null;
        _nfcStatus = null;
      });
    }
  }

  @override
  void dispose() {
    _stopNfcSession();
    super.dispose();
  }

  Future<void> _startNfcCertification(Pale pale) async {
    if (_isScanningNfc) return;

    final isAvailable = await NfcManager.instance.isAvailable();
    if (!mounted) return;
    if (!isAvailable) {
      setState(() {
        _nfcStatus = 'NFC no disponible en este dispositivo';
      });
      return;
    }

    setState(() {
      _isScanningNfc = true;
      _nfcStatus = 'Acerca la tarjeta si quieres comprobar este palet';
    });

    try {
      await NfcManager.instance.startSession(
        onDiscovered: (_) async {
          if (!mounted) return;
          setState(() {
            _isScanningNfc = false;
            _certifiedPaleId = pale.id;
            _nfcStatus = 'Comprobación opcional completada';
          });
          await _stopNfcSession(force: true);
        },
      );
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isScanningNfc = false;
        _nfcStatus = 'No se pudo iniciar la lectura NFC';
      });
    }
  }

  Future<void> _stopNfcSession({bool force = false}) async {
    if (!_isScanningNfc && !force) return;
    try {
      await NfcManager.instance.stopSession();
    } catch (_) {
      // The native session may already be closed.
    }
    if (mounted) {
      setState(() => _isScanningNfc = false);
    } else {
      _isScanningNfc = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.pale;
    if (item == null) {
      return AppWidgets.card(
        child: const Text(
          'No hay palets cargados.',
          style: TextStyle(color: AppColors.textSecondary),
        ),
      );
    }

    final lines = _linesForPale(item.id);
    final pending = lines.where((line) => !line.entregado).toList();
    final delivered = lines.where((line) => line.entregado).toList();
    final isCertified = _certifiedPaleId == item.id;

    return AppWidgets.card(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: (item.vacio ? AppColors.green : AppColors.orange)
                      .withOpacity(0.16),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: item.vacio ? AppColors.green : AppColors.orange,
                  ),
                ),
                child: Icon(
                  Icons.view_in_ar,
                  color: item.vacio ? AppColors.green : AppColors.orange,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${item.id} · ${item.contenido}',
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${item.elementosRestantes}/${item.elementosTotales} pendientes · ${item.peso} · ${item.volumen}',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _NfcCertificationButton(
            isScanning: _isScanningNfc,
            isCertified: isCertified,
            status: _nfcStatus,
            onTap: () => _startNfcCertification(item),
          ),
          const SizedBox(height: 16),
          if (pending.isNotEmpty) ...[
            const _PanelSectionTitle('Pendiente en este palet'),
            const SizedBox(height: 8),
            ...pending.map((line) => _ProductLine(line: line)),
          ] else
            const _EmptyLine('No queda contenido pendiente en este palet.'),
          if (delivered.isNotEmpty) ...[
            const SizedBox(height: 14),
            const _PanelSectionTitle('Ya entregado'),
            const SizedBox(height: 8),
            ...delivered.map((line) => _ProductLine(line: line)),
          ],
        ],
      ),
    );
  }

  List<_PaleProductLine> _linesForPale(String paleId) {
    final result = <_PaleProductLine>[];
    for (final pedido in widget.pedidos) {
      for (final producto in pedido.productos) {
        if (producto.paleId != paleId) continue;
        result.add(
          _PaleProductLine(
            descripcion: producto.descripcion,
            cantidad: producto.cantidad,
            unidadVenta: producto.unidadVenta,
            cajasEstadisticas: producto.cajasEstadisticas,
            cliente: pedido.cliente,
            pedidoId: pedido.id,
            referencia: pedido.referencia,
            entregado: pedido.entregado,
          ),
        );
      }
    }
    return result;
  }
}

class _PaleProductLine {
  final String descripcion;
  final num cantidad;
  final String unidadVenta;
  final double cajasEstadisticas;
  final String cliente;
  final String pedidoId;
  final String referencia;
  final bool entregado;

  const _PaleProductLine({
    required this.descripcion,
    required this.cantidad,
    required this.unidadVenta,
    required this.cajasEstadisticas,
    required this.cliente,
    required this.pedidoId,
    required this.referencia,
    required this.entregado,
  });
}

class _NfcCertificationButton extends StatelessWidget {
  final bool isScanning;
  final bool isCertified;
  final String? status;
  final VoidCallback onTap;

  const _NfcCertificationButton({
    required this.isScanning,
    required this.isCertified,
    required this.status,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = isCertified
        ? AppColors.green
        : isScanning
        ? AppColors.blue
        : AppColors.orange;
    final label = isCertified
        ? 'PALET CORRECTO'
        : isScanning
        ? 'LEYENDO NFC'
        : 'COMPROBAR PALET CON NFC';

    return InkWell(
      onTap: isScanning ? null : onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withOpacity(0.14),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.9), width: 1.2),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: color.withOpacity(0.18),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                isCertified ? Icons.verified : Icons.nfc,
                color: color,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (status != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      status!,
                      style: TextStyle(
                        color: isCertified
                            ? AppColors.green
                            : AppColors.textSecondary,
                        fontSize: 12,
                        fontWeight: isCertified
                            ? FontWeight.w700
                            : FontWeight.w500,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (isScanning)
              SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(color),
                ),
              )
            else
              Icon(
                isCertified ? Icons.check_circle : Icons.chevron_right,
                color: color,
              ),
          ],
        ),
      ),
    );
  }
}

class _PanelSectionTitle extends StatelessWidget {
  final String label;
  const _PanelSectionTitle(this.label);

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: const TextStyle(
        color: AppColors.textPrimary,
        fontSize: 13,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

class _ProductLine extends StatelessWidget {
  final _PaleProductLine line;
  const _ProductLine({required this.line});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${_formatNum(line.cantidad)} ${_unitLabel(line.unidadVenta, line.cantidad)}',
            style: TextStyle(
              color: line.entregado ? AppColors.green : AppColors.orange,
              fontSize: 13,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  line.descripcion,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '${_formatNum(line.cajasEstadisticas)} ZCE · ${line.cliente} · ${line.pedidoId} · ${line.referencia}',
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyLine extends StatelessWidget {
  final String text;
  const _EmptyLine(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(text, style: const TextStyle(color: AppColors.textSecondary));
  }
}

Rect _cargoRect(Size size) => Rect.fromLTWH(
  size.width * 0.12,
  size.height * 0.17,
  size.width * 0.76,
  size.height * 0.68,
);

Offset _slotCenter(Size size, int fila, int columna) {
  final cargo = _cargoRect(size);
  final x = cargo.left + cargo.width * (columna == 0 ? 0.3 : 0.7);
  final y = cargo.top + cargo.height * ((fila.clamp(0, 2) + 0.5) / 3);
  return Offset(x, y);
}

void _drawText(Canvas canvas, String text, Offset offset, TextStyle style) {
  final painter = TextPainter(
    text: TextSpan(text: text, style: style),
    textDirection: TextDirection.ltr,
  )..layout();
  painter.paint(canvas, offset);
}

String _formatNum(num value) {
  final fixed = value.toStringAsFixed(2);
  return fixed.replaceFirst(RegExp(r',?\.?0+$'), '');
}

String _unitLabel(String unit, num quantity) {
  final singular = quantity == 1;
  switch (unit.toUpperCase()) {
    case 'CAJ':
      return singular ? 'caja' : 'cajas';
    case 'BRL':
    case 'BID':
      return singular ? 'bidón' : 'bidones';
    case 'BOT':
      return singular ? 'botella' : 'botellas';
    case 'PAK':
    case 'ZPR':
      return singular ? 'pack' : 'packs';
    case 'PQ':
      return singular ? 'paquete' : 'paquetes';
    case 'EST':
      return singular ? 'estuche' : 'estuches';
    case 'UN':
      return singular ? 'unidad' : 'unidades';
    case 'TB':
      return singular ? 'bandeja' : 'bandejas';
    case 'ZCE':
      return singular ? 'caja estadística' : 'cajas estadísticas';
    default:
      return unit.isEmpty ? 'uds.' : unit.toLowerCase();
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
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
        ),
      ],
    );
  }
}
