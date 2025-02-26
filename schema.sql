-- SQLite schema for Emerald Cloud Lab objects data

-- Main table for objects
CREATE TABLE objects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT,
    status TEXT
);

-- Table for object images
CREATE TABLE object_images (
    object_id TEXT,
    image_src TEXT,
    FOREIGN KEY (object_id) REFERENCES objects(id)
);

-- Table for sections
CREATE TABLE sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    object_id TEXT,
    name TEXT NOT NULL,
    FOREIGN KEY (object_id) REFERENCES objects(id)
);

-- Table for fields
CREATE TABLE fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT
);

-- Table for records (connecting sections and fields with their values)
CREATE TABLE records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER,
    field_id INTEGER,
    FOREIGN KEY (section_id) REFERENCES sections(id),
    FOREIGN KEY (field_id) REFERENCES fields(id)
);

-- Table for scalar values
CREATE TABLE scalar_values (
    record_id INTEGER,
    value TEXT,
    FOREIGN KEY (record_id) REFERENCES records(id)
);

-- Table for link values
CREATE TABLE link_values (
    record_id INTEGER,
    link TEXT,
    FOREIGN KEY (record_id) REFERENCES records(id)
);

-- Table for list values
CREATE TABLE list_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER,
    value TEXT,
    FOREIGN KEY (record_id) REFERENCES records(id)
);

-- Table for subtable values
CREATE TABLE subtables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER,
    FOREIGN KEY (record_id) REFERENCES records(id)
);

-- Table for subtable headers
CREATE TABLE subtable_headers (
    subtable_id INTEGER,
    position INTEGER,
    header_text TEXT,
    FOREIGN KEY (subtable_id) REFERENCES subtables(id)
);

-- Table for subtable rows
CREATE TABLE subtable_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subtable_id INTEGER,
    row_position INTEGER,
    FOREIGN KEY (subtable_id) REFERENCES subtables(id)
);

-- Table for subtable cell values
CREATE TABLE subtable_cells (
    row_id INTEGER,
    column_position INTEGER,
    value_type TEXT, -- 'scalar', 'link', etc.
    value TEXT,
    FOREIGN KEY (row_id) REFERENCES subtable_rows(id)
);

-- Table for object synonyms
CREATE TABLE object_synonyms (
    object_id TEXT,
    synonym TEXT,
    FOREIGN KEY (object_id) REFERENCES objects(id)
);

-- Table for object authors
CREATE TABLE object_authors (
    object_id TEXT,
    author_id TEXT,
    FOREIGN KEY (object_id) REFERENCES objects(id)
);

-- Table for container specifications
CREATE TABLE container_specifications (
    object_id TEXT,
    material TEXT,
    opaque TEXT,
    self_standing TEXT,
    transport_stable TEXT,
    tare_weight TEXT,
    tare_weight_distribution TEXT,
    resolution TEXT,
    min_temperature TEXT,
    max_temperature TEXT,
    min_volume TEXT,
    max_volume TEXT,
    FOREIGN KEY (object_id) REFERENCES objects(id)
);

-- Table for container dimensions
CREATE TABLE container_dimensions (
    object_id TEXT,
    width TEXT,
    depth TEXT,
    height TEXT,
    cross_sectional_shape TEXT,
    internal_diameter TEXT,
    aperture TEXT,
    internal_depth TEXT,
    internal_bottom_shape TEXT,
    FOREIGN KEY (object_id) REFERENCES objects(id)
);

-- Table for container graduations
CREATE TABLE container_graduations (
    object_id TEXT,
    graduation TEXT,
    FOREIGN KEY (object_id) REFERENCES objects(id)
);

-- Table for container positions
CREATE TABLE container_positions (
    object_id TEXT,
    position_name TEXT,
    footprint TEXT,
    max_width TEXT,
    max_depth TEXT,
    max_height TEXT,
    FOREIGN KEY (object_id) REFERENCES objects(id)
);

-- Table for container compatibility
CREATE TABLE container_compatibility (
    object_id TEXT,
    compatible_cover_type TEXT,
    compatible_cover_footprint TEXT,
    preferred_balance TEXT,
    preferred_camera TEXT,
    preferred_mixer TEXT,
    preferred_wash_bin TEXT,
    FOREIGN KEY (object_id) REFERENCES objects(id)
);

-- Table for container connectors
CREATE TABLE container_connectors (
    object_id TEXT,
    connector_name TEXT,
    connector_type TEXT,
    thread_type TEXT,
    inner_diameter TEXT,
    outer_diameter TEXT,
    gender TEXT,
    FOREIGN KEY (object_id) REFERENCES objects(id)
);

-- Table for container products
CREATE TABLE container_products (
    object_id TEXT,
    product_id TEXT,
    FOREIGN KEY (object_id) REFERENCES objects(id)
);

-- Table for container properties
CREATE TABLE container_properties (
    object_id TEXT,
    reusability TEXT,
    sterile TEXT,
    disposable_caps TEXT,
    stocked TEXT,
    cleaning_method TEXT,
    default_storage_condition TEXT,
    FOREIGN KEY (object_id) REFERENCES objects(id)
); 