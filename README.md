# Emerald Cloud Lab Objects Database

This project creates a SQLite database from JSON data containing information about laboratory equipment models from Emerald Cloud Lab.

## Overview

The database schema is designed to store detailed information about laboratory containers and vessels, including their specifications, dimensions, compatibility, and other properties.

## Files

- `schema.sql`: Contains the SQLite database schema
- `create_database.py`: Python script to parse JSON data and create the SQLite database
- `emerald_objects.db`: The resulting SQLite database (created when running the script)

## Requirements

- Python 3.6+
- SQLite3

## Usage

1. Ensure the JSON data files are located in the `emerald-scraper/objects/` directory
2. Run the database creation script:

```bash
python create_database.py
```

3. The script will create a SQLite database named `emerald_objects.db`

## Database Schema

The database consists of the following main tables:

### Core Tables

- `objects`: Main table containing basic object information
- `object_images`: Stores image URLs for objects
- `sections`: Sections within each object's documentation
- `fields`: Field definitions that can appear in sections
- `records`: Connects sections and fields with their values
- `scalar_values`, `link_values`, `list_values`: Different types of values for records
- `subtables`, `subtable_headers`, `subtable_rows`, `subtable_cells`: For complex tabular data

### Specialized Tables

- `object_synonyms`: Alternative names for objects
- `object_authors`: Authors of object definitions
- `container_specifications`: Technical specifications of containers
- `container_dimensions`: Physical dimensions of containers
- `container_graduations`: Volume markings on containers
- `container_positions`: Position information for containers
- `container_compatibility`: Compatibility information with other equipment
- `container_connectors`: Connector specifications for containers
- `container_products`: Product information for containers
- `container_properties`: Various properties of containers

## Example Queries

### Get basic information about all objects

```sql
SELECT id, name, url, status FROM objects;
```

### Get container specifications

```sql
SELECT o.name, cs.* 
FROM objects o
JOIN container_specifications cs ON o.id = cs.object_id;
```

### Get container dimensions

```sql
SELECT o.name, cd.* 
FROM objects o
JOIN container_dimensions cd ON o.id = cd.object_id;
```

### Get container compatibility information

```sql
SELECT o.name, cc.* 
FROM objects o
JOIN container_compatibility cc ON o.id = cc.object_id;
```

### Get all synonyms for an object

```sql
SELECT o.name, os.synonym 
FROM objects o
JOIN object_synonyms os ON o.id = os.object_id
WHERE o.id = 'jLq9jXvA8ewR';
```

## License

This project is for educational purposes only. 