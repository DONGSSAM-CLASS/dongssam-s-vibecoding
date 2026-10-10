"""웹용 GLB 텍스처를 최대 2K로 줄임. 뼈대·정점·애니메이션 데이터는 유지.

사용: python -m pip install Pillow
      python tools/optimize-glb.py assets/relics/*.glb assets/players/*.glb
원본은 별도 폴더에 보관한 뒤 실행하세요. Meshy API를 호출하지 않습니다.
"""
import io
import json
import pathlib
import struct
import sys
from PIL import Image


def optimize(file):
    p = pathlib.Path(file)
    data = p.read_bytes()
    magic, version, length = struct.unpack_from('<4sII', data)
    if magic != b'glTF' or version != 2 or length != len(data):
        raise ValueError(f'올바른 GLB가 아닙니다: {p}')
    size, kind = struct.unpack_from('<II', data, 12)
    if kind != 0x4E4F534A:
        raise ValueError('JSON 청크 없음')
    doc = json.loads(data[20:20 + size])
    start = 20 + size
    binary_size, binary_kind = struct.unpack_from('<II', data, start)
    if binary_kind != 0x004E4942 or len(doc['buffers']) != 1:
        raise ValueError('단일 내부 버퍼 GLB만 지원합니다')
    binary = data[start + 8:start + 8 + binary_size]
    replacements = {}
    for img in doc.get('images', []):
        if 'bufferView' not in img:
            raise ValueError('외부 이미지가 있는 GLB는 지원하지 않습니다')
        index = img['bufferView']
        view = doc['bufferViews'][index]
        offset = view.get('byteOffset', 0)
        raw = binary[offset:offset + view['byteLength']]
        with Image.open(io.BytesIO(raw)) as im:
            im.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
            out = io.BytesIO()
            if img['mimeType'] == 'image/jpeg':
                im.convert('RGB').save(out, 'JPEG', quality=90, subsampling=0, optimize=True)
            else:
                im.save(out, 'PNG', optimize=True)
            if len(out.getvalue()) < len(raw):
                replacements[index] = out.getvalue()
    # 버퍼 뷰별로 다시 정렬. 접근자의 상대 오프셋과 데이터는 그대로 유지
    packed = bytearray()
    for index, view in enumerate(doc['bufferViews']):
        if view.get('buffer', 0) != 0:
            raise ValueError('외부 버퍼 뷰 없음만 지원합니다')
        offset = view.get('byteOffset', 0)
        raw = replacements.get(index, binary[offset:offset + view['byteLength']])
        packed.extend(b'\0' * (-len(packed) % 4))
        view['byteOffset'], view['byteLength'] = len(packed), len(raw)
        packed.extend(raw)
    doc['buffers'][0]['byteLength'] = len(packed)
    packed.extend(b'\0' * (-len(packed) % 4))
    meta = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode('utf8')
    meta += b' ' * (-len(meta) % 4)
    result = struct.pack('<4sII', b'glTF', 2, 28 + len(meta) + len(packed))
    result += struct.pack('<II', len(meta), 0x4E4F534A) + meta
    result += struct.pack('<II', len(packed), 0x004E4942) + packed
    if len(result) > 10_000_000:
        raise ValueError(f'10MB 초과: {p} ({len(result)} 바이트)')
    p.write_bytes(result)
    triangles = sum(doc['accessors'][q['indices']]['count'] // 3
                    if 'indices' in q else doc['accessors'][q['attributes']['POSITION']]['count'] // 3
                    for m in doc.get('meshes', []) for q in m['primitives'])
    return {'file': p.as_posix(), 'beforeBytes': len(data), 'bytes': len(result), 'triangles': triangles}


if __name__ == '__main__':
    files = []
    for pattern in sys.argv[1:]:
        # PowerShell에서도 와일드카드 확장이 일관되게 작동
        import glob
        files.extend(glob.glob(pattern))
    if not files:
        raise SystemExit('사용법: python tools/optimize-glb.py assets/relics/*.glb assets/players/*.glb')
    print(json.dumps([optimize(p) for p in sorted(set(files))], ensure_ascii=False, indent=2))
