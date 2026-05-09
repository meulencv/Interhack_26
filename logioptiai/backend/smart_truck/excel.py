from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET
from zipfile import ZipFile
import re


NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkgrel": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def _column_to_number(label: str) -> int:
    result = 0
    for char in label:
        if char.isalpha():
            result = result * 26 + ord(char.upper()) - 64
    return result


def _dedupe_headers(headers: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    deduped: list[str] = []
    for index, value in enumerate(headers, start=1):
        clean = (value or "").strip() or f"column_{index}"
        seen[clean] = seen.get(clean, 0) + 1
        if seen[clean] > 1:
            clean = f"{clean}__{seen[clean]}"
        deduped.append(clean)
    return deduped


@dataclass
class SheetFrame:
    name: str
    header_row: int
    columns: list[str]
    rows: list[dict[str, str]]


class WorkbookReader:
    def __init__(self, path: Path):
        self.path = path

    def sheet_names(self) -> list[str]:
        with ZipFile(self.path) as archive:
            workbook = ET.fromstring(archive.read("xl/workbook.xml"))
            return [
                sheet.attrib["name"]
                for sheet in workbook.findall("main:sheets/main:sheet", NS)
            ]

    def read_sheet(
        self, sheet_name: str, header_row: int = 1, limit: int | None = None
    ) -> SheetFrame:
        records = list(self.iter_rows(sheet_name, header_row=header_row, limit=limit))
        columns = list(records[0].keys()) if records else self._read_headers(sheet_name, header_row)
        return SheetFrame(sheet_name, header_row, list(columns), records)

    def iter_rows(
        self, sheet_name: str, header_row: int = 1, limit: int | None = None
    ) -> Iterable[dict[str, str]]:
        with ZipFile(self.path) as archive:
            shared_strings = self._read_shared_strings(archive)
            target = self._sheet_target(archive, sheet_name)
            with archive.open(target) as sheet_handle:
                context = ET.iterparse(sheet_handle, events=("end",))
                headers: list[str] | None = None
                current_row = 0
                yielded = 0
                for _, element in context:
                    if element.tag != f"{{{NS['main']}}}row":
                        continue
                    current_row += 1
                    values = self._row_values(element, shared_strings)
                    if current_row == header_row:
                        headers = _dedupe_headers(values)
                    elif headers and current_row > header_row and any(value.strip() for value in values):
                        padded_values = values + [""] * max(0, len(headers) - len(values))
                        yield {
                            headers[index]: padded_values[index]
                            for index in range(len(headers))
                        }
                        yielded += 1
                        if limit is not None and yielded >= limit:
                            return
                    element.clear()

    def sheet_size(self, sheet_name: str) -> tuple[int, int]:
        with ZipFile(self.path) as archive:
            sheet_xml = archive.read(self._sheet_target(archive, sheet_name))
            root = ET.fromstring(sheet_xml)
            dimension = root.find("main:dimension", NS)
            if dimension is None:
                return (0, 0)
            reference = dimension.attrib.get("ref", "")
            if ":" not in reference:
                return (0, 0)
            _, end_reference = reference.split(":", 1)
            match = re.match(r"([A-Z]+)(\d+)", end_reference)
            if not match:
                return (0, 0)
            return (int(match.group(2)), _column_to_number(match.group(1)))

    def preview(
        self, sheet_name: str, header_row: int = 1, preview_rows: int = 3
    ) -> dict[str, object]:
        frame = self.read_sheet(sheet_name, header_row=header_row, limit=preview_rows)
        return {
            "sheet": frame.name,
            "header_row": frame.header_row,
            "columns": frame.columns,
            "preview_rows": frame.rows,
        }

    def _read_headers(self, sheet_name: str, header_row: int) -> list[str]:
        with ZipFile(self.path) as archive:
            shared_strings = self._read_shared_strings(archive)
            target = self._sheet_target(archive, sheet_name)
            with archive.open(target) as sheet_handle:
                context = ET.iterparse(sheet_handle, events=("end",))
                current_row = 0
                for _, element in context:
                    if element.tag != f"{{{NS['main']}}}row":
                        continue
                    current_row += 1
                    if current_row == header_row:
                        headers = _dedupe_headers(self._row_values(element, shared_strings))
                        element.clear()
                        return headers
                    element.clear()
        return []

    @staticmethod
    def _read_shared_strings(archive: ZipFile) -> list[str]:
        try:
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        except KeyError:
            return []
        strings: list[str] = []
        for item in root.findall("main:si", NS):
            strings.append(
                "".join(text.text or "" for text in item.iterfind(".//main:t", NS))
            )
        return strings

    @staticmethod
    def _sheet_target(archive: ZipFile, sheet_name: str) -> str:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_map = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in rels.findall("pkgrel:Relationship", NS)
        }
        for sheet in workbook.findall("main:sheets/main:sheet", NS):
            if sheet.attrib["name"] == sheet_name:
                rel_id = sheet.attrib.get(f"{{{NS['rel']}}}id")
                target = rel_map[rel_id]
                if not target.startswith("xl/"):
                    target = f"xl/{target}"
                return target
        raise KeyError(f"Sheet '{sheet_name}' not found in {archive.filename}")

    @staticmethod
    def _row_values(row: ET.Element, shared_strings: list[str]) -> list[str]:
        values_by_column: dict[int, str] = {}
        for cell in row.findall("main:c", NS):
            reference = cell.attrib.get("r", "")
            match = re.match(r"([A-Z]+)(\d+)", reference)
            if not match:
                continue
            column = _column_to_number(match.group(1))
            values_by_column[column] = WorkbookReader._cell_value(cell, shared_strings)

        if not values_by_column:
            return []
        last_column = max(values_by_column)
        return [values_by_column.get(index, "").strip() for index in range(1, last_column + 1)]

    @staticmethod
    def _cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
        cell_type = cell.attrib.get("t")
        value_node = cell.find("main:v", NS)
        if cell_type == "inlineStr":
            return "".join(
                item.text or "" for item in cell.findall(".//main:t", NS)
            )
        if value_node is None:
            return ""
        raw_value = value_node.text or ""
        if cell_type == "s":
            if raw_value.isdigit():
                index = int(raw_value)
                if 0 <= index < len(shared_strings):
                    return shared_strings[index]
        return raw_value


def iter_sheet_rows(
    workbook: Path, sheet_name: str, header_row: int = 1
) -> Iterable[dict[str, str]]:
    frame = WorkbookReader(workbook).read_sheet(sheet_name, header_row=header_row)
    yield from frame.rows
