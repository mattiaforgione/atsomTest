import urllib.request
import json
import traceback

key = '26644bf0-a16b-489d-891a-b092549ab59e'

points = [[45.400911, 8.913239]] * 20

url = "https://graphhopper.com/api/1/route?vehicle=car&locale=it&points_encoded=false&key=" + key
for p in points:
    url += f"&point={p[0]},{p[1]}"

try:
    print("Calling: " + url)
    with urllib.request.urlopen(url) as response:
        body = response.read()
        data = json.loads(body)
        print("SUCCESS")
        print("Length paths:", len(data['paths']))
except urllib.error.HTTPError as e:
    print(f"HTTPError: {e.code}")
    print(e.read().decode())
except Exception as e:
    traceback.print_exc()
