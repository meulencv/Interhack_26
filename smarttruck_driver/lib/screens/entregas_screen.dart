import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';
import '../providers/app_provider.dart';
import 'parada_screen.dart';

class EntregasScreen extends StatefulWidget {
  const EntregasScreen({super.key});

  @override
  State<EntregasScreen> createState() => _EntregasScreenState();
}

class _EntregasScreenState extends State<EntregasScreen> {
  bool _showingPendientes = true;

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    final list = _showingPendientes
        ? provider.paradasPendientes
        : provider.paradasCompletadas;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 20, 20, 0),
              child: Text(
                'Entregas',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Toggle tabs
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                padding: const EdgeInsets.all(4),
                child: Row(
                  children: [
                    _Tab(
                      label: 'Pendientes',
                      count: provider.pendientes,
                      selected: _showingPendientes,
                      onTap: () => setState(() => _showingPendientes = true),
                    ),
                    _Tab(
                      label: 'Completadas',
                      count: provider.completadas,
                      selected: !_showingPendientes,
                      onTap: () => setState(() => _showingPendientes = false),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Subtitle
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text(
                'Hoy · ${provider.totalParadas} paradas',
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 14,
                ),
              ),
            ),
            const SizedBox(height: 12),

            // List
            Expanded(
              child: list.isEmpty
                  ? const Center(
                      child: Text(
                        'No hay paradas en esta categoría',
                        style: TextStyle(color: AppColors.textMuted),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      itemCount: list.length,
                      separatorBuilder: (context, index) =>
                          const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final parada = list[index];
                        return _ParadaListItem(
                          parada: parada,
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => ParadaScreen(parada: parada),
                              ),
                            );
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  const _Tab({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected ? AppColors.primaryYellow : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Center(
            child: Text(
              '$label ($count)',
              style: TextStyle(
                color: selected ? Colors.black : AppColors.textSecondary,
                fontSize: 14,
                fontWeight: selected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ParadaListItem extends StatelessWidget {
  final Parada parada;
  final VoidCallback onTap;

  const _ParadaListItem({required this.parada, required this.onTap});

  Color get _statusColor {
    switch (parada.estado) {
      case EstadoParada.completada:
        return AppColors.green;
      case EstadoParada.activa:
        return AppColors.primaryYellow;
      case EstadoParada.pendiente:
        return AppColors.textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: parada.activa
                ? AppColors.primaryYellow.withOpacity(0.4)
                : AppColors.border,
          ),
        ),
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            // Number circle
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: _statusColor.withOpacity(0.15),
                shape: BoxShape.circle,
                border: Border.all(color: _statusColor.withOpacity(0.4)),
              ),
              child: Center(
                child: parada.completada
                    ? Icon(Icons.check, color: _statusColor, size: 18)
                    : Text(
                        '${parada.num}',
                        style: TextStyle(
                          color: _statusColor,
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
              ),
            ),
            const SizedBox(width: 12),

            // Name and address
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          parada.nombre,
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      if (parada.activa)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.primaryYellow.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            'Activa',
                            style: TextStyle(
                              color: AppColors.primaryYellow,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      const SizedBox(width: 8),
                      Text(
                        parada.hora,
                        style: const TextStyle(
                          color: AppColors.primaryYellow,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    parada.direccion,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}
