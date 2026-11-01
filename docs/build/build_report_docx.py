#!/usr/bin/env python
"""Build the submission Word report from docs/PROJECT_REPORT.md.

Run (from anywhere):
    S:\\retailmax-crm\\.venv\\Scripts\\python.exe docs\\build\\build_report_docx.py
    ...python.exe docs\\build\\build_report_docx.py --verify-only   # only run the checks

Output: submission/RetailMax_CRM_Project_Report.docx  (submission/ is gitignored)

The markdown is parsed here (headings, paragraphs, lists, tables, code fences,
images, bold / italic / inline code).  Nothing is shelled out to pandoc.  The
script is safe to re-run: the architecture PNGs (docs/figures/arch/*.png) are
looked up at run time, and a mermaid block falls back to a code block until the
matching PNG exists.
"""
from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path

from docx import Document
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import (WD_ALIGN_PARAGRAPH, WD_COLOR_INDEX, WD_LINE_SPACING,
                            WD_TAB_ALIGNMENT, WD_TAB_LEADER)
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor
from PIL import Image

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# --------------------------------------------------------------------------- paths
ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
MD = DOCS / "PROJECT_REPORT.md"
OUT = ROOT / "submission" / "RetailMax_CRM_Project_Report.docx"
APP_DIR = DOCS / "figures" / "app"
ARCH_DIR = DOCS / "figures" / "arch"

# mermaid blocks, matched by order of appearance in the markdown
MERMAID_IMAGES = ["dfd_level0.png", "dfd_level1.png", "block_diagram.png"]
MERMAID_CAPTIONS = [  # used when the heading above cannot be read
    "Data flow diagram, level 0", "Data flow diagram, level 1", "Block diagram"]

DEMO_URL = "https://kshitiz-git.github.io/retailmax-crm/"
REPO_URL = "https://github.com/kshitiz-git/retailmax-crm"

# Screenshot groups, in the order of the module table in section 10.  Each entry:
# (file, short title, one-line caption).  Captions were written after looking at each image.
SCREENSHOT_GROUPS = [
    ("Dashboard", [
        ("01-dashboard.png", "Dashboard",
         "Headline figures for customers, revenue, order value, churn, loyalty and consent, "
         "with charts of customers by RFM segment, revenue by region and churn rate by segment."),
    ]),
    ("Customers and Customer 360 view", [
        ("03-customers.png", "Customers",
         "Searchable customer list with segment, region, age band, orders, lifetime value, "
         "loyalty points, tier, churn risk and consent, and six filters."),
        ("04-customer-360.png", "Customer 360 view",
         "Profile of customer C00042: lifetime value, orders, loyalty progress, churn "
         "probability, recommended next action and the start of the RFM profile."),
        ("15-customer-360-detail.png", "Customer 360 view, lower part",
         "RFM profile (score 154), dataset label against the CRM-computed segment, the five "
         "factors that move this customer's churn score, the consent switch and the activity log."),
        ("16-award-points.png", "Award points dialog",
         "Awarding 2,000 points to C00042 for a goodwill reason takes the balance from 752 to "
         "2,752 and the tier from Bronze to Silver. Every change is saved in the activity history."),
    ]),
    ("RFM Segments", [
        ("05-segments.png", "RFM Segments",
         "How the R, F and M scores work, the segment rule with the customer count per "
         "segment, and a card for each of the five segments."),
        ("11-segments-heatmap.png", "RFM Segments, lower part",
         "Recency by frequency map with the customer count in each cell, revenue by segment, "
         "and the segment by region table."),
    ]),
    ("Churn Prediction", [
        ("06-churn.png", "Churn Prediction",
         "High-risk customer count, spend at risk, and the model card with accuracy, "
         "precision, recall, F1 and ROC-AUC, plus the note on HCL's 500 original rows."),
        ("12-churn-model.png", "Churn model evaluation",
         "Confusion matrix on the held-out test customers (644, 199, 40 and 110), logistic "
         "regression against random forest, and feature importance."),
        ("13-churn-whatif.png", "What-if simulator",
         "Sliders for the model inputs, the re-scored churn probability and the contribution of "
         "each factor. Nothing is saved."),
        ("14-churn-risk.png", "Risk bands and distribution",
         "Customers per risk band (High 1,580, Medium 1,095, Low 2,286) and the distribution of "
         "churn probability across ten buckets."),
    ]),
    ("Campaigns", [
        ("07-campaigns.png", "Campaigns",
         "Empty state before any campaign is created, with the Create campaign button and "
         "three ready-made templates. Only customers who gave consent are contacted."),
        ("17-campaign-wizard-audience.png", "Create campaign, step 2 (Audience)",
         "Segment, region, age group and risk filters with live counts: 1,445 At Risk customers "
         "match, 1,173 will be contacted and 272 are excluded because they did not consent."),
        ("18-campaign-wizard-review.png", "Create campaign, step 3 (Review)",
         "Name, channel, offer, discount and points multiplier of the At Risk win-back "
         "campaign, the same consent counts, and the Save draft, Schedule and Launch now buttons."),
        ("19-campaign-results.png", "Completed campaign",
         "Audience counts, simulated results (revenue, conversion, points awarded) and the funnel "
         "from sent to delivered, opened, clicked and converted."),
    ]),
    ("Loyalty", [
        ("08-loyalty.png", "Loyalty",
         "Points outstanding and liability, the programme rules (1 point per INR 100, "
         "INR 0.25 per point), the four tiers and members by tier."),
        ("21-loyalty-detail.png", "Loyalty, lower part",
         "Points by segment, bulk award to a segment or tier (1,016 Champions would get 200 "
         "points each) and the customers close to the next tier with a Nudge action."),
    ]),
    ("Sales Funnel", [
        ("02-funnel.png", "Sales Funnel",
         "The customer lifecycle funnel from all customers to retained customers, with region, "
         "age group and segment filters and the kept and lost share at every step."),
        ("23-funnel-campaign.png", "Sales Funnel, lower part",
         "Funnel by region, average order value by age group and purchase frequency, and the "
         "campaign funnel from sent to converted."),
    ]),
    ("Data Import / Export", [
        ("09-data.png", "Data Import / Export",
         "Current data source, the nine expected CSV columns with allowed values, and the "
         "file upload area."),
        ("20-data-import-validation.png", "CSV import with validation",
         "A four-row test file gives 2 valid rows and 2 rejected rows listed by line number "
         "(region \"Mars\" invalid; purchase_freq must be >= 0), with Merge and Replace buttons "
         "and the two export options."),
    ]),
    ("Privacy and Consent", [
        ("10-privacy.png", "Privacy and Consent",
         "Privacy principles (anonymised IDs, consent before marketing, purpose limitation, "
         "right to erasure, audit trail) and the marketing consent charts."),
        ("22-privacy-logs.png", "Privacy and Consent, lower part",
         "Per-customer consent switches, the right-to-erasure form, the list of erased IDs and "
         "the consent and audit logs."),
    ]),
]
# two phone-width captures, placed side by side
MOBILE_SHOTS = [
    ("24-mobile-dashboard.png", "Dashboard on a phone",
     "At a width of 390 px the cards stack in one column."),
    ("25-mobile-customer-360.png", "Customer 360 on a phone",
     "Profile of C00042 at a width of 390 px."),
]
MOBILE_W_IN = 2.6
ALL_SHOTS = [x for _, g in SCREENSHOT_GROUPS for x in g] + MOBILE_SHOTS

