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

# Flutter replacements
flutter_dir = '/Users/meulen/development/Interhack/smarttruck_driver/lib'
flutter_replacements = [
    (r'\bTipoItem\.pale\b', 'TipoItem.pedido'),
    (r'\bTipoItem\.paquete\b', 'TipoItem.elemento'),
    (r'\besPale\b', 'esPedido'),
    (r'\besPaquete\b', 'esElemento'),
    (r"'Palé'", "'Pedido'"),
    (r"'Paquete'", "'Elemento'"),
    (r"'Palés'", "'Pedidos'"),
    (r"'Paquetes'", "'Elementos'"),
    (r'\btotalPales\b', 'totalPedidos'),
    (r'\btotalPaquetes\b', 'totalElementos'),
    (r'\bPAL-', 'PED-'),
    (r'\bPKG-', 'ELM-'),
    (r'Paquetes / Palés', 'Elementos / Pedidos'),
    (r'Paquete \(pendiente\)', 'Elemento (pendiente)'),
    (r'Palé \(pendiente\)', 'Pedido (pendiente)'),
    (r'Buscar paquete o palé', 'Buscar elemento o pedido'),
    (r'Paquetes y palés', 'Elementos y pedidos'),
    (r'\bpale\b', 'pedido'),
    (r'\bpaquete\b', 'elemento'),
]

for root, _, files in os.walk(flutter_dir):
    for f in files:
        if f.endswith('.dart'):
            replace_in_file(os.path.join(root, f), flutter_replacements)

# React replacements
react_dir = '/Users/meulen/development/Interhack/logioptiai/src'
react_replacements = [
    (r'\bpalets\b', 'pedidos'),
    (r'\bPalets\b', 'Pedidos'),
    (r'\bpalés\b', 'pedidos'),
    (r'\bPalés\b', 'Pedidos'),
    (r'\bpalé\b', 'pedido'),
    (r'\bPalé\b', 'Pedido'),
    (r'\bpallets\b', 'pedidos'),
    (r'\bPallets\b', 'Pedidos'),
    (r'\bpalletData\b', 'pedidoData'),
    (r'\bPalet\b', 'Pedido'),
    (r'\bpalet\b', 'pedido'),
    (r'\bbuildPallets\b', 'buildPedidos'),
]

for root, _, files in os.walk(react_dir):
    for f in files:
        if f.endswith(('.jsx', '.js', '.css')):
            replace_in_file(os.path.join(root, f), react_replacements)

