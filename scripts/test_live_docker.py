import urllib.request
import json

BASE_URL = 'http://localhost:8000/api'

def post_json(endpoint, data):
    req = urllib.request.Request(
        f"{BASE_URL}/{endpoint}",
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def get_json(endpoint):
    req = urllib.request.Request(f"{BASE_URL}/{endpoint}")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

print("[1] Recording user interaction (LIKE)...")
inter = post_json('interactions', {
    'user_id': 'user_docker_demo',
    'article_id': '0559129003',
    'interaction_type': 'like'
})
print(f"    Recorded interaction ID: {inter['id']} for user: {inter['user_id']}")

print("[2] Saving complete outfit ensemble...")
outfit = post_json('outfits/save', {
    'user_id': 'user_docker_demo',
    'outfit_name': 'Docker Chic Ensemble',
    'anchor_article_id': '0559129003',
    'item_article_ids': ['0108775015', '0212042070', '0126589006']
})
print(f"    Saved outfit: {outfit['outfit_id']} - {outfit['message']}")

print("[3] Retrieving saved outfits for user...")
user_outfits = get_json('users/user_docker_demo/outfits')
print(f"    User has {len(user_outfits)} saved outfit(s).")
for o in user_outfits:
    print(f"    - Look: '{o['outfit_name']}' with {len(o['items'])} items.")

print("[4] Fetching dynamic personalized recommendations...")
recs = get_json('recommendations/personalized/user_docker_demo?top_k=6')
print(f"    Received {len(recs)} personalized recommendations:")
for r in recs[:3]:
    print(f"    - [{r['article_id']}] {r['prod_name']} ({r['standard_category']})")

print("\nALL LIVE DOCKER SERVICES VERIFIED AND OPERATIONAL!")