# Two sentences in section 10 told the learner to add screenshots later.  They are now
# in section 10.1, so the build replaces/drops them (reported in the final message).
SCREENSHOT_NOTE_DROP = "*[FILL IN: add one screenshot per module here for the final submission.]*"
SCREENSHOT_SENTENCE = ("learner screenshots should be added where marked.",
                       "screenshots of every screen are in section 10.1.")

# --------------------------------------------------------------------------- look
FONT = "Calibri"
MONO = "Consolas"
PURPLE = RGBColor(0x4C, 0x1D, 0x95)
INK = RGBColor(0x1F, 0x29, 0x37)
GREY = RGBColor(0x37, 0x41, 0x51)
MUTED = RGBColor(0x6B, 0x72, 0x80)
PAGE_W_IN = 8.268          # A4 width
MARGIN_IN = 1.0            # 2.54 cm
TEXT_W_IN = PAGE_W_IN - 2 * MARGIN_IN   # 6.268 in of usable width
IMG_MAX_W_IN = 6.26        # spec says max 6.3 in; the text block is 6.268 in wide
IMG_MAX_H_IN = 8.0
FILL_RE = re.compile(r"(\[FILL IN[^\]]*\])")


# =========================================================================== XML helpers
PPR_ORDER = ["pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr", "widowControl",
             "numPr", "suppressLineNumbers", "pBdr", "shd", "tabs", "suppressAutoHyphens",
             "kinsoku", "wordWrap", "overflowPunct", "topLinePunct", "autoSpaceDE",
             "autoSpaceDN", "bidi", "adjustRightInd", "snapToGrid", "spacing", "ind",
             "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc", "textDirection",
             "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr",
             "sectPr", "pPrChange"]
RPR_ORDER = ["rStyle", "rFonts", "b", "bCs", "i", "iCs", "caps", "smallCaps", "strike",
             "dstrike", "outline", "shadow", "emboss", "imprint", "noProof", "snapToGrid",
             "vanish", "webHidden", "color", "spacing", "w", "kern", "position", "sz", "szCs",
             "highlight", "u", "effect", "bdr", "shd", "fitText", "vertAlign", "rtl", "cs",
             "em", "lang", "eastAsianLayout", "specVanish", "oMath"]


def _local(el) -> str:
    return el.tag.split("}")[1]


def insert_ordered(parent, child, order):
    """Insert child into parent at the position the OOXML schema requires."""
    name = _local(child)
    for old in parent.findall(child.tag):
        parent.remove(old)
    idx = order.index(name)
    for existing in list(parent):
        en = _local(existing)
        if en in order and order.index(en) > idx:
            existing.addprevious(child)
            return child
    parent.append(child)
    return child


def el(tag, **attrs):
    e = OxmlElement(tag)
    for k, v in attrs.items():
        e.set(qn("w:" + k), str(v))
    return e


