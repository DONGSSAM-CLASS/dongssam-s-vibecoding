# -*- coding: utf-8 -*-
"""변환된 공모서식(form.hwpx)의 XML을 채워 새 HWPX를 만든다.
usage: python3 fill.py <unzipped form dir> <out.hwpx>"""
import sys, os, re, copy, math, zipfile, shutil
from lxml import etree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib
C = importlib.import_module(os.environ.get('CONTENT', 'content'))

SRC, OUT = sys.argv[1], sys.argv[2]
HP = 'http://www.hancom.co.kr/hwpml/2011/paragraph'
NS = {'hp': HP}
q = lambda t: '{%s}%s' % (HP, t)

GRAY2BLACK = {'83': '81', '84': '81', '85': '81', '86': '81', '88': '81', '92': '81',
              '44': '20', '72': '37', '30': '37', '31': '37', '62': '20', '63': '20', '73': '37'}
RED = {'57', '60', '62', '63', '69', '73', '30', '31'}  # 지시문(빨강·파랑·회색 안내) 글자모양

_id = [1700000000]
def new_id():
    _id[0] += 7
    return str(_id[0])

def reid(el):
    for e in el.iter():
        ln = etree.QName(e).localname if isinstance(e.tag, str) else ''
        if ln in ('tbl', 'pic', 'rect', 'container', 'line', 'ellipse') and e.get('id'):
            e.set('id', new_id())
            if e.get('instid'):
                e.set('instid', str(int(new_id()) - 1000000000))

def strip_lineseg(root):
    for ls in list(root.iter(q('linesegarray'))):
        ls.getparent().remove(ls)

def tbl_of(p):
    return p.find('hp:run/hp:tbl', NS)

def para(tpl, runs, ppr=None, page_break=None):
    """tpl 문단의 속성만 빌려 새 문단 생성. runs=[(text, charPr)]"""
    p = etree.Element(q('p'), nsmap=tpl.nsmap)
    for k, v in tpl.attrib.items():
        p.set(k, v)
    if ppr: p.set('paraPrIDRef', ppr)
    if page_break is not None: p.set('pageBreak', page_break)
    for text, cpr in runs:
        r = etree.SubElement(p, q('run')); r.set('charPrIDRef', cpr)
        t = etree.SubElement(r, q('t')); t.text = text
    return p

# ---------- cell helpers ----------
def cell_style(tc):
    """셀 첫 문단의 paraPr, 첫 글자모양(회색→검정)"""
    p = tc.find('hp:subList/hp:p', NS)
    r = p.find('hp:run', NS) if p is not None else None
    ppr = p.get('paraPrIDRef') if p is not None else '0'
    cpr = r.get('charPrIDRef') if r is not None else '20'
    return p, ppr, GRAY2BLACK.get(cpr, cpr)

def set_cell(tc, lines, ppr=None, cpr=None, bold=None):
    """lines: list[str]; '**'로 시작하는 줄은 bold 글자모양"""
    tplp, ppr0, cpr0 = cell_style(tc)
    ppr = ppr or ppr0; cpr = cpr or cpr0
    sub = tc.find('hp:subList', NS)
    for p in sub.findall('hp:p', NS): sub.remove(p)
    for ln in lines:
        if ln.startswith('**'):
            sub.append(para(tplp, [(ln[2:], bold or cpr)], ppr))
        else:
            sub.append(para(tplp, [(ln, cpr)], ppr))

def set_addr(tc, row, col, rs=1, cs=1):
    a = tc.find('hp:cellAddr', NS); a.set('rowAddr', str(row)); a.set('colAddr', str(col))
    s = tc.find('hp:cellSpan', NS); s.set('rowSpan', str(rs)); s.set('colSpan', str(cs))

def cell_w(tc): return int(tc.find('hp:cellSz', NS).get('width'))
def set_h(tc, h): tc.find('hp:cellSz', NS).set('height', str(int(h)))

def est_h(lines, width, pt=10, ls=1.5):
    cpl = max(4, int((width - 400) / (pt * 100 * 0.92)))
    n = sum(max(1, math.ceil(len(l.lstrip('*')) / cpl)) for l in lines) if lines else 1
    return n * pt * 100 * ls + 700

def cells(tbl):
    out = {}
    for tr in tbl.findall('hp:tr', NS):
        for tc in tr.findall('hp:tc', NS):
            a = tc.find('hp:cellAddr', NS)
            out[(int(a.get('rowAddr')), int(a.get('colAddr')))] = tc
    return out

