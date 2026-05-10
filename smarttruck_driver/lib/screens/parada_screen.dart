import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';
import '../providers/app_provider.dart';

class ParadaScreen extends StatelessWidget {
  final Parada parada;

  const ParadaScreen({super.key, required this.parada});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Parada actual'),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Map placeholder
            Container(
              width: double.infinity,
              height: 180,
              decoration: BoxDecoration(
                color: const Color(0xFF1A2535),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Stack(
                children: [
                  // Grid lines
                  CustomPaint(
                    size: const Size(double.infinity, 180),
                    painter: _MapGridPainter(),
                  ),
                  // Center pin
                  const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.location_pin,
                          color: AppColors.primaryYellow,
                          size: 40,
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Ubicación aproximada',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Small dots as street indicators
                  Positioned(
                    left: 40,
                    top: 60,
                    child: Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: AppColors.blue,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                  Positioned(
                    right: 60,
                    bottom: 50,
                    child: Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: AppColors.blue,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Time
            Text(
              parada.hora,
              style: const TextStyle(
                color: AppColors.primaryYellow,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),

            // Stop name
            Text(
              parada.nombre,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 26,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 6),

            // Address
            Text(
              parada.direccion,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 15,
              ),
            ),
            const SizedBox(height: 24),

            // Accessibility bar
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
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Accesibilidad de carga',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 14,
                        ),
                      ),
                      Text(
                        '${parada.accesibilidad}%',
                        style: const TextStyle(
                          color: AppColors.green,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: parada.accesibilidad / 100,
                      backgroundColor: AppColors.border,
                      color: AppColors.green,
                      minHeight: 8,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // Arrived button
            if (!parada.completada)
              AppWidgets.primaryButton(
                label: 'HE LLEGADO',
                onTap: () {
                  context.read<AppProvider>().marcarLlegada(parada.num);
                  _showArrivedDialog(context);
                },
              ),
            const SizedBox(height: 12),
            if (!parada.completada)
              AppWidgets.outlinedButton(
                label: 'REPORTAR INCIDENCIA',
                icon: Icons.warning_amber_rounded,
                onTap: () {
                  context.read<AppProvider>().notificarIncidencia(
                    'Incidencia en ${parada.nombre}. Recalcular ruta evitando esta zona.',
                  );
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Incidencia enviada al controlador'),
                    ),
                  );
                },
              ),

            if (parada.completada)
              Container(
                width: double.infinity,
                height: 56,
                decoration: BoxDecoration(
                  color: AppColors.green.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.green.withOpacity(0.4),
                    width: 1.5,
                  ),
                ),
                child: const Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.check_circle,
                        color: AppColors.green,
                        size: 22,
                      ),
                      SizedBox(width: 8),
                      Text(
                        'LLEGADA CONFIRMADA',
                        style: TextStyle(
                          color: AppColors.green,
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 16),

            // Detalles link
            GestureDetector(
              onTap: () {},
              child: const Center(
                child: Text(
                  'Ver detalles de la parada >',
                  style: TextStyle(
                    color: AppColors.blue,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showArrivedDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          '¡Llegada confirmada!',
          style: TextStyle(color: AppColors.textPrimary),
        ),
        content: Text(
          'Has confirmado tu llegada a ${parada.nombre}.',
          style: const TextStyle(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pop(context);
            },
            child: const Text(
              'OK',
              style: TextStyle(color: AppColors.primaryYellow),
            ),
          ),
        ],
      ),
    );
  }
}

class _MapGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF1E3A5F).withOpacity(0.5)
      ..strokeWidth = 1;

    // Horizontal lines
    for (double y = 30; y < size.height; y += 30) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
    // Vertical lines
    for (double x = 40; x < size.width; x += 40) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
  }

  @override
  bool shouldRepaint(_) => false;
}
