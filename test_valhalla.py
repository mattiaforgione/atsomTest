import urllib.request
import json
import traceback

points = [[45.400911, 8.913239]] * 20

# Valhalla uses a JSON payload in the request via a GET parameter 'json={...}'
req_data = {
    "locations": [{"lat": p[0], "lon": p[1]} for p in points],
    "costing": "auto"
}

encoded_json = urllib.parse.quote(json.dumps(req_data))
url = "https://valhalla1.openstreetmap.de/route?json=" + encoded_json

try:
    print("Calling: " + url)
    # Adding User-Agent as some public APIs require it
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 MyATSOM/1.0'})
    with urllib.request.urlopen(req) as response:
        body = response.read()
        data = json.loads(body)
        print("SUCCESS")
        if 'trip' in data and 'legs' in data['trip']:
             print("Number of legs:", len(data['trip']['legs']))
        else:
             print("Unexpected response structure")
except urllib.error.HTTPError as e:
    print(f"HTTPError: {e.code}")
    print(e.read().decode())
except Exception as e:
    traceback.print_exc()
