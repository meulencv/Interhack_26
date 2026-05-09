import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'providers/route_provider.dart';
import 'screens/route_screen.dart';
import 'screens/truck_load_screen.dart';
import 'screens/retornos_screen.dart';
import 'screens/copilot_screen.dart';
import 'screens/scanner_screen.dart';
import 'theme/app_theme.dart';
import 'models/mock_data.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: AppColors.surface,
    systemNavigationBarIconBrightness: Brightness.light,
  ));
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  runApp(const SmartTruckApp());
}

class SmartTruckApp extends StatelessWidget {
  const SmartTruckApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => RouteProvider(),
      child: MaterialApp(
        title: 'SmartTruck DDI',
        debugShowCheckedModeBanner: false,
        theme: buildAppTheme(),
        home: const _SplashGate(),
      ),
    );
  }
}

class _SplashGate extends StatefulWidget {
  const _SplashGate();

  @override
  State<_SplashGate> createState() => _SplashGateState();
}

class _SplashGateState extends State<_SplashGate> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _fade;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeIn);
    _ctrl.forward().whenComplete(() {
      Future.delayed(const Duration(milliseconds: 1400), () {
        if (mounted) setState(() => _ready = true);
      });
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_ready) return const MainShell();
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: FadeTransition(
        opacity: _fade,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 80, height: 80,
                decoration: BoxDecoration(
                  color: AppColors.amber.withOpacity(0.12),
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.amber.withOpacity(0.4), width: 2),
                ),
                child: const Icon(Icons.local_shipping_rounded, color: AppColors.amber, size: 40),
              ),
              const SizedBox(height: 20),
              const Text('SmartTruck', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: AppColors.textPrimary, letterSpacing: -0.5)),
              const Text('DDI · Repartidor', style: TextStyle(fontSize: 14, color: AppColors.textSecondary, letterSpacing: 1)),
              const SizedBox(height: 32),
              const SizedBox(
                width: 120,
                child: LinearProgressIndicator(
                  backgroundColor: AppColors.border,
                  valueColor: AlwaysStoppedAnimation(AppColors.amber),
                  minHeight: 2,
                  borderRadius: BorderRadius.all(Radius.circular(1)),
                ),
              ),
              const SizedBox(height: 12),
              Text('Hola, ${driverInfo.nombre}', style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
              Text('Ruta ${driverInfo.ruta} · ${driverInfo.zona}', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
            ],
          ),
        ),
      ),
    );
  }
}

class MainShell extends StatelessWidget {
  const MainShell({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<RouteProvider>(
      builder: (_, prov, __) {
        return Scaffold(
          backgroundColor: AppColors.bg,
          appBar: _SmartTruckAppBar(prov: prov),
          body: IndexedStack(
            index: prov.activeTab,
            children: const [
              RouteScreen(),
              TruckLoadScreen(),
              RetornosScreen(),
              CopilotScreen(),
              ScannerScreen(),
            ],
          ),
          bottomNavigationBar: _BottomNav(prov: prov),
        );
      },
    );
  }
}

class _SmartTruckAppBar extends StatelessWidget implements PreferredSizeWidget {
  final RouteProvider prov;
  const _SmartTruckAppBar({required this.prov});

  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context) {
    final activa = prov.paradaActiva;
    return AppBar(
      backgroundColor: AppColors.surface,
      elevation: 0,
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(height: 1, color: AppColors.border),
      ),
      title: Row(
        children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(
              color: AppColors.amber.withOpacity(0.12),
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.amber.withOpacity(0.3)),
            ),
            child: const Icon(Icons.local_shipping_rounded, color: AppColors.amber, size: 16),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('SmartTruck DDI', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
              Text(
                activa != null
                    ? 'Parada ${activa.num}/${prov.total} · ${activa.nombre}'
                    : '${prov.completadas}/${prov.total} completadas',
                style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
              ),
            ],
          ),
        ],
      ),
      actions: [
        Container(
          margin: const EdgeInsets.only(right: 8),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: AppColors.green.withOpacity(0.1),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.green.withOpacity(0.3)),
          ),
          child: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: AppColors.green, size: 13),
              const SizedBox(width: 5),
              Text('${prov.completadas}/${prov.total}',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.green)),
            ],
          ),
        ),
        Container(
          margin: const EdgeInsets.only(right: 12),
          width: 36, height: 36,
          decoration: BoxDecoration(
            color: AppColors.surfaceHigh,
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.border),
          ),
          child: const Icon(Icons.person_rounded, color: AppColors.textSecondary, size: 18),
        ),
      ],
    );
  }
}

class _BottomNav extends StatelessWidget {
  final RouteProvider prov;
  const _BottomNav({required this.prov});

  @override
  Widget build(BuildContext context) {
    final items = [
      (Icons.map_rounded, Icons.map_outlined, 'Ruta'),
      (Icons.view_in_ar_rounded, Icons.view_in_ar_outlined, 'Carga'),
      (Icons.keyboard_return_rounded, Icons.keyboard_return_outlined, 'Retornos'),
      (Icons.auto_awesome_rounded, Icons.auto_awesome_outlined, 'Copiloto'),
      (Icons.qr_code_scanner_rounded, Icons.qr_code_scanner_rounded, 'Escáner'),
    ];

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        child: Row(
          children: items.asMap().entries.map((entry) {
            final i = entry.key;
            final (activeIcon, inactiveIcon, label) = entry.value;
            final isActive = prov.activeTab == i;
            final color = isActive ? AppColors.amber : AppColors.textMuted;

            return Expanded(
              child: GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  prov.setTab(i);
                },
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 200),
                        child: Icon(isActive ? activeIcon : inactiveIcon, color: color, size: 24, key: ValueKey(isActive)),
                      ),
                      const SizedBox(height: 3),
                      Text(label, style: TextStyle(fontSize: 10, fontWeight: isActive ? FontWeight.w700 : FontWeight.w400, color: color)),
                      const SizedBox(height: 2),
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        height: 3, width: isActive ? 20 : 0,
                        decoration: BoxDecoration(color: AppColors.amber, borderRadius: BorderRadius.circular(2)),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}
