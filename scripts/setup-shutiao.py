#!/usr/bin/env python3
"""Re-create Shutiao Chen using the app's local MCP server; no API key needed."""
import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:27430/mcp')
args = parser.parse_args()
profile = json.loads((Path(__file__).resolve().parents[1] / 'src/assets/shutiao.json').read_text())
profile.pop('builtin', None)
body = {'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call', 'params': {
    'name': 'upsert_cat', 'arguments': {'cat': profile, 'activate': True},
}}
request = Request(args.url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
with urlopen(request, timeout=10) as response:
    result = json.load(response)
if result.get('error') or result.get('result', {}).get('isError'):
    raise SystemExit(json.dumps(result, ensure_ascii=False))
print('陈薯条 / Shutiao Chen 已通过 MCP 导入并激活。')
