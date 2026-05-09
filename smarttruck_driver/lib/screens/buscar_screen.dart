import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';
import '../providers/app_provider.dart';
import 'resultado_screen.dart';

class BuscarScreen extends StatefulWidget {
  const BuscarScreen({super.key});

  @override
  State<BuscarScreen> createState() => _BuscarScreenState();
}

class _BuscarScreenState extends State<BuscarScreen> {
  final _controller = TextEditingController();
  List<Item> _results = [];
  bool _searched = false;

  void _search(String query) {
    final provider = context.read<AppProvider>();
    setState(() {
      _searched = query.isNotEmpty;
      _results = provider.searchItems(query);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.read<AppProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Buscar paquete o palé'),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Search field
            Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: TextField(
                controller: _controller,
                autofocus: true,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: InputDecoration(
                  hintText: 'Buscar por ID o referencia',
                  hintStyle:
                      const TextStyle(color: AppColors.textMuted, fontSize: 15),
                  prefixIcon: const Icon(Icons.search,
                      color: AppColors.textMuted, size: 22),
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.qr_code_scanner,
                        color: AppColors.textMuted),
                    onPressed: () {
                      // Simulate barcode scan with PAL-001
                      _controller.text = 'PAL-001';
                      _search('PAL-001');
                    },
                  ),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 14),
                ),
                onChanged: _search,
                onSubmitted: (val) {
                  if (_results.isNotEmpty) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ResultadoScreen(item: _results.first),
                      ),
                    );
                  }
                },
              ),
            ),
            const SizedBox(height: 28),

            // Search results or suggestions
            if (_searched && _results.isEmpty)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'No se encontraron resultados',
                    style: TextStyle(color: AppColors.textMuted),
                  ),
                ),
              )
            else if (_searched)
              ...[
                const Text(
                  'Resultados',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 10),
                ..._results.map((item) => _SuggestionTile(
                      item: item,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ResultadoScreen(item: item),
                        ),
                      ),
                    )),
              ]
            else ...[
              const Text(
                'Sugerencias recientes',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 10),
              ...provider.sugerenciasRecientes.map((item) => _SuggestionTile(
                    item: item,
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ResultadoScreen(item: item),
                      ),
                    ),
                  )),
            ],
            const SizedBox(height: 24),

            // Divider with text
            Row(
              children: const [
                Expanded(child: Divider(color: AppColors.border)),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12),
                  child: Text(
                    'o escanear código',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 13,
                    ),
                  ),
                ),
                Expanded(child: Divider(color: AppColors.border)),
              ],
            ),
            const SizedBox(height: 20),

            // Scan button
            AppWidgets.outlinedButton(
              label: 'ESCANEAR',
              icon: Icons.qr_code_scanner,
              onTap: () {
                _controller.text = 'PAL-001';
                _search('PAL-001');
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _SuggestionTile extends StatelessWidget {
  final Item item;
  final VoidCallback onTap;

  const _SuggestionTile({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: (item.esPale ? AppColors.purple : AppColors.orange)
                      .withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  item.esPale ? Icons.grid_view : Icons.inventory_2,
                  color:
                      item.esPale ? AppColors.purple : AppColors.orange,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.id,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      item.tipoLabel,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppColors.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}
