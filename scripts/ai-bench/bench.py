"""OpenRouter 모델 비교 — 사용법은 같은 폴더 README.md. 키는 환경 변수로만 받고 출력하지 않는다."""
import concurrent.futures as cf, json, os, re, sys, time, urllib.parse, urllib.request

KEY = os.environ['KEY']; KAKAO = os.environ.get('KAKAO', ''); P = json.load(open(os.environ['PROMPTS']))
TASKS = [('summary', 600, False, 0.3), ('quote', 700, True, 0.3), ('genre', 800, True, 0.2)]
READ = {'데미안', '채식주의자', '어린왕자', '사피엔스', '코스모스', '아몬드', '미움받을용기', '총균쇠', '82년생김지영', '이기적유전자', '나미야잡화점의기적', '클린코드'}
norm = lambda s: re.sub(r'[\s()\[\]:·,.\-]', '', s or '').lower()

def call(model, effort, task, max_tokens, json_mode, temperature):
    body = dict(model=model, messages=P[task], max_tokens=max_tokens, temperature=temperature,
                provider={'sort': 'throughput', **({'require_parameters': True} if json_mode else {})})
    if json_mode: body['response_format'] = {'type': 'json_object'}
    if effort: body['reasoning'] = {'effort': effort}
    req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=json.dumps(body).encode(),
                                 headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'})
    t = time.time()
    try: d = json.load(urllib.request.urlopen(req, timeout=60))
    except Exception as e: return {'err': str(e)[:80], 'dt': round(time.time() - t, 1)}
    c = d['choices'][0]['message'].get('content') or ''
    return {'dt': round(time.time() - t, 1), 'provider': d.get('provider'), 'cost': (d.get('usage') or {}).get('cost'), 'content': c}

def kakao_ok(title, author):
    if not KAKAO: return False
    u = 'https://dapi.kakao.com/v3/search/book?' + urllib.parse.urlencode({'query': title, 'size': 5, 'target': 'title'})
    try: docs = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={'Authorization': 'KakaoAK ' + KAKAO}), timeout=8))['documents']
    except Exception: return False
    a = norm(author)[:3]
    return any(norm(title)[:6] in norm(x['title']) and (not a or any(a in norm(y) for y in x.get('authors', []))) for x in docs)

def lifebooks(model, effort):
    r = call(model, effort, 'lifebooks', 800, True, 0.6)
    if 'err' in r: return r['dt'], 'ERR', 0, 0, r.get('cost')
    c = r['content']
    try: books = json.loads(c[c.find('{'):c.rfind('}') + 1]).get('books', [])
    except Exception: return r['dt'], 'BADJSON', 0, 0, r.get('cost')
    owned = sum(norm(b.get('title')) in READ for b in books)
    usable = sum(norm(b.get('title')) not in READ and kakao_ok(b.get('title', ''), b.get('author', '')) for b in books)
    return r['dt'], r['provider'], owned, usable, r.get('cost')

def run(spec):
    model, _, effort = spec.partition('@')
    lb = [lifebooks(model, effort or None) for _ in range(3)]
    other = {t: call(model, effort or None, t, mt, js, tp) for t, mt, js, tp in TASKS}
    return model, lb, other

out = {}
with cf.ThreadPoolExecutor(5) as ex:
    for model, lb, other in ex.map(run, sys.argv[1].split(',')):
        out[model] = {'lifebooks': lb, **other}
        print(f'{model:40s} 인생책', ' | '.join(f'{dt}s {p} 읽은책{o} 사용가능{u}' for dt, p, o, u, _ in lb),
              '| 기타', ' '.join(f"{t}:{r.get('dt')}s" for t, r in other.items()), flush=True)
json.dump(out, open('/tmp/ai-bench-out.json', 'w'), ensure_ascii=False, indent=1)
