// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smarttruck_driver/main.dart';
import 'package:smarttruck_driver/providers/app_provider.dart';

void main() {
  testWidgets('SmartTruck app smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => AppProvider(),
        child: const SmartTruckApp(),
      ),
    );
    await tester.pump(const Duration(milliseconds: 1600));
    expect(find.byType(SmartTruckApp), findsOneWidget);
  });
}