def set_fonts(rpr, name):
    """Force one font on all four slots and drop theme-font attributes."""
    rf = rpr.find(qn("w:rFonts"))
    if rf is None:
        rf = el("w:rFonts")
        insert_ordered(rpr, rf, RPR_ORDER)
    for a in ("asciiTheme", "hAnsiTheme", "eastAsiaTheme", "cstheme"):
        rf.attrib.pop(qn("w:" + a), None)
    for a in ("ascii", "hAnsi", "eastAsia", "cs"):
        rf.set(qn("w:" + a), name)


def style_font(style, name=FONT, size=None, bold=None, italic=None, color=None):
    rpr = style.element.get_or_add_rPr()
    set_fonts(rpr, name)
    if size is not None:
        style.font.size = Pt(size)
    if bold is not None:
        style.font.bold = bold
    if italic is not None:
        style.font.italic = italic
    if color is not None:
        style.font.color.rgb = color
    sp = rpr.find(qn("w:spacing"))     # template's Title has letter spacing
    if sp is not None:
        rpr.remove(sp)


def style_ppr(style):
    return style.element.get_or_add_pPr()


def style_shading_border(style, fill=None, left_color=None, bottom_color=None, bottom_sz=6):
    ppr = style_ppr(style)
    for old in ppr.findall(qn("w:pBdr")):
        ppr.remove(old)
    if left_color or bottom_color:
        b = el("w:pBdr")
        if left_color:
            b.append(el("w:left", val="single", sz=18, space=6, color=left_color))
        if bottom_color:
            b.append(el("w:bottom", val="single", sz=bottom_sz, space=4, color=bottom_color))
        insert_ordered(ppr, b, PPR_ORDER)
    if fill:
        insert_ordered(ppr, el("w:shd", val="clear", color="auto", fill=fill), PPR_ORDER)


def add_fld(par, kind):
    r = par.add_run()
    r._r.append(el("w:fldChar", fldCharType=kind))
    return r


def add_instr(par, text):
    r = par.add_run()
    t = OxmlElement("w:instrText")
    t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    t.text = text
    r._r.append(t)
    return r


def add_simple_field(par, instr, placeholder="1"):
    add_fld(par, "begin")
    add_instr(par, f" {instr} ")
    add_fld(par, "separate")
    par.add_run(placeholder)
    add_fld(par, "end")


def add_hyperlink(par, url, text):
    rid = par.part.relate_to(url, RT.HYPERLINK, is_external=True)
    h = el("w:hyperlink", history=1)
    h.set(qn("r:id"), rid)
    r = el("w:r")
    rpr = el("w:rPr")
    rpr.append(el("w:color", val="0563C1"))
    rpr.append(el("w:u", val="single"))
    r.append(rpr)
    t = el("w:t")
    t.text = text
    r.append(t)
    h.append(r)
    par._p.append(h)


# =========================================================================== markdown parse
def strip_md(s: str) -> str:
    s = re.sub(r"`([^`]*)`", r"\1", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"\*(?!\s)([^*]+?)\*", r"\1", s)
    return s


def split_row(line: str):
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|")]


def parse_table(rows):
    header = split_row(rows[0])
    aligns = []
    for c in split_row(rows[1]):
        left, right = c.startswith(":"), c.endswith(":")
        aligns.append("c" if left and right else "r" if right else "l")
    body = [split_row(r) for r in rows[2:]]
    n = len(header)
    body = [(r + [""] * n)[:n] for r in body]
    return ("table", header, aligns, body)


ITEM_RE = re.compile(r"^(\s*)([-*]|\d+\.)\s+(.*)$")


def parse_md(text: str):
    lines = text.splitlines()
    blocks, para = [], []
    i = 0

    def flush():
        if para:
            blocks.append(("p", " ".join(s.strip() for s in para)))
            para.clear()

    while i < len(lines):
        ln = lines[i]
        if ln.startswith("```"):
            flush()
            lang = ln[3:].strip()
            i += 1
            code = []
            while i < len(lines) and not lines[i].startswith("```"):
                code.append(lines[i])
                i += 1
            i += 1
            blocks.append(("code", lang, code))
            continue
        if not ln.strip():
            flush()
            i += 1
            continue
        if re.fullmatch(r"-{3,}", ln.strip()):
            flush()
            blocks.append(("hr",))
            i += 1
            continue
        m = re.match(r"(#{1,6})\s+(.*)", ln)
        if m:
            flush()
            blocks.append(("h", len(m.group(1)), m.group(2).strip()))
            i += 1
            continue
        m = re.fullmatch(r"!\[(.*)\]\((.*)\)", ln.strip())
        if m:
            flush()
            blocks.append(("img", m.group(1), m.group(2)))
            i += 1
            continue
        if ln.lstrip().startswith("|"):
            flush()
            rows = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                rows.append(lines[i])
                i += 1
            blocks.append(parse_table(rows))
            continue
        m = ITEM_RE.match(ln)
        if m and not ln.startswith("**"):
            flush()
            ordered = m.group(2)[0].isdigit()
            items = []
            while i < len(lines):
                mm = ITEM_RE.match(lines[i])
                if mm and (mm.group(2)[0].isdigit() == ordered):
                    num = mm.group(2).rstrip(".") if ordered else None
                    items.append([num, mm.group(3).strip()])
                    i += 1
                elif lines[i].strip() and lines[i].startswith((" ", "\t")) and items:
                    items[-1][1] += " " + lines[i].strip()
                    i += 1
                else:
                    break
            blocks.append(("ol" if ordered else "ul", items))
            continue
        para.append(ln)
        i += 1
    flush()
    return blocks