def rebuild(tbl, header_rows, spec, pt=10):
    """header_rows: 유지할 원본 행 수.
    spec: list of rows; 각 row = list of dict(col, rs, cs, lines, tpl(원본 tc), ppr, cpr, bold)"""
    trs = tbl.findall('hp:tr', NS)
    for tr in trs[header_rows:]: tbl.remove(tr)
    tr_tpl = trs[0]
    # 행 높이 추정 (rowspan 1인 셀 기준)
    heights = []
    for row in spec:
        h = 1600
        for c in row:
            if c.get('rs', 1) == 1:
                h = max(h, est_h(c['lines'], cell_w(c['tpl']), pt))
        heights.append(h)
    for ri, row in enumerate(spec):
        tr = etree.SubElement(tbl, q('tr'))
        for k, v in tr_tpl.attrib.items(): tr.set(k, v)
        for c in row:
            tc = copy.deepcopy(c['tpl']); reid(tc)
            set_addr(tc, header_rows + ri, c['col'], c.get('rs', 1), c.get('cs', 1))
            set_cell(tc, c['lines'], c.get('ppr'), c.get('cpr'), c.get('bold'))
            set_h(tc, sum(heights[ri:ri + c.get('rs', 1)]))
            tr.append(tc)
    tbl.set('rowCnt', str(header_rows + len(spec)))
    hdr_h = sum(max(int(tc.find('hp:cellSz', NS).get('height')) for tc in tr.findall('hp:tc', NS)) for tr in tbl.findall('hp:tr', NS)[:header_rows])
    tbl.find('hp:sz', NS).set('height', str(int(hdr_h + sum(heights))))

def drop_runs(p, cprs):
    for r in p.findall('hp:run', NS):
        if r.get('charPrIDRef') in cprs and r.find('hp:t', NS) is not None and len(r) == 1:
            p.remove(r)

def replace_text(root, old, new):
    for t in root.iter(q('t')):
        if t.text and old in t.text: t.text = t.text.replace(old, new)

# =====================================================================
s0_path = os.path.join(SRC, 'Contents', 'section0.xml')
s1_path = os.path.join(SRC, 'Contents', 'section1.xml')
s0 = etree.parse(s0_path); s1 = etree.parse(s1_path)
r0 = s0.getroot(); r1 = s1.getroot()
P0 = r0.findall('hp:p', NS); P1 = r1.findall('hp:p', NS)

# ---------------- 표지 (section0) ----------------
for t in P0[0].iter(q('t')):
    if t.text and 'OOOOO' in t.text: t.text = C.CONTEST
tb = tbl_of(P0[8]); tc = cells(tb)[(0, 0)]
tplp, _, _ = cell_style(tc)
sub = tc.find('hp:subList', NS)
for p in sub.findall('hp:p', NS): sub.remove(p)
for _txt, _cpr, _ppr in C.TITLE:
    sub.append(para(tplp, [(_txt, _cpr)], _ppr))
tb = tbl_of(P0[15]); cc = cells(tb)
set_cell(cc[(0, 1)], C.KEYWORD, '27', '37')
set_cell(cc[(1, 1)], C.DESC, '27', '37')
set_cell(cc[(2, 1)], C.TARGET, '27', '37')
for p in P0[17:23]: r0.remove(p)   # 목차 구성·작성형식 안내 상자 삭제

# ---------------- 본문 (section1) ----------------
keep = {}
heading = {i: P1[i] for i in (3, 6, 11, 14, 17, 20)}
body_tpl = P1[4]
lesson_head, lesson_info, lesson_proc = P1[29], P1[31], P1[32]
mat_head, mat_sub_t, mat_item, mat_sub_s = P1[35], P1[40], P1[41], P1[47]

def set_heading(p, num, title):
    t = tbl_of(p); c = cells(t)
    set_cell(c[(0, 0)], [str(num)])
    tc = c[(0, 2)]; tplp, ppr, _ = cell_style(tc)
    sub = tc.find('hp:subList', NS)
    for x in sub.findall('hp:p', NS): sub.remove(x)
    sub.append(para(tplp, [(title, '40')], ppr))

def body_paras(lines, ppr='19', indent_ppr='69'):
    out = []
    for ln in lines:
        if re.match(r'^[가-하]\. ', ln) or ln.startswith('※'):
            out.append(para(body_tpl, [('  ' + ln, '81')], indent_ppr))
        else:
            out.append(para(body_tpl, [('  ' + ln, '81')], ppr))
    return out

