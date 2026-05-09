import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';
import 'detalle_screen.dart';

class ResultadoScreen extends StatelessWidget {
  final Item item;

  const ResultadoScreen({super.key, required this.item});

  @override
  Widget build(BuildContext context) {
    final itemColor = item.esPale ? AppColors.purple : AppColors.orange;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Resultado'),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Item card
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: itemColor.withOpacity(0.15),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      item.esPale ? Icons.grid_view : Icons.inventory_2,
                      color: itemColor,
                      size: 32,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    item.id,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.tipoLabel,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: (item.entregado
                              ? AppColors.green
                              : AppColors.blue)
                          .withOpacity(0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      item.estadoLabel,
                      style: TextStyle(
                        color: item.entregado
                            ? AppColors.green
                            : AppColors.blue,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Location in truck
            if (item.fila != null) ...[
              Container(
                width: double.infinity,
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
                      'Ubicación en el camión',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Mini truck grid
                    _MiniTruckGrid(highlightFila: item.fila!, highlightCol: item.columna!),
                    const SizedBox(height: 14),

                    Row(
                      children: [
                        const Icon(Icons.location_on,
                            color: AppColors.blue, size: 18),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            item.ubicacionLabel,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],

            // CTA button
            AppWidgets.primaryButton(
              label: 'VER EN EL MAPA DEL CAMIÓN',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => DetalleScreen(item: item),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _MiniTruckGrid extends StatelessWidget {
  final int highlightFila;
  final int highlightCol;

  const _MiniTruckGrid(
      {required this.highlightFila, required this.highlightCol});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(2, (col) => Expanded(
        child: Padding(
          padding: EdgeInsets.only(
              left: col == 1 ? 4 : 0, right: col == 0 ? 4 : 0),
          child: Column(
            children: List.generate(3, (fila) {
              final isHighlight =
                  fila == highlightFila && col == highlightCol;
              return Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Container(
                  height: 30,
                  decoration: BoxDecoration(
                    color: isHighlight
                        ? AppColors.primaryYellow.withOpacity(0.3)
                        : AppColors.border.withOpacity(0.5),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: isHighlight
                          ? AppColors.primaryYellow
                          : AppColors.border,
                      width: isHighlight ? 2 : 1,
                    ),
                  ),
                  child: isHighlight
                      ? const Icon(Icons.location_on,
                          color: AppColors.primaryYellow, size: 16)
                      : null,
                ),
              );
            }),
          ),
        ),
      )),
    );
  }
}