# =========================================================================== inline runs
INLINE_RE = re.compile(r"(`[^`]+`|\*\*.+?\*\*|\*(?!\s)[^*]+?\*)")


def add_run(par, text, bold=False, italic=False, mono=False, size=None, color=None):
    """One run; [FILL IN ...] text gets a yellow highlight so the learner can find it."""
    for seg in FILL_RE.split(text):
        if not seg:
            continue
        r = par.add_run(seg)
        r.bold = bold or None
        r.italic = italic or None
        if mono:
            set_fonts(r._r.get_or_add_rPr(), MONO)
            if size:
                r.font.size = Pt(size)
            insert_ordered(r._r.get_or_add_rPr(),
                           el("w:shd", val="clear", color="auto", fill="EEF0F3"), RPR_ORDER)
        elif size:
            r.font.size = Pt(size)
        if color is not None:
            r.font.color.rgb = color
        if FILL_RE.fullmatch(seg):
            r.font.highlight_color = WD_COLOR_INDEX.YELLOW


def add_inline(par, text, bold=False, italic=False, size=None, code_size=None, color=None):
    pos = 0
    for m in INLINE_RE.finditer(text):
        if m.start() > pos:
            add_run(par, text[pos:m.start()], bold, italic, size=size, color=color)
        tok = m.group(0)
        if tok.startswith("`"):
            add_run(par, tok[1:-1], bold, italic, mono=True, size=code_size, color=color)
        elif tok.startswith("**"):
            add_inline(par, tok[2:-2], True, italic, size, code_size, color)
        else:
            add_inline(par, tok[1:-1], bold, True, size, code_size, color)
        pos = m.end()
    if pos < len(text):
        add_run(par, text[pos:], bold, italic, size=size, color=color)


# =========================================================================== document setup
def setup_document():
    doc = Document()
    cp = doc.core_properties
    cp.title = "RetailMax CRM: Streamlining Customer Relationships - Project Report"
    cp.subject = "HCLTech Career Shaper Programme, Project No. 27"
    cp.author = ""
    cp.last_modified_by = ""
    cp.comments = ""
    cp.keywords = "CRM, RFM, churn prediction, DPDP Act 2023"

    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
    sec.left_margin = sec.right_margin = sec.top_margin = sec.bottom_margin = Inches(MARGIN_IN)
    sec.header_distance = sec.footer_distance = Cm(1.25)
    sec.different_first_page_header_footer = True   # no header / footer on the title page

    st = doc.styles
    # document defaults: Calibri everywhere, English (India)
    dd = st.element.find(qn("w:docDefaults"))
    rpr = dd.find(qn("w:rPrDefault")).find(qn("w:rPr"))
    set_fonts(rpr, FONT)
    rpr.find(qn("w:lang")).set(qn("w:val"), "en-IN")

    normal = st["Normal"]
    style_font(normal, FONT, 11)
    pf = normal.paragraph_format
    pf.space_before, pf.space_after = Pt(0), Pt(6)
    pf.line_spacing_rule, pf.line_spacing = WD_LINE_SPACING.MULTIPLE, 1.15

    def heading(name, size, color, before, after, bottom_rule=None):
        s = st[name]
        style_font(s, FONT, size, True, False, color)
        s.paragraph_format.space_before = Pt(before)
        s.paragraph_format.space_after = Pt(after)
        s.paragraph_format.keep_with_next = True
        if bottom_rule:
            style_shading_border(s, bottom_color=bottom_rule)
        return s

    heading("Heading 1", 20, PURPLE, 0, 12, bottom_rule="C4B5FD")
    heading("Heading 2", 14, INK, 16, 6)
    heading("Heading 3", 12, GREY, 12, 4)

    t = st["Title"]
    style_font(t, FONT, 30, True, False, PURPLE)
    style_shading_border(t)  # clears the template's blue bottom border
    t.paragraph_format.space_before, t.paragraph_format.space_after = Pt(0), Pt(6)
    t.paragraph_format.line_spacing = 1.0
    for cs in t.element.pPr.findall(qn("w:contextualSpacing")):
        t.element.pPr.remove(cs)

    sub = st["Subtitle"]
    style_font(sub, FONT, 12, True, False, GREY)
    sub.paragraph_format.space_after = Pt(18)
    for r in sub.element.rPr.findall(qn("w:spacing")):
        sub.element.rPr.remove(r)

    cap = st["Caption"]
    style_font(cap, FONT, 9.5, False, True, GREY)
    cap.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_before, cap.paragraph_format.space_after = Pt(2), Pt(12)
    cap.paragraph_format.line_spacing = 1.0

    for nm in ("Header", "Footer"):
        style_font(st[nm], FONT, 9, False, False, MUTED)

    lb = st["List Bullet"]
    lb.paragraph_format.space_after = Pt(3)
    for cs in lb.element.pPr.findall(qn("w:contextualSpacing")):
        lb.element.pPr.remove(cs)

    th = st["TOC Heading"]
    style_font(th, FONT, 20, True, False, PURPLE)
    th.paragraph_format.space_before, th.paragraph_format.space_after = Pt(0), Pt(12)
    ppr = style_ppr(th)
    insert_ordered(ppr, el("w:outlineLvl", val=9), PPR_ORDER)   # keep "Contents" out of the TOC
    style_shading_border(th, bottom_color="C4B5FD")

    # custom paragraph styles
    code = st.add_style("Code Block", WD_STYLE_TYPE.PARAGRAPH)
    code.base_style = normal
    style_font(code, MONO, 9)
    code.paragraph_format.space_before = code.paragraph_format.space_after = Pt(0)
    code.paragraph_format.line_spacing = 1.0
    code.paragraph_format.left_indent = Inches(0.12)
    code.paragraph_format.keep_together = True
    style_shading_border(code, fill="F3F4F6", left_color="7C3AED")

    tt = st.add_style("Table Text", WD_STYLE_TYPE.PARAGRAPH)
    tt.base_style = normal
    style_font(tt, FONT, 9.5)
    tt.paragraph_format.space_before = tt.paragraph_format.space_after = Pt(0)
    tt.paragraph_format.line_spacing = 1.0

    ni = st.add_style("Numbered Item", WD_STYLE_TYPE.PARAGRAPH)
    ni.base_style = normal
    ni.paragraph_format.left_indent = Inches(0.35)
    ni.paragraph_format.first_line_indent = Inches(-0.35)
    ni.paragraph_format.space_after = Pt(4)
    ni.paragraph_format.tab_stops.add_tab_stop(Inches(0.35))

    for lvl, ind, bold in ((1, 0.0, True), (2, 0.25, False), (3, 0.5, False)):
        s = st.add_style(f"toc {lvl}", WD_STYLE_TYPE.PARAGRAPH)
        # make it Word's built-in TOC style (id TOC1, not a custom style) so that the
        # regenerated TOC picks up this formatting instead of Word's default
        s.element.set(qn("w:styleId"), f"TOC{lvl}")
        s.element.attrib.pop(qn("w:customStyle"), None)
        s.base_style = normal
        style_font(s, FONT, 11 if lvl == 1 else 10.5, bold, False, INK)
        s.paragraph_format.left_indent = Inches(ind)
        s.paragraph_format.space_before = Pt(5 if lvl == 1 else 0)
        s.paragraph_format.space_after = Pt(1)
        s.paragraph_format.line_spacing = 1.0
        s.paragraph_format.tab_stops.add_tab_stop(Inches(TEXT_W_IN), WD_TAB_ALIGNMENT.RIGHT,
                                                  WD_TAB_LEADER.DOTS)

    # header / footer
    hp = sec.header.paragraphs[0]
    hp.text = "RetailMax CRM \u2014 Project Report"
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    insert_ordered(hp._p.get_or_add_pPr(),
                   el("w:pBdr"), PPR_ORDER)
    hp._p.pPr.find(qn("w:pBdr")).append(el("w:bottom", val="single", sz=4, space=4, color="D1D5DB"))
    fp = sec.footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fp.add_run("Page ")
    add_simple_field(fp, "PAGE", "1")

    # settings: refresh fields on open; compat mode 15 avoids "Compatibility Mode" in the title bar
    s = doc.settings.element
    uf = el("w:updateFields", val="true")
    compat = s.find(qn("w:compat"))
    compat.addprevious(uf)
    for cs in compat.findall(qn("w:compatSetting")):
        if cs.get(qn("w:name")) == "compatibilityMode":
            cs.set(qn("w:val"), "15")
    return doc


