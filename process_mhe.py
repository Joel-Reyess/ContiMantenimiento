import pandas as pd
import os

excel_path = r'c:/Users/cmons/Downloads/MHE Software_Data Update (1)(4).xlsx'

# Mapeo manual de prefijos basado en el prompt
prefijos_data = [
    ('Carro Libro', '916', '21'),
    ('Cassette de Cojín', '916', '11'),
    ('Cassette de Costado', '916', '10'),
    ('Cassette de Breaker', '916', '20'),
    ('Cassette de capa', '916', '12'),
    ('Flat Storage', '916', '68'),
    ('Tambo', '916', '14'),
    ('Pin Rack', '916', '13')
]

# Mapeo a Enum
tipo_vehiculo_mapping = {
    'Carro Libro': 5,
    'Cassette de Cojín': 6,
    'Cassette de Costado': 7,
    'Cassette de Breaker': 8,
    'Cassette de capa': 9,
    'Flat Storage': 14,
    'Carro de polvos': 4,
    'Tambo': 10,
    'Pin Rack': 11,
    'Conti': 12,
    'Jaulas de cuarentena': 13,
    'Círculo': 15
}

sql_output = []
sql_output.append("-- SCRIPT DE ACTUALIZACIÓN MHE")
sql_output.append("BEGIN TRANSACTION;")
sql_output.append("GO")
sql_output.append("")

xl = pd.ExcelFile(excel_path)

# 1. ÁREAS
sql_output.append("-- 1. ÁREAS")
try:
    areas_sheet = xl.parse('Área', header=None)
    all_excel_areas = set()
    for col in areas_sheet.columns:
        vals = areas_sheet[col].dropna().unique()
        for v in vals:
            v_str = str(v).strip()
            if v_str and v_str not in ['Departamento', 'Área', '-', 'Depto/Área']:
                all_excel_areas.add(v_str)

    for area in sorted(list(all_excel_areas)):
        sql_output.append(f"IF NOT EXISTS (SELECT 1 FROM Areas WHERE Nombre = '{area}')")
        sql_output.append(f"BEGIN")
        sql_output.append(f"    INSERT INTO Areas (Nombre, Activa, CreatedAt) VALUES ('{area}', 1, GETUTCDATE());")
        sql_output.append(f"END")
        sql_output.append("GO")
except Exception as e:
    sql_output.append(f"-- Error procesando áreas: {str(e)}")

sql_output.append("")

# 2. PREFIJOS
sql_output.append("-- 2. PREFIJOS")
for nombre, planta, pref in prefijos_data:
    tipo_id = tipo_vehiculo_mapping[nombre]
    pref_completo = planta + pref
    sql_output.append(f"IF EXISTS (SELECT 1 FROM VehiculoPrefijoConfigs WHERE TipoVehiculoId = {tipo_id})")
    sql_output.append(f"BEGIN")
    sql_output.append(f"    UPDATE VehiculoPrefijoConfigs SET PrefijoCodigo = '{pref_completo}', UpdatedAt = GETUTCDATE() WHERE TipoVehiculoId = {tipo_id};")
    sql_output.append(f"END")
    sql_output.append(f"ELSE")
    sql_output.append(f"BEGIN")
    sql_output.append(f"    INSERT INTO VehiculoPrefijoConfigs (TipoVehiculoId, PrefijoCodigo, Activo, CreatedAt) VALUES ({tipo_id}, '{pref_completo}', 1, GETUTCDATE());")
    sql_output.append(f"END")
    sql_output.append("GO")

sql_output.append("")

# 3. CONTENEDORES
sql_output.append("-- 3. CONTENEDORES")
try:
    cont_sheet_raw = xl.parse('Contenedores Registrados', header=None)
    target_row_idx = -1
    for i in range(len(cont_sheet_raw)):
        row_str = " ".join([str(v) for v in cont_sheet_raw.iloc[i].values])
        if "Carro Libro" in row_str:
            target_row_idx = i
            break
            
    if target_row_idx != -1:
        headers = cont_sheet_raw.iloc[target_row_idx]
        for col_idx in range(len(headers)):
            tipo_nombre_excel = str(headers.iloc[col_idx]).strip()
            matched_tipo_id = None
            for key, val in tipo_vehiculo_mapping.items():
                if key.lower() in tipo_nombre_excel.lower():
                    matched_tipo_id = val
                    break
            
            if matched_tipo_id:
                column_data = cont_sheet_raw.iloc[target_row_idx+1:, col_idx]
                for val in column_data:
                    c_str = str(val).strip()
                    if c_str.endswith('.0'): c_str = c_str[:-2]
                    if c_str and c_str.isdigit() and len(c_str) >= 8:
                        sql_output.append(f"IF NOT EXISTS (SELECT 1 FROM Vehiculos WHERE Codigo = '{c_str}')")
                        sql_output.append(f"BEGIN")
                        sql_output.append(f"    INSERT INTO Vehiculos (Codigo, Tipo, Estado, Ubicacion, Activo, CreatedAt) VALUES ('{c_str}', {matched_tipo_id}, 1, 1, 1, GETUTCDATE());")
                        sql_output.append(f"END")
                        sql_output.append("GO")
except Exception as e:
    sql_output.append(f"-- Error procesando contenedores: {str(e)}")

sql_output.append("")
sql_output.append("COMMIT;")
sql_output.append("GO")

with open('Carga_MHE_Final.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_output))
print("Script generado exitosamente corregido con bloques BEGIN/END y GO.")
