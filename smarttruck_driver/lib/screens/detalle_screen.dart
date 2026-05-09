import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';
import '../providers/app_provider.dart';

class DetalleScreen extends StatefulWidget {
  final Pedido pedido;

  const DetalleScreen({super.key, required this.pedido});

  @override
  State<DetalleScreen> createState() => _DetalleScreenState();
}

class _DetalleScreenState extends State<DetalleScreen> {
  bool _entregado = false;

  @override
  void initState() {
    super.initState();
    _entregado = widget.pedido.entregado;
  }

  @override
  Widget build(BuildContext context) {
    if (_entregado && widget.pedido.entregado) {
      return _buildSuccessScreen(context);
    }
    return _buildDetalleScreen(context);
  }

  Widget _buildDetalleScreen(BuildContext context) {
    final pedido = widget.pedido;
    final itemColor = AppColors.orange;
    final provider = context.read<AppProvider>();

    String destino;
    try {
      destino = provider.paradas.firstWhere((p) => p.num == pedido.paradaNum).nombre;
    } catch (_) {
      destino = 'Desconocido';
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Detalle del Pedido'),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header card
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
                      Icons.local_shipping,
                      color: itemColor,
                      size: 32,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    pedido.id,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    pedido.cliente,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: (pedido.entregado ? AppColors.green : AppColors.blue).withOpacity(0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      pedido.entregado ? 'Entregado' : 'Pendiente',
                      style: TextStyle(
                        color: pedido.entregado ? AppColors.green : AppColors.blue,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Info rows
            Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  _InfoRow(label: 'Destino', value: destino, isFirst: true),
                  _InfoRow(label: 'Referencia', value: pedido.referencia, isLast: true),
                ],
              ),
            ),
            const SizedBox(height: 20),

            const Text(
              'Productos del pedido',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),

            ...pedido.productos.map((prod) => Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: AppColors.purple.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.grid_view, color: AppColors.purple),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              prod.descripcion,
                              style: const TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.w500),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Tomar de: ${prod.paleId}',
                              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        'x${prod.cantidad}',
                        style: const TextStyle(color: AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                )),
            const SizedBox(height: 28),

            // Action button
            if (!pedido.entregado)
              AppWidgets.primaryButton(
                label: 'ENTREGAR PEDIDO',
                onTap: () {
                  provider.entregarPedido(pedido.id);
                  setState(() => _entregado = true);
                },
              )
            else
              Container(
                width: double.infinity,
                height: 56,
                decoration: BoxDecoration(
                  color: AppColors.green.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.green.withOpacity(0.4), width: 1.5),
                ),
                child: const Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check_circle, color: AppColors.green, size: 22),
                      SizedBox(width: 8),
                      Text(
                        'YA ENTREGADO',
                        style: TextStyle(color: AppColors.green, fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildSuccessScreen(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: AppColors.green.withOpacity(0.15),
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.green.withOpacity(0.4), width: 2),
                ),
                child: const Icon(
                  Icons.check_circle,
                  color: AppColors.green,
                  size: 70,
                ),
              ),
              const SizedBox(height: 28),
              const Text(
                '¡Entregado!',
                style: TextStyle(
                  color: AppColors.green,
                  fontSize: 36,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                widget.pedido.id,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'El pedido y sus elementos se han descontado del palé.',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 15,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),
              AppWidgets.primaryButton(
                label: 'VER SIGUIENTE ENTREGA',
                onTap: () {
                  Navigator.of(context).popUntil((r) => r.isFirst);
                  context.read<AppProvider>().setTab(1);
                },
              ),
              const SizedBox(height: 14),
              AppWidgets.outlinedButton(
                label: 'VOLVER A ENTREGAS',
                onTap: () {
                  Navigator.of(context).popUntil((r) => r.isFirst);
                  context.read<AppProvider>().setTab(1);
                },
              ),
            ],
          ),
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