# Ⅰ 제목 문단: 빨간 안내 run 제거
drop_runs(P1[0], RED)
for t in P1[0].iter(q('t')):
    if t.text and '[대제목' in t.text: t.text = ''

new_body = []
new_body += [P1[0], P1[1]]
# 1 주제 및 개관
set_heading(heading[3], 1, '주제 및 개관'); new_body.append(heading[3])
new_body += body_paras(C.OVERVIEW); new_body.append(P1[5])
# 2 기대효과
set_heading(heading[6], 2, '기대효과'); new_body.append(heading[6])
new_body += body_paras(C.EFFECTS); new_body.append(P1[10])
# 3 교육과정 재구성 계획
set_heading(heading[11], 3, '교육과정 재구성 계획'); new_body.append(heading[11])
tb = tbl_of(P1[12]); cc = cells(tb)
spec = []
for i, (topic, main, no, act) in enumerate(C.CURRICULUM):
    last = i == len(C.CURRICULUM) - 1
    src = 13 if last else 2
    row = []
    if i == 0:
        row.append(dict(col=0, rs=len(C.CURRICULUM), lines=C.UNIT.split('\n'), tpl=cc[(1, 0)]))
    row += [dict(col=1, lines=[topic], tpl=cc[(src if last else 1, 1)]),
            dict(col=2, lines=[main], tpl=cc[(src if last else 2, 2)]),
            dict(col=3, lines=no.split('\n'), tpl=cc[(src if last else 2, 3)]),
            dict(col=4, lines=[act], tpl=cc[(src if last else 2, 4)])]
    spec.append(row)
rebuild(tb, 1, spec); new_body += [P1[12], P1[13]]
# 4 목표 및 성취기준
set_heading(heading[14], 4, '수업의 목표 및 성취기준'); new_body.append(heading[14])
tb = tbl_of(P1[15]); cc = cells(tb)
spec = []
for gi, (goal, stds) in enumerate(C.GOALS):
    for si, (subj, std) in enumerate(stds):
        last = gi == len(C.GOALS) - 1 and si == len(stds) - 1
        row = []
        if si == 0:
            row.append(dict(col=0, rs=len(stds), lines=[goal], tpl=cc[(3, 0)] if gi == len(C.GOALS) - 1 else cc[(1, 0)]))
        row += [dict(col=1, lines=[subj], tpl=cc[(4 if last else 1, 1)]),
                dict(col=2, lines=[std], tpl=cc[(4 if last else 1, 2)])]
        spec.append(row)
rebuild(tb, 1, spec); new_body += [P1[15], P1[16]]
# 5 평가계획
set_heading(heading[17], 5, '평가계획'); new_body.append(heading[17])
tb = tbl_of(P1[18]); cc = cells(tb)
spec = []
for content_, crit, method in C.EVAL:
    for k, lv in enumerate(['상', '중', '하']):
        row = []
        if k == 0: row.append(dict(col=0, rs=3, lines=[content_], tpl=cc[(1, 0)]))
        row += [dict(col=1, lines=[crit[k]], tpl=cc[(k + 1, 1)]), dict(col=2, lines=[lv], tpl=cc[(k + 1, 2)])]
        if k == 0: row.append(dict(col=3, rs=3, lines=[method], tpl=cc[(1, 3)]))
        spec.append(row)
rebuild(tb, 1, spec); new_body.append(P1[18])
new_body += body_paras([C.EVAL_NOTE]); new_body.append(P1[19])
# 6 지도상의 유의점
set_heading(heading[20], 6, '지도상의 유의점'); new_body.append(heading[20])
new_body += body_paras(C.CAUTIONS)

