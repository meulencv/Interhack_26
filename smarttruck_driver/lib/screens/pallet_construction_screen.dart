import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class PalletConstructionScreen extends StatelessWidget {
  const PalletConstructionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Construcción del palet'),
        backgroundColor: AppColors.surface,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
        titleTextStyle: const TextStyle(
          color: AppColors.textPrimary,
          fontSize: 20,
          fontWeight: FontWeight.bold,
        ),
      ),
      body: Center(
        child: InteractiveViewer(
          minScale: 0.5,
          maxScale: 4.0,
          child: Image.asset(
            'assets/pallet_construction.png',
            fit: BoxFit.contain,
          ),
        ),
      ),
    );
  }
}
