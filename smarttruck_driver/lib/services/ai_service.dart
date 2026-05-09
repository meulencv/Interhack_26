import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/route_model.dart';

const _apiKey = String.fromEnvironment('GROQ_API_KEY', defaultValue: '');
const _model = 'meta-llama/llama-4-scout-17b-16e-instruct';
const _baseUrl = 'https://api.groq.com/openai/v1/chat/completions';

String _buildSystemPrompt(Parada? activa, List<Palet> paletsConfig) {
  final paradaInfo = activa == null
      ? 'Sin parada activa actualmente.'
      : '''Parada activa: ${activa.nombre} (${activa.tipo}) en ${activa.direccion}.
Productos a entregar:
${activa.productos.map((p) {
        final palet = paletsConfig.firstWhere((pl) => pl.id == p.paletId, orElse: () => paletsConfig.first);
        return '  - ${p.nombre} (×${p.qty}) → Palé ${palet.label} (${palet.nombre})';
      }).join('\n')}
Retornos pendientes:
${activa.retornos.where((r) => !r.recogido).map((r) {
        final palet = paletsConfig.firstWhere((pl) => pl.id == r.paletDestinoId, orElse: () => paletsConfig.first);
        return '  - ${r.nombre} (×${r.qty}) → guardar en Palé ${palet.label} (${palet.nombre})';
      }).join('\n')}
Accesibilidad de carga: ${activa.accesibilidad}%''';

  return '''Eres el Copiloto IA de SmartTruck DDI, asistente del camionero.
Responde SIEMPRE en español. Sé conciso (máx. 2-3 frases). No uses markdown.
Ayuda al conductor con ubicación de productos en el camión, retornos, rutas e incidencias.

$paradaInfo

El camión tiene configuración 6P: 3 palés por lateral (Izquierdo/Derecho), posiciones Frontal/Central/Trasero.
Las lonas se abren lateralmente para acceder a la carga.''';
}

Future<String> getAIResponse(String userMessage, Parada? activa, List<Palet> paletsConfig) async {
  if (_apiKey.isEmpty) {
    return _mockResponse(userMessage, activa, paletsConfig);
  }

  try {
    final resp = await http.post(
      Uri.parse(_baseUrl),
      headers: {
        'Authorization': 'Bearer $_apiKey',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'model': _model,
        'messages': [
          {'role': 'system', 'content': _buildSystemPrompt(activa, paletsConfig)},
          {'role': 'user', 'content': userMessage},
        ],
        'max_tokens': 150,
        'temperature': 0.5,
      }),
    );
    if (resp.statusCode == 200) {
      final data = jsonDecode(resp.body);
      return data['choices'][0]['message']['content'].toString().trim();
    }
    return _mockResponse(userMessage, activa, paletsConfig);
  } catch (_) {
    return _mockResponse(userMessage, activa, paletsConfig);
  }
}

String _mockResponse(String msg, Parada? activa, List<Palet> paletsConfig) {
  final lower = msg.toLowerCase();
  if (activa == null) return 'No hay ninguna parada activa en este momento.';

  if (lower.contains('dónde') || lower.contains('donde') || lower.contains('palé') || lower.contains('palet')) {
    if (activa.productos.isEmpty) return 'No hay productos pendientes para ${activa.nombre}.';
    final firstProd = activa.productos.first;
    final palet = paletsConfig.firstWhere((p) => p.id == firstProd.paletId, orElse: () => paletsConfig.first);
    final lado = palet.lado == PaletSide.izquierdo ? 'IZQUIERDA' : 'DERECHA';
    return 'Los productos de ${activa.nombre} están en Palé ${palet.label}, LONA $lado. '
        '${activa.productos.length > 1 ? "Son ${activa.productos.length} referencias en total." : ""}';
  }

  if (lower.contains('retorno') || lower.contains('vacío') || lower.contains('barril')) {
    if (activa.retornos.isEmpty) return 'No hay retornos pendientes para esta parada.';
    final r = activa.retornos.first;
    final palet = paletsConfig.firstWhere((p) => p.id == r.paletDestinoId, orElse: () => paletsConfig.first);
    return 'Los ${r.nombre} (×${r.qty}) van al Palé ${palet.label}, ${palet.nombre}. Guárdalos bien asegurados.';
  }

  if (lower.contains('siguiente') || lower.contains('próxima') || lower.contains('proxima')) {
    return 'Después de ${activa.nombre} tienes ${activa.kmSiguiente ?? "?"}km a la próxima parada, unos ${activa.minSiguiente ?? "?"}min. Comprueba los retornos antes de salir.';
  }

  if (lower.contains('incidencia') || lower.contains('problema') || lower.contains('accidente')) {
    return 'Incidencia registrada. Te sugiero informar a central por el canal de radio y marcar la parada como incidencia en el sistema.';
  }

  if (lower.contains('accesib')) {
    return 'La accesibilidad de esta parada es ${activa.accesibilidad}%. ${activa.accesibilidad >= 80 ? "Acceso directo, no necesitas mover nada." : "Puede que necesites recolocar algún palé."}';
  }

  return 'En ${activa.nombre}: tienes ${activa.productos.length} referencias a entregar y ${activa.retornos.where((r) => !r.recogido).length} retornos pendientes. ¿Necesitas más detalle?';
}
