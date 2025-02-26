#!/usr/bin/env python3
import csv
import re
from collections import defaultdict

def read_field_definitions(csv_file):
    """Read field definitions from CSV file"""
    fields = []
    with open(csv_file, 'r') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header
        for row in reader:
            if len(row) >= 2:
                name = row[0].strip('"')
                description = row[1].strip('"')
                fields.append((name, description))
    return fields

def categorize_fields(fields):
    """Categorize fields into groups based on their names and descriptions"""
    categories = defaultdict(list)
    
    # Define category patterns
    patterns = {
        'container': re.compile(r'container|vessel|bottle|tube|plate|rack|tray', re.I),
        'dimension': re.compile(r'dimension|width|height|depth|diameter|volume|size|shape', re.I),
        'material': re.compile(r'material|composition|made of', re.I),
        'temperature': re.compile(r'temperature|thermal|heat|cold|freeze|thaw', re.I),
        'pressure': re.compile(r'pressure|vacuum|atmosphere', re.I),
        'time': re.compile(r'time|duration|period|interval', re.I),
        'weight': re.compile(r'weight|mass|density', re.I),
        'electrical': re.compile(r'voltage|current|power|electrical|electronic', re.I),
        'optical': re.compile(r'optical|light|wavelength|absorbance|fluorescence|color', re.I),
        'chemical': re.compile(r'chemical|reagent|solution|buffer|acid|base|ph|concentration', re.I),
        'biological': re.compile(r'biological|cell|tissue|organism|protein|dna|rna|gene', re.I),
        'instrument': re.compile(r'instrument|device|equipment|machine|analyzer|detector', re.I),
        'compatibility': re.compile(r'compatible|compatibility|work with|fit', re.I),
        'safety': re.compile(r'safety|hazard|danger|risk|protection', re.I),
        'storage': re.compile(r'storage|store|shelf|cabinet', re.I),
        'operation': re.compile(r'operation|operate|function|mode|setting', re.I),
        'identification': re.compile(r'id|name|label|tag|identifier', re.I),
        'position': re.compile(r'position|location|coordinate|placement', re.I),
        'connection': re.compile(r'connection|connector|port|interface|plug|socket', re.I),
        'property': re.compile(r'property|characteristic|attribute|feature', re.I),
    }
    
    # Categorize each field
    for name, description in fields:
        categorized = False
        
        # Check name and description against patterns
        for category, pattern in patterns.items():
            if pattern.search(name) or pattern.search(description):
                categories[category].append((name, description))
                categorized = True
                break
        
        # If not categorized, put in 'other'
        if not categorized:
            categories['other'].append((name, description))
    
    return categories

def suggest_schema_improvements(categories):
    """Suggest improvements to the database schema based on field categories"""
    suggestions = []
    
    # Container-related tables
    if 'container' in categories:
        suggestions.append("-- Container-related tables")
        container_fields = [name for name, _ in categories['container']]
        suggestions.append(f"-- Consider adding these fields to container tables: {', '.join(container_fields[:10])}...")
    
    # Dimension-related tables
    if 'dimension' in categories:
        suggestions.append("\n-- Dimension-related tables")
        dimension_fields = [name for name, _ in categories['dimension']]
        suggestions.append(f"-- Consider adding these fields to dimension tables: {', '.join(dimension_fields[:10])}...")
    
    # Material-related tables
    if 'material' in categories:
        suggestions.append("\n-- Material-related tables")
        material_fields = [name for name, _ in categories['material']]
        suggestions.append(f"-- Consider adding these fields to material tables: {', '.join(material_fields[:10])}...")
    
    # Temperature-related tables
    if 'temperature' in categories:
        suggestions.append("\n-- Temperature-related tables")
        temperature_fields = [name for name, _ in categories['temperature']]
        suggestions.append(f"-- Consider adding these fields to temperature tables: {', '.join(temperature_fields[:10])}...")
    
    # Compatibility-related tables
    if 'compatibility' in categories:
        suggestions.append("\n-- Compatibility-related tables")
        compatibility_fields = [name for name, _ in categories['compatibility']]
        suggestions.append(f"-- Consider adding these fields to compatibility tables: {', '.join(compatibility_fields[:10])}...")
    
    # Connection-related tables
    if 'connection' in categories:
        suggestions.append("\n-- Connection-related tables")
        connection_fields = [name for name, _ in categories['connection']]
        suggestions.append(f"-- Consider adding these fields to connection tables: {', '.join(connection_fields[:10])}...")
    
    # Position-related tables
    if 'position' in categories:
        suggestions.append("\n-- Position-related tables")
        position_fields = [name for name, _ in categories['position']]
        suggestions.append(f"-- Consider adding these fields to position tables: {', '.join(position_fields[:10])}...")
    
    # Instrument-related tables
    if 'instrument' in categories:
        suggestions.append("\n-- Instrument-related tables")
        instrument_fields = [name for name, _ in categories['instrument']]
        suggestions.append(f"-- Consider adding these fields to instrument tables: {', '.join(instrument_fields[:10])}...")
    
    # Safety-related tables
    if 'safety' in categories:
        suggestions.append("\n-- Safety-related tables")
        safety_fields = [name for name, _ in categories['safety']]
        suggestions.append(f"-- Consider adding these fields to safety tables: {', '.join(safety_fields[:10])}...")
    
    # Storage-related tables
    if 'storage' in categories:
        suggestions.append("\n-- Storage-related tables")
        storage_fields = [name for name, _ in categories['storage']]
        suggestions.append(f"-- Consider adding these fields to storage tables: {', '.join(storage_fields[:10])}...")
    
    # Operation-related tables
    if 'operation' in categories:
        suggestions.append("\n-- Operation-related tables")
        operation_fields = [name for name, _ in categories['operation']]
        suggestions.append(f"-- Consider adding these fields to operation tables: {', '.join(operation_fields[:10])}...")
    
    # Identification-related tables
    if 'identification' in categories:
        suggestions.append("\n-- Identification-related tables")
        identification_fields = [name for name, _ in categories['identification']]
        suggestions.append(f"-- Consider adding these fields to identification tables: {', '.join(identification_fields[:10])}...")
    
    return "\n".join(suggestions)

def main():
    # Read field definitions
    fields = read_field_definitions('field_definitions.csv')
    print(f"Read {len(fields)} field definitions")
    
    # Categorize fields
    categories = categorize_fields(fields)
    print("\nField categories:")
    for category, category_fields in categories.items():
        print(f"  {category}: {len(category_fields)} fields")
    
    # Suggest schema improvements
    suggestions = suggest_schema_improvements(categories)
    
    # Write suggestions to file
    with open('schema_suggestions.txt', 'w') as f:
        f.write(suggestions)
    
    print("\nSchema improvement suggestions written to schema_suggestions.txt")

if __name__ == "__main__":
    main() 