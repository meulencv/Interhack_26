import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';
import '../providers/app_provider.dart';
import 'detalle_screen.dart';

class ResultadoScreen extends StatelessWidget {
  final dynamic item; // Pedido o Pale

  const ResultadoScreen({super.key, required this.item});

  @override
  Widget build(BuildContext context) {
    if (item is Pedido) {
      return DetalleScreen(pedido: item as Pedido);
    }
    
    final pale = item as Pale;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Detalle de Palé'),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
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
                      color: AppColors.purple.withOpacity(0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.grid_view, color: AppColors.purple, size: 32),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    pale.id,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  const Text('Palé', style: TextStyle(color: AppColors.textSecondary, fontSize: 15)),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  _InfoRow(label: 'Contenido', value: pale.contenido, isFirst: true),
                  _InfoRow(label: 'Peso', value: pale.peso),
                  _InfoRow(label: 'Volumen', value: pale.volumen),
                  _InfoRow(label: 'Elementos Restantes', value: '${pale.elementosRestantes} / ${pale.elementosTotales}'),
                  _InfoRow(label: 'Ubicación', value: pale.ubicacionLabel, isLast: true),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isFirst;
  final bool isLast;

  const _InfoRow({required this.label, required this.value, this.isFirst = false, this.isLast = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border(
          bottom: isLast ? BorderSide.none : const BorderSide(color: AppColors.border, width: 0.5),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 15)),
          Text(value, style: const TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
