WORKBOOK_SPECS: dict[str, dict[str, dict[str, object]]] = {
    "Hackaton.xlsx": {
        "Detalle entrega": {"header_row": 1, "classification": "structured"},
        "Cabecera Transporte": {"header_row": 1, "classification": "structured"},
        "Direcciones": {"header_row": 1, "classification": "structured"},
        "ZONAS": {"header_row": 1, "classification": "structured"},
        "Materiales zubic": {"header_row": 1, "classification": "structured"},
    },
    "ZM040.XLSX": {
        "Sheet1": {"header_row": 1, "classification": "structured"},
    },
    "Horarios Entrega.XLSX": {
        "Sheet1": {"header_row": 1, "classification": "structured"},
    },
    "Layout Mollet.xlsx": {
        "DDI MOLLET": {"header_row": 4, "classification": "semi_structured"},
        "Detalle": {"header_row": 3, "classification": "semi_structured"},
        "RESUMEN DDI MOLLET": {"header_row": 3, "classification": "semi_structured"},
        "Hoja5": {"header_row": 3, "classification": "semi_structured"},
    },
}