# =========================================================================== block emitters
def png_size_in(path: Path, max_w=IMG_MAX_W_IN, max_h=IMG_MAX_H_IN):
    with Image.open(path) as im:
        w, h = im.size
    width = max_w
    height = width * h / w
    if height > max_h:
        height = max_h
        width = height * w / h
    return width, height


def add_figure(doc, path: Path, caption: str, alt: str, container=None, max_w=IMG_MAX_W_IN):
    """Picture paragraph (keep with next) + Caption paragraph.  container: doc or table cell."""
    if container is None:
        p = doc.add_paragraph()
    else:                                   # table cell: reuse its empty first paragraph
        p = container.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.0
    w, _ = png_size_in(path, max_w)
    shape = p.add_run().add_picture(str(path), width=Inches(w))
    shape._inline.docPr.set("descr", alt or caption)
    shape._inline.docPr.set("title", caption[:120])
    c = (container or doc).add_paragraph(style="Caption")
    add_inline(c, caption)
    return p


def add_figure_row(doc, items):
    """Borderless table with one picture + caption per cell (the phone screenshots)."""
    tbl = doc.add_table(rows=1, cols=len(items))
    tbl.autofit = True
    tblPr = tbl._tbl.tblPr
    tblW = tblPr.find(qn("w:tblW"))
    tblW.set(qn("w:type"), "pct")
    tblW.set(qn("w:w"), "5000")
    row = tbl.rows[0]
    row._tr.get_or_add_trPr().append(el("w:cantSplit"))
    for cell, (path, caption, alt) in zip(row.cells, items):
        cell.width = Inches(TEXT_W_IN / len(items))
        add_figure(doc, path, caption, alt, container=cell, max_w=MOBILE_W_IN)
    return tbl


