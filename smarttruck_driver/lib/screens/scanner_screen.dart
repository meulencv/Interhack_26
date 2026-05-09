import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _scanCtrl;
  late final Animation<double> _scanAnim;
  bool _nfcMode = true;
  bool _scanning = false;
  _ScanResult? _lastResult;

  final _mockNFCResults = const [
    _ScanResult(
      tipo: 'NFC', codigo: 'DDI-PAL-I-F-001',
      titulo: 'Palé I·F verificado',
      subtitulo: 'Palé Izquierdo Frontal · Camión B-4521-KL',
      isOk: true,
      color: AppColors.green,
      productos: ['Estrella Damm 33cl ×24 (×4)', 'Barril 30L Estrella Damm (×2)'],
    ),
    _ScanResult(
      tipo: 'NFC', codigo: 'DDI-BAR-30L-0847',
      titulo: 'Barril identificado',
      subtitulo: 'Barril 30L Estrella Damm · Retornable',
      isOk: true,
      color: AppColors.amber,
      productos: ['RETORNABLE · Devolver a almacén'],
    ),
    _ScanResult(
      tipo: 'NFC', codigo: 'DDI-PAL-D-T-006',
      titulo: '⚠️ Palé incorrecto',
      subtitulo: 'Palé D·T no corresponde a esta parada',
      isOk: false,
      color: AppColors.red,
      productos: ['Hotel Arts · Parada #4 (aún pendiente)'],
    ),
  ];

  final _mockCameraResults = const [
    _ScanResult(
      tipo: 'CÁMARA', codigo: 'IMG-RECO-001',
      titulo: 'Estrella Damm 1/3 detectada',
      subtitulo: 'Caja de 20 latas 33cl · 1 ZCE',
      isOk: true,
      color: AppColors.amber,
      productos: ['Bar Can Pepet · Palé I·C (Izq. Central)'],
    ),
    _ScanResult(
      tipo: 'CÁMARA', codigo: 'IMG-RECO-002',
      titulo: 'Barril 30L detectado',
      subtitulo: 'Barril Moritz 30L · Retornable · 4 ZCE',
      isOk: true,
      color: AppColors.blue,
      productos: ['Bar Can Pepet · Palé I·T (Izq. Trasero)', 'Guardar vacío en: Palé I·F'],
    ),
  ];

  int _resultIdx = 0;

  @override
  void initState() {
    super.initState();
    _scanCtrl = AnimationController(vsync: this, duration: const Duration(seconds: 2))..repeat();
    _scanAnim = Tween<double>(begin: 0, end: 1).animate(_scanCtrl);
  }

  @override
  void dispose() {
    _scanCtrl.dispose();
    super.dispose();
  }

  void _startScan() {
    if (_scanning) return;
    setState(() { _scanning = true; _lastResult = null; });
    HapticFeedback.lightImpact();
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (!mounted) return;
      final results = _nfcMode ? _mockNFCResults : _mockCameraResults;
      HapticFeedback.mediumImpact();
      setState(() {
        _scanning = false;
        _lastResult = results[_resultIdx % results.length];
        _resultIdx++;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
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
                  Text('Escáner Smart', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                  Text('NFC · Visión Artificial · Validación', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                ],
              ),
              const Spacer(),
              // Mode toggle
              Container(
                decoration: BoxDecoration(
                  color: AppColors.surfaceHigh,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    _ModeTab(label: 'NFC', isActive: _nfcMode, onTap: () => setState(() => _nfcMode = true)),
                    _ModeTab(label: 'Cámara', isActive: !_nfcMode, onTap: () => setState(() => _nfcMode = false)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Scanner viewport
          GestureDetector(
            onTap: _startScan,
            child: Container(
              height: 220,
              width: double.infinity,
              decoration: BoxDecoration(
                color: const Color(0xFF050B16),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: _scanning ? AppColors.amber : AppColors.border,
                  width: _scanning ? 2 : 1,
                ),
              ),
              child: Stack(
                children: [
                  // Simulated camera view
                  ClipRRect(
                    borderRadius: BorderRadius.circular(19),
                    child: Container(
                      decoration: const BoxDecoration(
                        gradient: RadialGradient(
                          colors: [Color(0xFF0D1525), Color(0xFF060C1A)],
                          radius: 1.5,
                        ),
                      ),
                    ),
                  ),

                  // Scanning animation
                  if (_scanning)
                    AnimatedBuilder(
                      animation: _scanAnim,
                      builder: (_, __) => Positioned(
                        top: _scanAnim.value * 200,
                        left: 20, right: 20,
                        child: Container(
                          height: 2,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Colors.transparent, AppColors.amber, Colors.transparent],
                            ),
                            boxShadow: [BoxShadow(color: AppColors.amber.withOpacity(0.5), blurRadius: 8)],
                          ),
                        ),
                      ),
                    ),

                  // Corner markers
                  ..._corners(),

                  // Center content
                  Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _nfcMode ? Icons.nfc_rounded : Icons.camera_enhance_rounded,
                          color: _scanning ? AppColors.amber : AppColors.textMuted,
                          size: 48,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          _scanning
                              ? (_nfcMode ? 'Buscando tag NFC...' : 'Analizando imagen...')
                              : (_nfcMode ? 'Acerca el palé o barril' : 'Apunta al producto o etiqueta'),
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: _scanning ? AppColors.amber : AppColors.textMuted,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        if (!_scanning) ...[
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            decoration: BoxDecoration(
                              color: AppColors.amber.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: AppColors.amber.withOpacity(0.3)),
                            ),
                            child: const Text('TAP PARA ESCANEAR', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.amber, letterSpacing: 1)),
                          ),
                        ],
                      ],
                    ),
                  ),

                  // Mode badge
                  Positioned(
                    top: 12, left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.surface.withOpacity(0.85),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(_nfcMode ? Icons.nfc_rounded : Icons.camera_rounded, color: AppColors.amber, size: 12),
                          const SizedBox(width: 4),
                          Text(_nfcMode ? 'NFC' : 'IA Vision', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.amber)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          const Center(
            child: Text('Toca el área para simular el escaneo', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
          ),
          const SizedBox(height: 20),

          // Result
          if (_lastResult != null) _ResultCard(result: _lastResult!),

          // Use cases
          const Text('FUNCIONES DISPONIBLES',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1.5)),
          const SizedBox(height: 10),
          _UseCase(
            icon: Icons.nfc_rounded, color: AppColors.green,
            titulo: 'Validación de palés',
            desc: 'Lee el tag NFC del palé para confirmar que es el correcto para esta parada.',
          ),
          _UseCase(
            icon: Icons.qr_code_scanner_rounded, color: AppColors.amber,
            titulo: 'Identificación de producto',
            desc: 'Apunta la cámara a cualquier producto para saber su ZCE, si es retornable y dónde va.',
          ),
          _UseCase(
            icon: Icons.local_shipping_rounded, color: AppColors.blue,
            titulo: 'Check-in de camión',
            desc: 'Escanea el NFC del camión para asociarte automáticamente a tu vehículo y ruta.',
          ),
          _UseCase(
            icon: Icons.warning_amber_rounded, color: AppColors.red,
            titulo: 'Detección de errores',
            desc: 'La IA avisa si intentas subir un retorno al palé incorrecto o a un camión equivocado.',
          ),
        ],
      ),
    );
  }

  List<Widget> _corners() {
    const size = 20.0;
    const thick = 2.5;
    const pad = 20.0;
    final color = _scanning ? AppColors.amber : AppColors.textMuted.withOpacity(0.4);
    return [
      Positioned(top: pad, left: pad, child: _Corner(color: color, size: size, thick: thick, top: true, left: true)),
      Positioned(top: pad, right: pad, child: _Corner(color: color, size: size, thick: thick, top: true, left: false)),
      Positioned(bottom: pad, left: pad, child: _Corner(color: color, size: size, thick: thick, top: false, left: true)),
      Positioned(bottom: pad, right: pad, child: _Corner(color: color, size: size, thick: thick, top: false, left: false)),
    ];
  }
}

