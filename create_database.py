#!/usr/bin/env python3
import json
import sqlite3
import os
import glob

def create_database():
    """Create the SQLite database from the schema file"""
    # Remove existing database if it exists
    if os.path.exists('emerald_objects.db'):
        os.remove('emerald_objects.db')
    
    # Create a new database
    conn = sqlite3.connect('emerald_objects.db')
    cursor = conn.cursor()
    
    # Read and execute the schema
    with open('schema.sql', 'r') as schema_file:
        schema = schema_file.read()
        cursor.executescript(schema)
    
    conn.commit()
    return conn, cursor

def insert_object(cursor, obj_data):
    """Insert an object and its related data into the database"""
    # Extract basic object information
    name = obj_data.get('name', '')
    url = obj_data.get('url', '')
    status = obj_data.get('result', {}).get('status', '')
    
    # Extract ID from the URL or name
    obj_id = None
    if 'id:' in url:
        obj_id = url.split('id:')[1].rstrip(')')
    elif 'id:' in name:
        obj_id = name.split('id:')[1].rstrip(']')
    
    if not obj_id:
        # Generate a unique ID if none is found
        obj_id = f"generated_{hash(name)}"
    
    # Insert the object
    cursor.execute(
        "INSERT INTO objects (id, name, url, status) VALUES (?, ?, ?, ?)",
        (obj_id, name, url, status)
    )
    
    # Insert image if available
    result = obj_data.get('result', {})
    if result and 'img' in result and result['img'] is not None and 'src' in result['img']:
        cursor.execute(
            "INSERT INTO object_images (object_id, image_src) VALUES (?, ?)",
            (obj_id, result['img']['src'])
        )
    
    # Process sections
    sections = result.get('sections', [])
    for section in sections:
        section_name = section.get('name', '')
        
        # Insert section
        cursor.execute(
            "INSERT INTO sections (object_id, name) VALUES (?, ?)",
            (obj_id, section_name)
        )
        section_id = cursor.lastrowid
        
        # Process records in the section
        records = section.get('records', [])
        for record in records:
            field = record.get('field', {})
            field_name = field.get('name', '')
            field_description = field.get('description', '')
            
            # Insert or get field
            cursor.execute(
                "SELECT id FROM fields WHERE name = ?", (field_name,)
            )
            field_result = cursor.fetchone()
            
            if field_result:
                field_id = field_result[0]
            else:
                cursor.execute(
                    "INSERT INTO fields (name, description) VALUES (?, ?)",
                    (field_name, field_description)
                )
                field_id = cursor.lastrowid
            
            # Insert record
            cursor.execute(
                "INSERT INTO records (section_id, field_id) VALUES (?, ?)",
                (section_id, field_id)
            )
            record_id = cursor.lastrowid
            
            # Process value based on its kind
            value_data = record.get('value', {})
            kind = value_data.get('kind', '')
            
            if kind == 'scalar':
                cursor.execute(
                    "INSERT INTO scalar_values (record_id, value) VALUES (?, ?)",
                    (record_id, value_data.get('value', ''))
                )
            elif kind == 'link':
                cursor.execute(
                    "INSERT INTO link_values (record_id, link) VALUES (?, ?)",
                    (record_id, value_data.get('link', ''))
                )
            elif kind == 'list':
                for list_value in value_data.get('values', []):
                    cursor.execute(
                        "INSERT INTO list_values (record_id, value) VALUES (?, ?)",
                        (record_id, list_value)
                    )
                    
                    # Special handling for specific fields
                    if field_name == 'Synonyms':
                        cursor.execute(
                            "INSERT INTO object_synonyms (object_id, synonym) VALUES (?, ?)",
                            (obj_id, list_value)
                        )
                    elif field_name == 'Authors':
                        cursor.execute(
                            "INSERT INTO object_authors (object_id, author_id) VALUES (?, ?)",
                            (obj_id, list_value)
                        )
                    elif field_name == 'ContainerMaterials':
                        cursor.execute(
                            "INSERT OR IGNORE INTO container_specifications (object_id) VALUES (?)",
                            (obj_id,)
                        )
                        cursor.execute(
                            "UPDATE container_specifications SET material = ? WHERE object_id = ?",
                            (list_value, obj_id)
                        )
                    elif field_name == 'Graduations':
                        cursor.execute(
                            "INSERT INTO container_graduations (object_id, graduation) VALUES (?, ?)",
                            (obj_id, list_value)
                        )
                    elif field_name == 'CompatibleCoverTypes':
                        cursor.execute(
                            "INSERT OR IGNORE INTO container_compatibility (object_id) VALUES (?)",
                            (obj_id,)
                        )
                        cursor.execute(
                            "UPDATE container_compatibility SET compatible_cover_type = ? WHERE object_id = ?",
                            (list_value, obj_id)
                        )
                    elif field_name == 'CompatibleCoverFootprints':
                        cursor.execute(
                            "INSERT OR IGNORE INTO container_compatibility (object_id) VALUES (?)",
                            (obj_id,)
                        )
                        cursor.execute(
                            "UPDATE container_compatibility SET compatible_cover_footprint = ? WHERE object_id = ?",
                            (list_value, obj_id)
                        )
                    elif field_name == 'Products':
                        cursor.execute(
                            "INSERT INTO container_products (object_id, product_id) VALUES (?, ?)",
                            (obj_id, list_value)
                        )
            
            elif kind == 'subtable':
                subtable = value_data.get('subtable', {})
                
                # Insert subtable
                cursor.execute(
                    "INSERT INTO subtables (record_id) VALUES (?)",
                    (record_id,)
                )
                subtable_id = cursor.lastrowid
                
                # Insert headers
                headers = subtable.get('header', [])
                for i, header in enumerate(headers):
                    cursor.execute(
                        "INSERT INTO subtable_headers (subtable_id, position, header_text) VALUES (?, ?, ?)",
                        (subtable_id, i, header)
                    )
                
                # Insert rows
                rows = subtable.get('rows', [])
                for row_idx, row in enumerate(rows):
                    cursor.execute(
                        "INSERT INTO subtable_rows (subtable_id, row_position) VALUES (?, ?)",
                        (subtable_id, row_idx)
                    )
                    row_id = cursor.lastrowid
                    
                    # Insert cells
                    for col_idx, cell in enumerate(row):
                        if isinstance(cell, dict):
                            cell_kind = cell.get('kind', '')
                            cell_value = cell.get('value', '') if cell_kind == 'scalar' else cell.get('link', '')
                            
                            cursor.execute(
                                "INSERT INTO subtable_cells (row_id, column_position, value_type, value) VALUES (?, ?, ?, ?)",
                                (row_id, col_idx, cell_kind, cell_value)
                            )
                            
                            # Special handling for dimensions
                            if field_name == 'Dimensions' and headers:
                                if col_idx < len(headers):
                                    header_text = headers[col_idx]
                                    if header_text == 'X Direction (Width)':
                                        cursor.execute(
                                            "INSERT OR IGNORE INTO container_dimensions (object_id) VALUES (?)",
                                            (obj_id,)
                                        )
                                        cursor.execute(
                                            "UPDATE container_dimensions SET width = ? WHERE object_id = ?",
                                            (cell_value, obj_id)
                                        )
                                    elif header_text == 'Y Direction (Depth)':
                                        cursor.execute(
                                            "INSERT OR IGNORE INTO container_dimensions (object_id) VALUES (?)",
                                            (obj_id,)
                                        )
                                        cursor.execute(
                                            "UPDATE container_dimensions SET depth = ? WHERE object_id = ?",
                                            (cell_value, obj_id)
                                        )
                                    elif header_text == 'Z Direction (Height)':
                                        cursor.execute(
                                            "INSERT OR IGNORE INTO container_dimensions (object_id) VALUES (?)",
                                            (obj_id,)
                                        )
                                        cursor.execute(
                                            "UPDATE container_dimensions SET height = ? WHERE object_id = ?",
                                            (cell_value, obj_id)
                                        )
                            
                            # Special handling for positions
                            if field_name == 'Positions' and headers:
                                if len(row) >= 5 and len(headers) >= 5:
                                    position_name = row[0].get('value', '') if isinstance(row[0], dict) and 'value' in row[0] else ''
                                    footprint = row[1].get('value', '') if len(row) > 1 and isinstance(row[1], dict) and 'value' in row[1] else ''
                                    max_width = row[2].get('value', '') if len(row) > 2 and isinstance(row[2], dict) and 'value' in row[2] else ''
                                    max_depth = row[3].get('value', '') if len(row) > 3 and isinstance(row[3], dict) and 'value' in row[3] else ''
                                    max_height = row[4].get('value', '') if len(row) > 4 and isinstance(row[4], dict) and 'value' in row[4] else ''
                                    
                                    if position_name:
                                        cursor.execute(
                                            "INSERT INTO container_positions (object_id, position_name, footprint, max_width, max_depth, max_height) VALUES (?, ?, ?, ?, ?, ?)",
                                            (obj_id, position_name, footprint, max_width, max_depth, max_height)
                                        )
                            
                            # Special handling for connectors
                            if field_name == 'Connectors' and headers:
                                if len(row) >= 6 and len(headers) >= 6:
                                    connector_name = row[0].get('value', '') if isinstance(row[0], dict) and 'value' in row[0] else ''
                                    connector_type = row[1].get('value', '') if len(row) > 1 and isinstance(row[1], dict) and 'value' in row[1] else ''
                                    thread_type = row[2].get('value', '') if len(row) > 2 and isinstance(row[2], dict) and 'value' in row[2] else ''
                                    inner_diameter = row[3].get('value', '') if len(row) > 3 and isinstance(row[3], dict) and 'value' in row[3] else ''
                                    outer_diameter = row[4].get('value', '') if len(row) > 4 and isinstance(row[4], dict) and 'value' in row[4] else ''
                                    gender = row[5].get('value', '') if len(row) > 5 and isinstance(row[5], dict) and 'value' in row[5] else ''
                                    
                                    if connector_name:
                                        cursor.execute(
                                            "INSERT INTO container_connectors (object_id, connector_name, connector_type, thread_type, inner_diameter, outer_diameter, gender) VALUES (?, ?, ?, ?, ?, ?, ?)",
                                            (obj_id, connector_name, connector_type, thread_type, inner_diameter, outer_diameter, gender)
                                        )
            
            # Handle specific fields for container specifications
            if kind == 'scalar':
                scalar_value = value_data.get('value', '')
                
                # Container specifications
                if field_name in ['Opaque', 'SelfStanding', 'TransportStable', 'TareWeight', 'TareWeightDistribution', 'Resolution', 'MinTemperature', 'MaxTemperature', 'MinVolume', 'MaxVolume']:
                    cursor.execute(
                        "INSERT OR IGNORE INTO container_specifications (object_id) VALUES (?)",
                        (obj_id,)
                    )
                    
                    field_map = {
                        'Opaque': 'opaque',
                        'SelfStanding': 'self_standing',
                        'TransportStable': 'transport_stable',
                        'TareWeight': 'tare_weight',
                        'TareWeightDistribution': 'tare_weight_distribution',
                        'Resolution': 'resolution',
                        'MinTemperature': 'min_temperature',
                        'MaxTemperature': 'max_temperature',
                        'MinVolume': 'min_volume',
                        'MaxVolume': 'max_volume'
                    }
                    
                    db_field = field_map.get(field_name)
                    if db_field:
                        cursor.execute(
                            f"UPDATE container_specifications SET {db_field} = ? WHERE object_id = ?",
                            (scalar_value, obj_id)
                        )
                
                # Container dimensions
                elif field_name in ['CrossSectionalShape', 'InternalDiameter', 'Aperture', 'InternalDepth', 'InternalBottomShape']:
                    cursor.execute(
                        "INSERT OR IGNORE INTO container_dimensions (object_id) VALUES (?)",
                        (obj_id,)
                    )
                    
                    field_map = {
                        'CrossSectionalShape': 'cross_sectional_shape',
                        'InternalDiameter': 'internal_diameter',
                        'Aperture': 'aperture',
                        'InternalDepth': 'internal_depth',
                        'InternalBottomShape': 'internal_bottom_shape'
                    }
                    
                    db_field = field_map.get(field_name)
                    if db_field:
                        cursor.execute(
                            f"UPDATE container_dimensions SET {db_field} = ? WHERE object_id = ?",
                            (scalar_value, obj_id)
                        )
                
                # Container compatibility
                elif field_name in ['PreferredBalance', 'PreferredCamera', 'PreferredMixer', 'PreferredWashBin']:
                    cursor.execute(
                        "INSERT OR IGNORE INTO container_compatibility (object_id) VALUES (?)",
                        (obj_id,)
                    )
                    
                    field_map = {
                        'PreferredBalance': 'preferred_balance',
                        'PreferredCamera': 'preferred_camera',
                        'PreferredMixer': 'preferred_mixer',
                        'PreferredWashBin': 'preferred_wash_bin'
                    }
                    
                    db_field = field_map.get(field_name)
                    if db_field:
                        cursor.execute(
                            f"UPDATE container_compatibility SET {db_field} = ? WHERE object_id = ?",
                            (scalar_value, obj_id)
                        )
                
                # Container properties
                elif field_name in ['Reusability', 'Sterile', 'DisposableCaps', 'Stocked', 'CleaningMethod']:
                    cursor.execute(
                        "INSERT OR IGNORE INTO container_properties (object_id) VALUES (?)",
                        (obj_id,)
                    )
                    
                    field_map = {
                        'Reusability': 'reusability',
                        'Sterile': 'sterile',
                        'DisposableCaps': 'disposable_caps',
                        'Stocked': 'stocked',
                        'CleaningMethod': 'cleaning_method'
                    }
                    
                    db_field = field_map.get(field_name)
                    if db_field:
                        cursor.execute(
                            f"UPDATE container_properties SET {db_field} = ? WHERE object_id = ?",
                            (scalar_value, obj_id)
                        )
            
            # Handle link values for specific fields
            elif kind == 'link':
                link_value = value_data.get('link', '')
                
                if field_name == 'DefaultStorageCondition':
                    cursor.execute(
                        "INSERT OR IGNORE INTO container_properties (object_id) VALUES (?)",
                        (obj_id,)
                    )
                    cursor.execute(
                        "UPDATE container_properties SET default_storage_condition = ? WHERE object_id = ?",
                        (link_value, obj_id)
                    )

def process_json_files(conn, cursor, json_dir):
    """Process all JSON files in the specified directory"""
    # Find all JSON files in the directory
    json_files = glob.glob(os.path.join(json_dir, '*.json'))
    
    for json_file in json_files:
        print(f"Processing {json_file}...")
        
        try:
            with open(json_file, 'r') as f:
                data = json.load(f)
                
                # Process each object in the JSON file
                for obj in data:
                    try:
                        insert_object(cursor, obj)
                    except Exception as e:
                        print(f"Error processing object in {json_file}: {e}")
                        continue
            
            conn.commit()
            print(f"Completed processing {json_file}")
        except Exception as e:
            print(f"Error processing file {json_file}: {e}")
            continue

def main():
    # Create the database
    conn, cursor = create_database()
    
    # Process all JSON files in the objects directory
    json_dir = 'emerald-scraper/objects'
    process_json_files(conn, cursor, json_dir)
    
    # Close the connection
    conn.close()
    print("Database creation completed successfully!")

if __name__ == "__main__":
    main() 