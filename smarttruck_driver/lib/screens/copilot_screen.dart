import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/route_provider.dart';
import '../theme/app_theme.dart';
import '../services/ai_service.dart';

class CopilotScreen extends StatefulWidget {
  const CopilotScreen({super.key});

  @override
  State<CopilotScreen> createState() => _CopilotScreenState();
}

class _CopilotScreenState extends State<CopilotScreen> with SingleTickerProviderStateMixin {
  final _controller = TextEditingController();
  final _scrollCtrl = ScrollController();
  bool _isLoading = false;
  bool _isPTT = false;
  late final AnimationController _pulseCtrl;
  late final Animation<double> _pulse;

  final List<_ChatMsg> _messages = [
    _ChatMsg(
      text: 'Hola Pedro, soy tu Copiloto IA SmartTruck. Puedo decirte dónde tienes cada producto en el camión, ayudarte con los retornos o reportar incidencias. ¿En qué te ayudo?',
      isAI: true,
    ),
  ];

  // Proactive suggestions
  final _suggestions = [
    '¿Dónde está el pedido de esta parada?',
    '¿Qué retornos tengo pendientes?',
    '¿Cuánto queda para la siguiente parada?',
    'Reportar incidencia',
    '¿Cuántos barriles debo recoger hoy?',
  ];

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
      ..repeat(reverse: true);
    _pulse = Tween(begin: 0.85, end: 1.0).animate(CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollCtrl.dispose();
    _pulseCtrl.dispose();
    super.dispose();
  }