# Ⅱ 수업안
new_body += [P1[27], P1[28]]
for li, L in enumerate(C.LESSONS, 1):
    h = copy.deepcopy(lesson_head); reid(h)
    if li > 1: h.set('pageBreak', '1')
    t = tbl_of(h); c = cells(t)
    set_cell(c[(0, 0)], [str(li)])
    tc = c[(0, 2)]; tplp, ppr, cpr = cell_style(tc)
    sub = tc.find('hp:subList', NS)
    for x in sub.findall('hp:p', NS): sub.remove(x)
    sub.append(para(tplp, [(' ' + L['title'], cpr)], ppr))
    new_body.append(h)
    # 정보 표
    info = copy.deepcopy(lesson_info); reid(info)
    t = tbl_of(info); c = cells(t)
    set_cell(c[(0, 1)], [L['subject']], '17', '20')
    set_cell(c[(0, 3)], [L['grade']], '17', '20')
    set_cell(c[(1, 1)], L['topic'].split('\n'), '17', '20')
    set_cell(c[(1, 3)], [L['no']], '17', '46')
    set_cell(c[(2, 1)], L['goals'], '47', '20')
    set_h(c[(2, 0)], est_h(L['goals'], cell_w(c[(2, 1)]))); set_h(c[(2, 1)], est_h(L['goals'], cell_w(c[(2, 1)])))
    # 수업의 흐름 (중첩 표)
    flow = c[(3, 1)].find('.//hp:tbl', NS); fc = cells(flow)
    for col, lines in enumerate(L['flow']):
        set_cell(fc[(1, col)], lines, None, '20')
    fh = max(est_h(L['flow'][k], cell_w(fc[(1, k)]), ls=1.2) for k in range(3))
    for k in range(3): set_h(fc[(1, k)], fh)
    # 학습 형태 (중첩 표)
    grp = c[(4, 1)].find('.//hp:tbl', NS); gc = cells(grp)
    spec = []
    for gi, (act, org) in enumerate(L['groups']):
        last = gi == len(L['groups']) - 1
        src = 4 if last else 2
        spec.append([dict(col=0, lines=[act], tpl=gc[(src, 0)], cpr='20'), dict(col=1, lines=[org], tpl=gc[(src, 1)], cpr='20')])
    rebuild(grp, 1, spec)
    # 학습방법, 자료
    set_cell(c[(5, 1)], [L['method']], '17', '20')
    set_cell(c[(6, 1)], L['materials'], '49', '53')
    for tc_ in (c[(3, 0)], c[(4, 0)]):  # '(표수정 가능)' 빨간 안내 제거
        sub = tc_.find('hp:subList', NS); ps = sub.findall('hp:p', NS)
        for x in ps[1:]: sub.remove(x)
    new_body.append(info)
    # 과정안 표
    proc = copy.deepcopy(lesson_proc); reid(proc)
    t = tbl_of(proc); c = cells(t)
    steps = L['steps']
    n_dev = sum(1 for s in steps if s[0] in ('전개', ''))
    spec = []
    for si, (stage, elem, acts, tm, mat) in enumerate(steps):
        if stage == '도입':
            spec.append([dict(col=0, lines=['도입'], tpl=c[(1, 0)]), dict(col=1, lines=elem.split('\n'), tpl=c[(1, 1)]),
                         dict(col=2, lines=acts, tpl=c[(1, 2)], ppr='19', cpr='52', bold='51'),
                         dict(col=3, lines=[tm], tpl=c[(1, 3)]), dict(col=4, lines=mat, tpl=c[(1, 4)], cpr='52')])
        elif stage == '정리':
            spec.append([dict(col=0, lines=['정리'], tpl=c[(4, 0)]), dict(col=1, lines=elem.split('\n'), tpl=c[(4, 1)]),
                         dict(col=2, lines=acts, tpl=c[(4, 2)], ppr='19', cpr='52', bold='51'),
                         dict(col=3, lines=[tm], tpl=c[(4, 3)]), dict(col=4, lines=mat, tpl=c[(4, 4)], cpr='52')])
        else:
            row = []
            first = stage == '전개'
            if first:
                row += [dict(col=0, rs=n_dev, lines=['전개'], tpl=c[(2, 0)]), dict(col=1, rs=n_dev, lines=elem.split('\n'), tpl=c[(2, 1)])]
            src = 2 if first else 3
            row += [dict(col=2, lines=acts, tpl=c[(src, 2)], ppr='19', cpr='52', bold='51'),
                    dict(col=3, lines=[tm], tpl=c[(src, 3)]), dict(col=4, lines=mat, tpl=c[(src, 4)], cpr='52')]
            spec.append(row)
    rebuild(t, 1, spec)
    new_body.append(proc)

# 실천·확산 활동 (Ⅱ의 5번)
h = copy.deepcopy(lesson_head); reid(h); h.set('pageBreak', '1')
t = tbl_of(h); c = cells(t)
set_cell(c[(0, 0)], ['5'])
tc = c[(0, 2)]; tplp, ppr, cpr = cell_style(tc)
sub = tc.find('hp:subList', NS)
for x in sub.findall('hp:p', NS): sub.remove(x)
sub.append(para(tplp, [(' ' + C.PRACTICE_TITLE, cpr)], ppr))
new_body.append(h)
new_body += body_paras(C.PRACTICE)

