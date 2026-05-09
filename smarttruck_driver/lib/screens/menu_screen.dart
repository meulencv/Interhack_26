import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../providers/app_provider.dart';
import 'buscar_screen.dart';
import 'camion_screen.dart';

class MenuScreen extends StatelessWidget {
  const MenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Menú',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Pedro García · DDI Driver',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 28),

              _MenuSection(
                title: 'Herramientas',
                items: [
                  _MenuItem(
                    icon: Icons.search,
                    label: 'Buscar paquete o palé',
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => const BuscarScreen()),
                    ),
                  ),
                  _MenuItem(
                    icon: Icons.local_shipping,
                    label: 'Ver camión',
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => const CamionScreen()),
                    ),
                  ),
                  _MenuItem(
                    icon: Icons.view_in_ar,
                    label: 'Interior del camión',
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => const InteriorCamionScreen()),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              _MenuSection(
                title: 'Ruta',
                items: [
                  _MenuItem(
                    icon: Icons.route,
                    label: 'Ver ruta completa',
                    onTap: () => context.read<AppProvider>().setTab(1),
                  ),
                  _MenuItem(
                    icon: Icons.inventory_2,
                    label: 'Paquetes y palés',
                    onTap: () => context.read<AppProvider>().setTab(2),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              _MenuSection(
                title: 'Sesión',
                items: [
                  _MenuItem(
                    icon: Icons.info_outline,
                    label: 'Sobre SmartTruck DDI',
                    onTap: () {},
                  ),
                  _MenuItem(
                    icon: Icons.logout,
                    label: 'Cerrar sesión',
                    color: Colors.redAccent,
                    onTap: () {},
                  ),
                ],
              ),
              const SizedBox(height: 32),

              const Center(
                child: Text(
                  'SmartTruck DDI v1.0.0',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MenuSection extends StatelessWidget {
  final String title;
  final List<_MenuItem> items;

  const _MenuSection({required this.title, required this.items});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Text(
            title,
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.8,
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            children: items.asMap().entries.map((entry) {
              final i = entry.key;
              final item = entry.value;
              return Column(
                children: [
                  _MenuItemTile(item: item),
                  if (i < items.length - 1)
                    const Divider(
                        height: 1, thickness: 0.5, color: AppColors.border),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }
}

class _MenuItem {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;

  const _MenuItem({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
  });
}

class _MenuItemTile extends StatelessWidget {
  final _MenuItem item;

  const _MenuItemTile({required this.item});

  @override
  Widget build(BuildContext context) {
    final color = item.color ?? AppColors.textPrimary;
    return InkWell(
      onTap: item.onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Icon(item.icon, color: color, size: 22),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                item.label,
                style: TextStyle(
                  color: color,
                  fontSize: 15,
                ),
              ),
            ),
            Icon(Icons.chevron_right, color: AppColors.textMuted, size: 20),
          ],
        ),
      ),
    );
  }
}
