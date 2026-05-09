import os
import re

def replace_in_file(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for old, new in replacements:
        new_content = re.sub(old, new, new_content)
        
    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {path}")

flutter_dir = '/Users/meulen/development/Interhack/smarttruck_driver/lib'
flutter_replacements = [
    (r'\bTipoItem\.pedido\b', 'TipoItem.pale'),
    (r'\bTipoItem\.elemento\b', 'TipoItem.paquete'),
    (r'\besPedido\b', 'esPale'),
    (r'\besElemento\b', 'esPaquete'),
    (r"'Pedido'", "'Palé'"),
    (r"'Elemento'", "'Paquete'"),
    (r"'Pedidos'", "'Palés'"),
    (r"'Elementos'", "'Paquetes'"),
    (r'\btotalPedidos\b', 'totalPales'),
    (r'\btotalElementos\b', 'totalPaquetes'),
    (r'\bPED-', 'PAL-'),
    (r'\bELM-', 'PKG-'),
    (r'Elementos / Pedidos', 'Paquetes / Palés'),
    (r'Elemento \(pendiente\)', 'Paquete (pendiente)'),
    (r'Pedido \(pendiente\)', 'Palé (pendiente)'),
    (r'Buscar elemento o pedido', 'Buscar paquete o palé'),
    (r'Elementos y pedidos', 'Paquetes y palés'),
]

for root, _, files in os.walk(flutter_dir):
    for f in files:
        if f.endswith('.dart'):
            replace_in_file(os.path.join(root, f), flutter_replacements)