# Ⅲ 학습자료
P1[33].set('pageBreak', '1')
new_body += [P1[33], P1[34]]
def mat_label_para(n, label):
    p = copy.deepcopy(mat_item); reid(p)
    # 사각형 안 '자료N'
    for t in p.iter(q('t')):
        if t.text and t.text.startswith('자료'): t.text = '자료%d' % n
        elif t.text and t.text.strip() == '수업 PPT': t.text = ' ' + label
    return p
def mat_sub(tpl, text):
    p = copy.deepcopy(tpl); reid(p)
    t = tbl_of(p); c = cells(t)
    tc = c[(0, 1)]; tplp, ppr, cpr = cell_style(tc)
    sub = tc.find('hp:subList', NS)
    for x in sub.findall('hp:p', NS): sub.remove(x)
    sub.append(para(tplp, [(text, GRAY2BLACK.get(cpr, cpr))], ppr))
    return p
for li in range(1, 5):
    M = C.MATERIALS[li]
    h = copy.deepcopy(mat_head); reid(h)
    if li > 1: h.set('pageBreak', '1')
    t = tbl_of(h); c = cells(t)
    set_cell(c[(0, 0)], [str(li)])
    tc = c[(0, 2)]; tplp, ppr, cpr = cell_style(tc)
    sub = tc.find('hp:subList', NS)
    for x in sub.findall('hp:p', NS): sub.remove(x)
    sub.append(para(tplp, [(' 교사·학생 학습자료 (%d차시)' % li, cpr)], ppr))
    new_body.append(h); new_body.append(copy.deepcopy(P1[39]))
    n = 1
    new_body.append(mat_sub(mat_sub_t, '교사 교수·학습 자료'))
    for label, lines in M['teacher']:
        new_body.append(mat_label_para(n, label)); n += 1
        new_body += body_paras(['- ' + x for x in lines])
    new_body.append(copy.deepcopy(P1[39]))
    new_body.append(mat_sub(mat_sub_s, '학생 활동 자료'))
    for label, lines in M['student']:
        new_body.append(mat_label_para(n, label)); n += 1
        new_body += body_paras(['- ' + x for x in lines])
    new_body.append(copy.deepcopy(P1[39]))
new_body += body_paras([C.FINAL_NOTE])

# Ⅳ 참고문헌
new_body += [P1[49], P1[50]]
for ref in C.REFERENCES:
    new_body.append(para(P1[51], [(ref, '81')], '74'))
new_body.append(P1[53])
# 붙임6·7 초상권 동의서
for i in (54, 55, 56, 57):
    replace_text(P1[i], '2025 00000 수업안 공모전 / 경진대회', '2027 보훈문화교육 수업안 경진대회')
    replace_text(P1[i], '2024 보훈문화교육 경진대회', '2027 보훈문화교육 수업안 경진대회')
    replace_text(P1[i], '2025년', '2027년')
    new_body.append(P1[i])

# section1 재구성
for p in r1.findall('hp:p', NS): r1.remove(p)
for p in new_body: r1.append(p)

strip_lineseg(r0); strip_lineseg(r1)
s0.write(s0_path, xml_declaration=True, encoding='UTF-8', standalone=True)
s1.write(s1_path, xml_declaration=True, encoding='UTF-8', standalone=True)

# ---------- 미리보기 텍스트·메타데이터 ----------
os.makedirs(os.path.join(SRC, 'Preview'), exist_ok=True)
prv = []
for root_ in (r0, r1):
    for p in root_.iter(q('p')):
        s = ''.join(t.text or '' for t in p.iter(q('t'))).strip()
        if s: prv.append(s)
with open(os.path.join(SRC, 'Preview', 'PrvText.txt'), 'w', encoding='utf-8') as f:
    f.write('\r\n'.join(prv)[:1024])
hpf = os.path.join(SRC, 'Contents', 'content.hpf')
h = open(hpf, encoding='utf-8').read()
h = re.sub(r'<opf:title>.*?</opf:title>', '<opf:title>%s</opf:title>' % ' '.join(x[0] for x in C.TITLE), h)
open(hpf, 'w', encoding='utf-8').write(h)

# ---------- 패키징 (mimetype 무압축·맨 앞) ----------
if os.path.exists(OUT): os.remove(OUT)
with zipfile.ZipFile(OUT, 'w') as z:
    z.write(os.path.join(SRC, 'mimetype'), 'mimetype', compress_type=zipfile.ZIP_STORED)
    for base, _, files in os.walk(SRC):
        for f in sorted(files):
            full = os.path.join(base, f); rel = os.path.relpath(full, SRC)
            if rel == 'mimetype': continue
            z.write(full, rel, compress_type=zipfile.ZIP_DEFLATED)
print('written', OUT)
