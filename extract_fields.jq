# This jq script extracts all unique field names and descriptions from the JSON data
# Output format: "field_name","field_description"

# Flatten all records from all objects and sections
[
  .[] | 
  .result.sections[] | 
  .records[] | 
  .field | 
  {name, description}
] | 
# Convert to CSV format with proper escaping
map("\"\(.name)\",\"\(.description | gsub("\"";"\"\""))\"") | 
unique | 
.[] 