class _Corner extends StatelessWidget {
  final Color color;
  final double size, thick;
  final bool top, left;
  const _Corner({required this.color, required this.size, required this.thick, required this.top, required this.left});

  @override
  Widget build(BuildContext context) => SizedBox(
    width: size, height: size,
    child: CustomPaint(painter: _CornerPainter(color: color, thick: thick, top: top, left: left)),
  );
}

class _CornerPainter extends CustomPainter {
  final Color color;
  final double thick;
  final bool top, left;
  _CornerPainter({required this.color, required this.thick, required this.top, required this.left});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color..strokeWidth = thick..style = PaintingStyle.stroke..strokeCap = StrokeCap.square;
    final x = left ? 0.0 : size.width;
    final y = top ? 0.0 : size.height;
    final dx = left ? size.width : -size.width;
    final dy = top ? size.height : -size.height;
    canvas.drawLine(Offset(x, y), Offset(x + dx, y), paint);
    canvas.drawLine(Offset(x, y), Offset(x, y + dy), paint);
  }

  @override
  bool shouldRepaint(_) => false;
}

class _ModeTab extends StatelessWidget {
  final String label;
  final bool isActive;
  final VoidCallback onTap;
  const _ModeTab({required this.label, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: isActive ? AppColors.amber.withOpacity(0.15) : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(label, style: TextStyle(
        fontSize: 12, fontWeight: FontWeight.w700,
        color: isActive ? AppColors.amber : AppColors.textMuted,
      )),
    ),
  );
}

class _ScanResult {
  final String tipo, codigo, titulo, subtitulo;
  final bool isOk;
  final Color color;
  final List<String> productos;
  const _ScanResult({
    required this.tipo, required this.codigo, required this.titulo,
    required this.subtitulo, required this.isOk, required this.color, required this.productos,
  });
}

class _ResultCard extends StatelessWidget {
  final _ScanResult result;
  const _ResultCard({required this.result});

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 20),
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: result.color.withOpacity(0.08),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: result.color.withOpacity(0.5), width: 2),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(result.isOk ? Icons.check_circle_rounded : Icons.error_rounded, color: result.color, size: 22),
            const SizedBox(width: 10),
            Expanded(child: Text(result.titulo, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: result.color))),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(color: result.color.withOpacity(0.12), borderRadius: BorderRadius.circular(6)),
              child: Text(result.tipo, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: result.color)),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(result.subtitulo, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
        const SizedBox(height: 10),
        ...result.productos.map((p) => Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(children: [
            const Icon(Icons.arrow_right_rounded, color: AppColors.textMuted, size: 16),
            Expanded(child: Text(p, style: const TextStyle(fontSize: 12, color: AppColors.textPrimary))),
          ]),
        )),
        const SizedBox(height: 4),
        Text(result.codigo, style: const TextStyle(fontSize: 10, color: AppColors.textMuted, fontFamily: 'monospace')),
      ],
    ),
  );
}

class _UseCase extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String titulo, desc;
  const _UseCase({required this.icon, required this.color, required this.titulo, required this.desc});

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.surfaceHigh,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: AppColors.border),
    ),
    child: Row(
      children: [
        Container(
          width: 44, height: 44,
          decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, color: color, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(titulo, style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              const SizedBox(height: 2),
              Text(desc, style: const TextStyle(fontSize: 12, color: AppColors.textMuted, height: 1.3)),
            ],
          ),
        ),
      ],
    ),
  );
}