def add_code(doc, lines, after_table=False):
    n = len(lines)
    for k, ln in enumerate(lines):
        p = doc.add_paragraph(style="Code Block")
        if k < n - 1:
            p.paragraph_format.keep_with_next = True
        if k == 0:
            p.paragraph_format.space_before = Pt(4)
        if k == n - 1:
            p.paragraph_format.space_after = Pt(10)
        if ln:
            p.add_run(ln.expandtabs(4))


def col_weights(header, rows):
    ws = []
    for j in range(len(header)):
        cells = [strip_md(header[j])] + [strip_md(r[j]) for r in rows]
        longest = max((len(w) for c in cells for w in c.split()), default=1)
        avg = sum(len(c) for c in cells) / len(cells)
        ws.append(max(min(longest, 20) + 2, min(avg, 60)))
    return ws


def add_table(doc, header, aligns, rows, first_cell_bold=False):
    ncols = len(header)
    tbl = doc.add_table(rows=1 + len(rows), cols=ncols)
    tbl.style = doc.styles["Table Grid"]
    tbl.autofit = True
    tblPr = tbl._tbl.tblPr
    tblW = tblPr.find(qn("w:tblW"))
    tblW.set(qn("w:type"), "pct")
    tblW.set(qn("w:w"), "5000")
    borders = el("w:tblBorders")
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        borders.append(el("w:" + side, val="single", sz=4, space=0, color="9CA3AF"))
    tblW.addnext(borders)
    mar = el("w:tblCellMar")
    for side, w in (("top", 45), ("left", 90), ("bottom", 45), ("right", 90)):
        mar.append(el("w:" + side, w=w, type="dxa"))
    layout = tblPr.find(qn("w:tblLayout"))
    (layout if layout is not None else borders).addnext(mar)

    ws = col_weights(header, rows)
    total = sum(ws)
    widths = [max(0.5, TEXT_W_IN * w / total) for w in ws]
    scale = TEXT_W_IN / sum(widths)
    widths = [Inches(w * scale) for w in widths]
    for j, col in enumerate(tbl.columns):
        col.width = widths[j]

    # keep short tables on one page
    small = len(rows) <= 12 and sum(len(strip_md(c)) for r in rows for c in r) < 1700
    align_map = {"l": WD_ALIGN_PARAGRAPH.LEFT, "r": WD_ALIGN_PARAGRAPH.RIGHT,
                 "c": WD_ALIGN_PARAGRAPH.CENTER}
    all_rows = [header] + rows
    for ri, data in enumerate(all_rows):
        row = tbl.rows[ri]
        trPr = row._tr.get_or_add_trPr()
        trPr.append(el("w:cantSplit"))
        if ri == 0:
            trPr.append(el("w:tblHeader"))
        for ci, text in enumerate(data):
            cell = row.cells[ci]
            cell.width = widths[ci]
            if ri == 0:
                tcPr = cell._tc.get_or_add_tcPr()
                tcPr.append(el("w:shd", val="clear", color="auto", fill="EDE9FE"))
            cell.vertical_alignment = (WD_CELL_VERTICAL_ALIGNMENT.CENTER if ri == 0
                                       else WD_CELL_VERTICAL_ALIGNMENT.TOP)
            p = cell.paragraphs[0]
            p.style = doc.styles["Table Text"]
            p.alignment = align_map[aligns[ci]]
            if small and ri < len(all_rows) - 1:
                p.paragraph_format.keep_with_next = True
            add_inline(p, text, bold=(ri == 0), size=None, code_size=8.5)
    return tbl


def add_toc(doc, entries):
    """Real TOC field (\\o "1-3" \\h \\z \\u) with a text-only placeholder result."""
    title = doc.add_paragraph("Contents", style="TOC Heading")
    title.paragraph_format.page_break_before = True
    first = True
    last = None
    for level, text in entries:
        p = doc.add_paragraph(style=f"toc {level}")
        if first:
            add_fld(p, "begin")
            p._p.findall(qn("w:r"))[-1].find(qn("w:fldChar")).set(qn("w:dirty"), "true")
            add_instr(p, ' TOC \\o "1-3" \\h \\z \\u ')
            add_fld(p, "separate")
            first = False
        p.add_run(text)
        last = p
    add_fld(last, "end")


def build_title_page(doc, blocks):
    ov = doc.add_paragraph()
    ov.paragraph_format.space_before = Pt(70)
    ov.paragraph_format.space_after = Pt(8)
    r = ov.add_run("PROJECT REPORT")
    r.font.size = Pt(11)
    r.bold = True
    r.font.color.rgb = RGBColor(0x7C, 0x3A, 0xED)
    for b in blocks:
        if b[0] == "h" and b[1] == 1:
            doc.add_paragraph(b[2], style="Title")
        elif b[0] == "p":
            p = doc.add_paragraph(style="Subtitle")
            add_inline(p, b[1])
            p.paragraph_format.space_after = Pt(24)
        elif b[0] == "table":
            add_table(doc, b[1], b[2], b[3])
    for label, url in (("Live demo", DEMO_URL), ("Source code", REPO_URL)):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10 if label == "Live demo" else 0)
        p.paragraph_format.space_after = Pt(2)
        r = p.add_run(f"{label}: ")
        r.bold = True
        add_hyperlink(p, url, url)


