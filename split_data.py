import json
import re
import codecs

with codecs.open('data.js', 'r', 'utf-8') as f:
    text = f.read()

# Extract the JSON body of stavData
start = text.find('{')
end_marker = text.find('if (typeof window')
if end_marker != -1:
    end = text.rfind('}', 0, end_marker) + 1
else:
    end = text.rfind('};') + 1

js_obj = text[start:end]

# Clean up JS-specific syntax to make it valid JSON
# 1. Remove comments
js_obj = re.sub(r'//.*', '', js_obj)
# 2. Quote unquoted keys (like 'stops:', 'lines:')
js_obj = re.sub(r'([{,]\s*)([a-zA-Z0-9_]+)\s*:', r'\1"\2":', js_obj)
# 3. Remove trailing commas (like before ']' or '}')
js_obj = re.sub(r',\s*([\]}])', r'\1', js_obj)

try:
    data = json.loads(js_obj)
    
    # Write fermate.js
    with codecs.open('fermate.js', 'w', 'utf-8') as f:
        f.write('const stavStops = ' + json.dumps(data["stops"], indent=4, ensure_ascii=False) + ';\n')
        
    line_names = []
    # Write each line
    for line in data["lines"]:
        var_name = f"linea_{line['id']}"
        line_names.append(var_name)
        with codecs.open(f'{var_name}.js', 'w', 'utf-8') as f:
            f.write(f'const {var_name} = ' + json.dumps(line, indent=4, ensure_ascii=False) + ';\n')
            
    # Write updated data.js
    with codecs.open('data.js', 'w', 'utf-8') as f:
        f.write('const stavData = {\n')
        f.write('    stops: stavStops,\n')
        f.write('    lines: [\n        ' + ',\n        '.join(line_names) + '\n    ]\n')
        f.write('};\n')
        
    print("Successfully split lines:", line_names)
except Exception as e:
    import traceback
    traceback.print_exc()
    with codecs.open('debug_json.txt', 'w', 'utf-8') as f:
        f.write(js_obj)
