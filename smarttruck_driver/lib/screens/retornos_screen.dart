import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/route_provider.dart';
import '../models/route_model.dart';
import '../theme/app_theme.dart';

class RetornosScreen extends StatelessWidget {
  const RetornosScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<RouteProvider>(
      builder: (_, prov, __) {
        final allRetornos = <_RetornoEntry>[];
        for (final parada in prov.paradas) {
          for (final r in parada.retornos) {
            allRetornos.add(_RetornoEntry(
              retorno: r, parada: parada, paletsConfig: prov.paletsConfig,
            ));
          }
        }
        final pendientes = allRetornos.where((e) => !e.retorno.recogido).toList();
        final recogidos = allRetornos.where((e) => e.retorno.recogido).toList();
        final totalUnidades = pendientes.fold(0, (s, e) => s + e.retorno.qty);

        return SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Logística Inversa', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                      Text('Gestión de retornos y vacíos', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                    ],
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.orange.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.orange.withOpacity(0.4)),
                    ),
                    child: Column(
                      children: [
                        Text('$totalUnidades', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.orange)),
                        const Text('pendientes', style: TextStyle(fontSize: 10, color: AppColors.textMuted)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // DDI info banner
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surfaceHigh,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline_rounded, color: AppColors.blue, size: 18),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        '~60% de la mercancía DDI es retornable. Barriles y cajas vacías deben volver al almacén en el palé asignado.',
                        style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              if (pendientes.isNotEmpty) ...[
                const Text('PENDIENTES DE RECOGER',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1.5)),
                const SizedBox(height: 10),
                ...pendientes.map((e) => _RetornoCard(entry: e, isPendiente: true)),
                const SizedBox(height: 20),
              ],

              if (recogidos.isNotEmpty) ...[
                const Text('YA RECOGIDOS',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.green, letterSpacing: 1.5)),
                const SizedBox(height: 10),
                ...recogidos.map((e) => _RetornoCard(entry: e, isPendiente: false)),
              ],

              if (allRetornos.isEmpty)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: Column(
                      children: [
                        Icon(Icons.check_circle_rounded, color: AppColors.green, size: 48),
                        SizedBox(height: 12),
                        Text('Sin retornos pendientes', style: TextStyle(fontSize: 16, color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                ),

              // Summary legend
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surfaceHigh,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('TIPOS DE RETORNABLES', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1.5)),
                    const SizedBox(height: 10),
                    _RetornableType(nombre: 'Barriles 30L', desc: '4 ZCE · más habitual', icon: '🛢️'),
                    _RetornableType(nombre: 'Barriles 20L', desc: '2.5 ZCE · medianos', icon: '🪣'),
                    _RetornableType(nombre: 'Cajas vacías', desc: '1 ZCE · apilables', icon: '📦'),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _RetornoEntry {
  final Retorno retorno;
  final Parada parada;
  final List<Palet> paletsConfig;
  _RetornoEntry({required this.retorno, required this.parada, required this.paletsConfig});

  Palet get paletDestino => paletsConfig.firstWhere(
    (p) => p.id == retorno.paletDestinoId,
    orElse: () => paletsConfig.first,
  );
}

class _RetornoCard extends StatelessWidget {
  final _RetornoEntry entry;
  final bool isPendiente;
  const _RetornoCard({required this.entry, required this.isPendiente});

  @override
  Widget build(BuildContext context) {
    final color = isPendiente ? AppColors.orange : AppColors.green;
    final statusIcon = isPendiente ? Icons.pending_rounded : Icons.check_circle_rounded;

    return Opacity(
      opacity: isPendiente ? 1.0 : 0.6,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withOpacity(0.06),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.25)),
        ),
        child: Row(
          children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(statusIcon, color: color, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(entry.retorno.nombre, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary)),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      const Icon(Icons.store_rounded, size: 11, color: AppColors.textMuted),
                      const SizedBox(width: 4),
                      Text(entry.parada.nombre, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                    ],
                  ),
                  if (isPendiente) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.arrow_forward_rounded, size: 12, color: AppColors.blue),
                        const SizedBox(width: 4),
                        Text('Guardar en: ${entry.paletDestino.label} · ${entry.paletDestino.nombre}',
                          style: const TextStyle(fontSize: 11, color: AppColors.blue, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('×${entry.retorno.qty}', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: color)),
                Text(entry.parada.estado == StopStatus.completada ? 'Entregada' : entry.parada.eta,
                  style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RetornableType extends StatelessWidget {
  final String nombre;
  final String desc;
  final String icon;
  const _RetornableType({required this.nombre, required this.desc, required this.icon});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(
      children: [
        Text(icon, style: const TextStyle(fontSize: 20)),
        const SizedBox(width: 10),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(nombre, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
            Text(desc, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
          ],
        ),
      ],
    ),
  );
}