def screenshot_toc_entries():
    out = [(2, "10.1 Application screenshots")]
    for g, (name, _) in enumerate(SCREENSHOT_GROUPS, 1):
        out.append((3, f"10.1.{g} {name}"))
    out.append((3, f"10.1.{len(SCREENSHOT_GROUPS) + 1} Mobile layout"))
    return out


def screenshots_block(doc):
    h = doc.add_paragraph(style="Heading 2")
    h.add_run("10.1 Application screenshots")
    p = doc.add_paragraph()
    p.paragraph_format.keep_with_next = True
    num = {f: i for i, (f, _, _) in enumerate(ALL_SHOTS, 1)}   # figure number per file
    add_inline(p, "The figures below show the screens of the application with the delivered "
                  "dataset (4,961 customers) loaded, grouped by module in the order of the "
                  "table above. Most are 1440 x 900 pixel captures of the desktop layout; "
                  "where a screen is longer than the window, the lower part is shown in a "
                  "second figure. The last two figures show the same application at a phone "
                  f"width of 390 px. The campaign in Figures S{num['17-campaign-wizard-audience.png']} "
                  f"to S{num['19-campaign-results.png']} and the four-row CSV in Figure "
                  f"S{num['20-data-import-validation.png']} are test input created for the captures.")
    n = 0
    for g, (name, shots) in enumerate(SCREENSHOT_GROUPS, 1):
        h3 = doc.add_paragraph(style="Heading 3")
        h3.add_run(f"10.1.{g} {name}")
        for fname, title, desc in shots:
            path = APP_DIR / fname
            if not path.exists():
                raise FileNotFoundError(path)
            n += 1
            add_figure(doc, path, f"Figure S{n}: {title}. {desc}", f"Screenshot: {title}")
    h3 = doc.add_paragraph(style="Heading 3")
    h3.add_run(f"10.1.{len(SCREENSHOT_GROUPS) + 1} Mobile layout")
    items = []
    for fname, title, desc in MOBILE_SHOTS:
        path = APP_DIR / fname
        if not path.exists():
            raise FileNotFoundError(path)
        n += 1
        items.append((path, f"Figure S{n}: {title}. {desc}", f"Screenshot: {title}"))
    add_figure_row(doc, items)
    return n


# =========================================================================== build
def apply_overrides(blocks):
    out = []
    shots_ok = all((APP_DIR / f).exists() for f, _, _ in ALL_SHOTS)
    for b in blocks:
        if shots_ok and b[0] == "p":
            if b[1] == SCREENSHOT_NOTE_DROP:
                continue
            if SCREENSHOT_SENTENCE[0] in b[1]:
                b = ("p", b[1].replace(*SCREENSHOT_SENTENCE))
        out.append(b)
    return out


def build():
    raw = MD.read_text(encoding="utf-8")
    blocks = apply_overrides(parse_md(raw))

    # split: title page | Contents (replaced by a TOC field) | body
    ci = next(i for i, b in enumerate(blocks) if b[0] == "h" and b[2] == "Contents")
    title_blocks = [b for b in blocks[:ci] if b[0] != "hr"]
    bi = next(i for i in range(ci + 1, len(blocks)) if blocks[i][0] == "h")
    body = [b for b in blocks[bi:] if b[0] != "hr"]

    # the screenshots block goes right before "## 11." (after all of section 10)
    k = next(i for i, b in enumerate(body) if b[0] == "h" and b[1] == 2 and b[2].startswith("11."))
    body.insert(k, ("screens",))

    # TOC placeholder entries (Word replaces them with the real TOC on open)
    entries = []
    for b in body:
        if b[0] == "h" and 2 <= b[1] <= 4:
            entries.append((b[1] - 1, strip_md(b[2])))
        elif b[0] == "screens":
            entries.extend(screenshot_toc_entries())

    doc = setup_document()
    build_title_page(doc, title_blocks)
    add_toc(doc, entries)

    mermaid_n = 0
    last_heading = ""
    prev = None
    for idx, b in enumerate(body):
        kind = b[0]
        nxt = body[idx + 1][0] if idx + 1 < len(body) else None
        if kind == "h":
            level = b[1] - 1          # md "##" is a numbered section = Word Heading 1
            level = max(1, min(level, 3))
            p = doc.add_paragraph(style=f"Heading {level}")
            if level == 1:
                p.paragraph_format.page_break_before = True
            add_inline(p, b[2], code_size=None)
            last_heading = strip_md(b[2])
        elif kind == "screens":
            screenshots_block(doc)
        elif kind == "p":
            p = doc.add_paragraph()
            if prev == "table":
                p.paragraph_format.space_before = Pt(8)
            if b[1].rstrip().endswith(":") or (nxt in ("table", "code") and len(b[1]) < 300):
                p.paragraph_format.keep_with_next = True
            add_inline(p, b[1])
        elif kind == "ul":
            for n, (_, text) in enumerate(b[1]):
                p = doc.add_paragraph(style="List Bullet")
                if n == 0 and prev == "table":
                    p.paragraph_format.space_before = Pt(8)
                add_inline(p, text)
        elif kind == "ol":
            for num, text in b[1]:
                p = doc.add_paragraph(style="Numbered Item")
                add_inline(p, f"{num}.\t" + text)
        elif kind == "table":
            add_table(doc, b[1], b[2], b[3])
        elif kind == "code":
            lang, lines = b[1], b[2]
            if lang == "mermaid":
                mermaid_n += 1
                fname = MERMAID_IMAGES[mermaid_n - 1] if mermaid_n <= len(MERMAID_IMAGES) else None
                path = ARCH_DIR / fname if fname else None
                head = re.sub(r"^\d+(\.\d+)*\s+", "", last_heading) or MERMAID_CAPTIONS[mermaid_n - 1]
                if path is not None and path.exists():
                    print(f"mermaid block {mermaid_n} ({last_heading}) -> image {path.relative_to(ROOT)}")
                    add_figure(doc, path, f"Figure D{mermaid_n}: {head}", f"Diagram: {head}")
                else:
                    print(f"mermaid block {mermaid_n} ({last_heading}) -> {fname} NOT FOUND, "
                          f"kept as code block")
                    add_code(doc, lines)
            else:
                add_code(doc, lines)
        elif kind == "img":
            path = (DOCS / b[2]).resolve()
            if not path.exists():
                raise FileNotFoundError(path)
            add_figure(doc, path, b[1], b[1])
        prev = kind if kind != "screens" else "img"

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUT)
    print(f"saved {OUT}  ({OUT.stat().st_size / 1e6:.2f} MB)")