  Future<void> _send(String text) async {
    if (text.trim().isEmpty || _isLoading) return;
    final prov = context.read<RouteProvider>();
    setState(() {
      _messages.add(_ChatMsg(text: text.trim(), isAI: false));
      _isLoading = true;
    });
    _controller.clear();
    _scrollToBottom();

    final response = await getAIResponse(text.trim(), prov.paradaActiva, prov.paletsConfig);

    if (mounted) {
      setState(() {
        _messages.add(_ChatMsg(text: response, isAI: true));
        _isLoading = false;
      });
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Header with current stop context
        Consumer<RouteProvider>(
          builder: (_, prov, __) {
            final activa = prov.paradaActiva;
            return Container(
              margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.purple.withOpacity(0.08),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.purple.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      color: AppColors.purple.withOpacity(0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.auto_awesome, color: AppColors.purple, size: 18),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Copiloto IA SmartTruck',
                          style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                        Text(
                          activa != null
                              ? 'Contexto: ${activa.nombre} · ${activa.productos.length} productos'
                              : 'Sin parada activa',
                          style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.green.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.circle, color: AppColors.green, size: 7),
                        SizedBox(width: 4),
                        Text('En línea', style: TextStyle(fontSize: 10, color: AppColors.green, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        ),

        // Chat messages
        Expanded(
          child: ListView(
            controller: _scrollCtrl,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            children: [
              // Quick suggestions
              if (_messages.length <= 1) ...[
                const Text('Preguntas frecuentes', style: TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8, runSpacing: 8,
                  children: _suggestions.map((s) => GestureDetector(
                    onTap: () => _send(s),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceHigh,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Text(s, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    ),
                  )).toList(),
                ),
                const SizedBox(height: 16),
              ],
              ..._messages.map((msg) => _MessageBubble(msg: msg)),
              if (_isLoading) const _TypingIndicator(),
            ],
          ),
        ),

        // PTT button + text input
        _InputBar(
          controller: _controller,
          onSend: _send,
          isPTT: _isPTT,
          onPTTStart: () {
            setState(() => _isPTT = true);
            HapticFeedback.mediumImpact();
          },
          onPTTEnd: () {
            setState(() => _isPTT = false);
            _send('¿Dónde están los productos de esta parada?'); // mock PTT
          },
          pulse: _pulse,
          pulseCtrl: _pulseCtrl,
        ),
      ],
    );
  }
}

class _ChatMsg {
  final String text;
  final bool isAI;
  _ChatMsg({required this.text, required this.isAI});
}

class _MessageBubble extends StatelessWidget {
  final _ChatMsg msg;
  const _MessageBubble({required this.msg});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: msg.isAI ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: msg.isAI ? AppColors.surfaceHigh : AppColors.purple.withOpacity(0.15),
          borderRadius: BorderRadius.circular(16).copyWith(
            bottomLeft: msg.isAI ? const Radius.circular(4) : null,
            bottomRight: msg.isAI ? null : const Radius.circular(4),
          ),
          border: Border.all(
            color: msg.isAI ? AppColors.border : AppColors.purple.withOpacity(0.4),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (msg.isAI) ...[
              const Icon(Icons.auto_awesome, color: AppColors.purple, size: 14),
              const SizedBox(width: 6),
            ],
            Flexible(
              child: Text(
                msg.text,
                style: const TextStyle(fontSize: 14, color: AppColors.textPrimary, height: 1.4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TypingIndicator extends StatelessWidget {
  const _TypingIndicator();

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.surfaceHigh,
          borderRadius: BorderRadius.circular(16).copyWith(bottomLeft: const Radius.circular(4)),
          border: Border.all(color: AppColors.border),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.auto_awesome, color: AppColors.purple, size: 14),
            SizedBox(width: 8),
            Text('Pensando...', style: TextStyle(fontSize: 13, color: AppColors.textMuted, fontStyle: FontStyle.italic)),
          ],
        ),
      ),
    );
  }
}

class _InputBar extends StatelessWidget {
  final TextEditingController controller;
  final Function(String) onSend;
  final bool isPTT;
  final VoidCallback onPTTStart;
  final VoidCallback onPTTEnd;
  final Animation<double> pulse;
  final AnimationController pulseCtrl;

  const _InputBar({
    required this.controller, required this.onSend, required this.isPTT,
    required this.onPTTStart, required this.onPTTEnd, required this.pulse, required this.pulseCtrl,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(16, 10, 16, MediaQuery.of(context).padding.bottom + 10),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          // PTT button
          GestureDetector(
            onLongPressStart: (_) => onPTTStart(),
            onLongPressEnd: (_) => onPTTEnd(),
            child: AnimatedBuilder(
              animation: pulse,
              builder: (_, __) => Transform.scale(
                scale: isPTT ? pulse.value : 1.0,
                child: Container(
                  width: 48, height: 48,
                  decoration: BoxDecoration(
                    color: isPTT ? AppColors.red.withOpacity(0.15) : AppColors.surfaceHigh,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isPTT ? AppColors.red : AppColors.border,
                      width: isPTT ? 2 : 1,
                    ),
                    boxShadow: isPTT ? [BoxShadow(color: AppColors.red.withOpacity(0.3), blurRadius: 12)] : null,
                  ),
                  child: Icon(
                    isPTT ? Icons.mic_rounded : Icons.mic_none_rounded,
                    color: isPTT ? AppColors.red : AppColors.textMuted,
                    size: 22,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),

          // Text input
          Expanded(
            child: TextField(
              controller: controller,
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
              maxLines: 3,
              minLines: 1,
              textInputAction: TextInputAction.send,
              onSubmitted: onSend,
              decoration: InputDecoration(
                hintText: isPTT ? 'Mantén pulsado el mic para hablar...' : 'Escribe tu pregunta...',
                hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                filled: true,
                fillColor: AppColors.surfaceHigh,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: AppColors.purple, width: 1.5),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),

          // Send button
          GestureDetector(
            onTap: () => onSend(controller.text),
            child: Container(
              width: 48, height: 48,
              decoration: BoxDecoration(
                color: AppColors.purple.withOpacity(0.15),
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.purple.withOpacity(0.4)),
              ),
              child: const Icon(Icons.send_rounded, color: AppColors.purple, size: 20),
            ),
          ),
        ],
      ),
    );
  }
}