# =========================================================================== verification
LEFTOVER = re.compile(r"\*\*|```|^#{1,6} |\|---|`(?=\w)")


def verify():
    import zipfile
    from collections import Counter
    doc = Document(OUT)
    heads = [(p.style.name, p.text) for p in doc.paragraphs if p.style.name.startswith("Heading")]
    cnt = Counter(s for s, _ in heads)
    print("headings by level:", {k: cnt[k] for k in sorted(cnt)})
    h1 = [t for s, t in heads if s == "Heading 1"]
    print("Heading 1 texts:", " | ".join(h1))
    print("Heading 2 texts:", " | ".join(t for s, t in heads if s == "Heading 2"))
    need = [f"{n}." for n in range(1, 17)] + ["Appendix A", "Appendix B", "Appendix C"]
    missing = [n for n in need if not any(t.startswith(n) for t in h1)]
    print("required sections missing:", missing or "none")

    print("inline images:", len(doc.inline_shapes))
    src = {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
           for p in sorted((DOCS / "figures").glob("fig[0-9][0-9]_*.png"))}
    def blob_of(shape):
        rid = shape._inline.graphic.graphicData.pic.blipFill.blip.embed
        return doc.part.related_parts[rid].blob

    embedded = Counter(hashlib.sha256(blob_of(s)).hexdigest() for s in doc.inline_shapes)
    per_fig = {n: embedded.get(h, 0) for n, h in src.items()}
    print(f"EDA figures (fig00..fig10) embedded exactly once: "
          f"{sum(v == 1 for v in per_fig.values())}/{len(per_fig)}",
          {k: v for k, v in per_fig.items() if v != 1} or "")
    shots = {f: embedded.get(hashlib.sha256((APP_DIR / f).read_bytes()).hexdigest(), 0)
             for f, _, _ in ALL_SHOTS}
    print(f"screenshots embedded exactly once: {sum(v == 1 for v in shots.values())}/{len(shots)}",
          {k: v for k, v in shots.items() if v != 1} or "")
    arch = {p.name: embedded.get(hashlib.sha256(p.read_bytes()).hexdigest(), 0)
            for p in sorted(ARCH_DIR.glob("*.png"))} if ARCH_DIR.exists() else {}
    print("arch diagrams embedded:", arch or "none present")
    need_imgs = len(per_fig) + len(shots) + len(arch)
    print(f"inline images {len(doc.inline_shapes)} >= {need_imgs} expected:",
          "OK" if len(doc.inline_shapes) >= need_imgs else "FAIL")
    print("tables:", len(doc.tables))

    texts = []
    for p in doc.paragraphs:
        texts.append((p.style.name, p.text))
    for t in doc.tables:
        for row in t.rows:
            for c in row.cells:
                for p in c.paragraphs:
                    texts.append(("cell", p.text))
    words = sum(len(t.split()) for s, t in texts if not s.lower().startswith("toc"))
    print("body word count (paragraphs + table cells, TOC placeholder excluded):", words)
    hits = [(s, t[:80]) for s, t in texts if any(LEFTOVER.search(line) for line in t.splitlines())]
    print("leftover markdown hits:", len(hits))
    for h in hits:
        print("   HIT", h)
    fill = sum(t.count("[FILL IN") for s, t in texts)
    print("[FILL IN] markers kept:", fill)
    with zipfile.ZipFile(OUT) as z:
        settings = z.read("word/settings.xml").decode("utf8")
        docxml = z.read("word/document.xml").decode("utf8")
    print("settings.xml has updateFields:", "<w:updateFields" in settings)
    print("document.xml has TOC field:", 'TOC \\o "1-3" \\h \\z \\u' in docxml)
    sec = doc.sections[0]
    print(f"page {sec.page_width.cm:.1f} x {sec.page_height.cm:.1f} cm, margins "
          f"{sec.left_margin.cm:.2f}/{sec.right_margin.cm:.2f}/{sec.top_margin.cm:.2f}/"
          f"{sec.bottom_margin.cm:.2f} cm")


if __name__ == "__main__":
    if "--verify-only" not in sys.argv:
        build()
    verify()
