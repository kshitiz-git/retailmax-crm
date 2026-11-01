"""Fill HCL's Project_Synopsis_Template.docx for RetailMax CRM (project 27).

Content comes from docs/SYNOPSIS.md (section by section, parsed so the numbers are never retyped).
The template is copied, never modified. HCL's formatting (Arial, purple Heading 2, header table,
footer line) is kept; only the orange italic instruction paragraphs are replaced.

Learner fields (name, roll number, college, mentor, date) and the signature stay as [FILL IN] / blank.

Run:  .venv\\Scripts\\python.exe docs\\build\\fill_synopsis.py
Output: submission/Project_Synopsis_[YourName]_[RollNo].docx   (literal brackets; the learner renames it)
Needs docs/figures/arch/dfd_level0.png and block_diagram.png (run make_diagrams.py first).
"""
from __future__ import annotations

import re
import shutil
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from docx.text.paragraph import Paragraph

ROOT = Path(__file__).resolve().parents[2]
# HCL's documents are kept out of the public repo; put a copy of the template in docs/hcl/.
TEMPLATE = ROOT / "docs" / "hcl" / "Project_Synopsis_Template.docx"
SYNOPSIS_MD = ROOT / "docs" / "SYNOPSIS.md"
FIG = ROOT / "docs" / "figures" / "arch"
OUT = ROOT / "submission" / "Project_Synopsis_[YourName]_[RollNo].docx"

DEMO_URL = "https://kshitiz-git.github.io/retailmax-crm/"
REPO_URL = "https://github.com/kshitiz-git/retailmax-crm"
JMLR_URL = "https://jmlr.org/papers/v12/pedregosa11a.html"

FONT = "Arial"
SIZE = 10


# --------------------------------------------------------------------------- markdown source
def read_sections() -> dict[str, list[str]]:
    """Split SYNOPSIS.md into {heading text: lines}. The leading block is stored under ''."""
    sections: dict[str, list[str]] = {"": []}
    cur = ""
    in_code = False
    for line in SYNOPSIS_MD.read_text(encoding="utf-8").splitlines():
        if line.startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        if line.startswith("## "):
            cur = line[3:].strip()
            sections[cur] = []
        else:
            sections[cur].append(line)
    return sections


def paragraphs_of(lines: list[str]) -> list[str]:
    """Blank-line separated prose paragraphs, dropping the [FILL IN ...] note lines."""
    out, buf = [], []
    for ln in lines + [""]:
        if ln.lstrip().startswith("|"):
            continue  # markdown table rows are handled by table_rows()
        if ln.strip():
            buf.append(ln.strip())
        elif buf:
            out.append(" ".join(buf))
            buf = []
    return [p for p in out if not p.startswith("*[FILL IN")]


def table_rows(lines: list[str]) -> list[list[str]]:
    rows = []
    for ln in lines:
        if ln.startswith("|") and not re.match(r"^\|\s*-", ln):
            cells = [c.strip() for c in ln.strip().strip("|").split("|")]
            rows.append(cells)
    return rows[1:]  # drop the header row


def bullets_of(lines: list[str]) -> list[str]:
    return [ln[2:].strip() for ln in lines if ln.startswith("- ")]


def numbered_of(lines: list[str]) -> list[str]:
    return [re.sub(r"^\d+\.\s*", "", ln).strip() for ln in lines if re.match(r"^\d+\.\s", ln)]


# --------------------------------------------------------------------------- docx helpers
def style_run(run, bold=False, italic=False, size=SIZE, color: str | None = None, font=FONT):
    run.font.name = font
    run.font.size = Pt(size)
    if bold:
        run.bold = True
    if italic:
        run.italic = True
    if color:
        run.font.color.rgb = RGBColor.from_string(color)


TOKEN = re.compile(r"(\*\*.+?\*\*|`[^`]+`|\*[^*]+?\*)")


def rich(par: Paragraph, text: str, size=SIZE, base_bold=False, base_italic=False):
    """Add text to a paragraph, honouring **bold**, *italic* and `code` from the markdown source."""
    for tok in TOKEN.split(text):
        if not tok:
            continue
        if tok.startswith("**") and tok.endswith("**"):
            style_run(par.add_run(tok[2:-2]), bold=True, italic=base_italic, size=size)
        elif tok.startswith("`") and tok.endswith("`"):
            style_run(par.add_run(tok[1:-1]), bold=base_bold, italic=base_italic, size=size)
        elif tok.startswith("*") and tok.endswith("*") and len(tok) > 2:
            style_run(par.add_run(tok[1:-1]), bold=base_bold, italic=True, size=size)
        else:
            style_run(par.add_run(tok), bold=base_bold, italic=base_italic, size=size)


def add_hyperlink(par: Paragraph, url: str, text: str | None = None, size=SIZE):
    r_id = par.part.relate_to(url, RT.HYPERLINK, is_external=True)
    link = OxmlElement("w:hyperlink")
    link.set(qn("r:id"), r_id)
    run = OxmlElement("w:r")
    rpr = OxmlElement("w:rPr")
    fonts = OxmlElement("w:rFonts")
    fonts.set(qn("w:ascii"), FONT)
    fonts.set(qn("w:hAnsi"), FONT)
    rpr.append(fonts)
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "0563C1")
    rpr.append(color)
    sz = OxmlElement("w:sz")
    sz.set(qn("w:val"), str(size * 2))
    rpr.append(sz)
    u = OxmlElement("w:u")
    u.set(qn("w:val"), "single")
    rpr.append(u)
    run.append(rpr)
    t = OxmlElement("w:t")
    t.text = text or url
    run.append(t)
    link.append(run)
    par._p.append(link)


class Section:
    """Fills the template's instruction paragraph, then inserts further paragraphs after it."""

    def __init__(self, heading: Paragraph):
        nxt = heading._p.getnext()
        assert nxt is not None and nxt.tag == qn("w:p"), "expected the instruction paragraph after the heading"
        self.cur = Paragraph(nxt, heading._parent)
        for r in self.cur._p.findall(qn("w:r")):
            self.cur._p.remove(r)
        self.used = False

    def para(self, after=4, hanging: float | None = None, keep_next=False, align=None, before=0) -> Paragraph:
        if not self.used:
            p = self.cur
            self.used = True
        else:
            new = OxmlElement("w:p")
            self.cur._p.addnext(new)
            p = Paragraph(new, self.cur._parent)
            self.cur = p
        pf = p.paragraph_format
        pf.space_before = Pt(before)
        pf.space_after = Pt(after)
        pf.keep_with_next = keep_next or None
        if hanging:
            pf.left_indent = Inches(hanging)
            pf.first_line_indent = Inches(-hanging)
            pf.tab_stops.add_tab_stop(Inches(hanging))
        if align is not None:
            p.alignment = align
        return p

    def finish(self):
        self.cur.paragraph_format.space_after = Pt(8)


def find_heading(doc: Document, prefix: str) -> Paragraph:
    for p in doc.paragraphs:
        if p.style.name == "Heading 2" and p.text.startswith(prefix):
            return p
    raise KeyError(prefix)


# --------------------------------------------------------------------------- build
def main():
    secs = read_sections()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(TEMPLATE, OUT)
    doc = Document(OUT)

    # ---- 1. Problem statement (5W1H, one paragraph per W, text verbatim from SYNOPSIS.md)
    s = Section(find_heading(doc, "1. Problem Statement"))
    text = " ".join(paragraphs_of(secs["1. Problem Statement"]))
    parts = re.split(r"(?=\*\*(?:Who|What|When / where|Why it matters|How):\*\*)", text)
    for part in [p.strip() for p in parts if p.strip()]:
        rich(s.para(after=3), part)
    s.finish()

    # ---- 2. Proposed solution
    s = Section(find_heading(doc, "2. Proposed Solution"))
    for ptxt in paragraphs_of(secs["2. Proposed Solution and Approach"]):
        rich(s.para(after=6), ptxt)
    p = s.para(after=2)
    style_run(p.add_run("Live demo: "), bold=True)
    add_hyperlink(p, DEMO_URL)
    p = s.para(after=2)
    style_run(p.add_run("GitHub repository: "), bold=True)
    add_hyperlink(p, REPO_URL)
    s.finish()

    # ---- 3. System architecture (two figures)
    s = Section(find_heading(doc, "3. System Architecture"))
    def figure(path: Path, width_in: float, caption: str):
        p = s.para(after=2, keep_next=True, align=WD_ALIGN_PARAGRAPH.CENTER, before=4)
        p.add_run().add_picture(str(path), width=Inches(width_in))
        c = s.para(after=8, align=WD_ALIGN_PARAGRAPH.CENTER)
        style_run(c.add_run(caption), italic=True, size=9, color="404040")

    figure(FIG / "dfd_level0.png", 5.6, "Figure 1: Data flow diagram, level 0 (RetailMax CRM and its three external entities).")
    figure(FIG / "block_diagram.png", 5.9, "Figure 2: System block diagram (offline Python pipeline and the static browser app).")
    s.finish()

    # ---- 4. Technology stack (label, tab, value; wrapped lines align under the value)
    s = Section(find_heading(doc, "4. Technology Stack"))
    rows4 = table_rows(secs["4. Technology Stack"])
    for i, (layer, tech) in enumerate(rows4):
        p = s.para(after=3, hanging=1.55, keep_next=i < len(rows4) - 1)   # keep the block on one page
        style_run(p.add_run(layer + ":\t"), bold=True)
        rich(p, tech)
    s.finish()

    # ---- 5. Dataset used
    s = Section(find_heading(doc, "5. Dataset Used"))
    labels = {"Key columns": "Key columns (list 5)", "Any additional data collected": "Any additional data collected"}
    for item, detail in table_rows(secs["5. Dataset Used"]):
        p = s.para(after=3, hanging=2.1)
        style_run(p.add_run(labels.get(item, item) + ":\t"), bold=True)
        rich(p, detail)
    for ptxt in paragraphs_of(secs["5. Dataset Used"]):
        rich(s.para(after=3, before=3), ptxt)
    s.finish()

    # ---- 6. Key results and metrics
    s = Section(find_heading(doc, "6. Key Results"))
    lines = secs["6. Key Results and Metrics"]
    for ptxt in paragraphs_of([ln for ln in lines if not ln.startswith("- ")]):
        rich(s.para(after=4), ptxt, base_italic=False)
    for b in bullets_of(lines):
        rich(s.para(after=3), b)
    s.finish()

    # ---- 7. Challenges
    s = Section(find_heading(doc, "7. Challenges"))
    for b in bullets_of(secs["7. Challenges Faced and How Resolved"]):
        m = re.match(r"\*\*(Challenge \d+):\*\*\s*(.*?)\s*\*\*Resolution:\*\*\s*(.*)$", b)
        assert m, b
        p = s.para(after=5)
        style_run(p.add_run(m.group(1) + ": "), bold=True)
        rich(p, m.group(2))
        p.add_run().add_break()
        style_run(p.add_run("\u2192 Resolution: "), bold=True)
        rich(p, m.group(3))
    s.finish()

    # ---- 8. References
    s = Section(find_heading(doc, "8. References"))
    for i, ref in enumerate(numbered_of(secs["8. References"]), 1):
        p = s.para(after=3, hanging=0.3)
        style_run(p.add_run(f"{i}.\t"))
        rich(p, ref)
        if "Scikit-learn" in ref:
            p.add_run(" ")
            add_hyperlink(p, JMLR_URL)
    s.finish()

    # ---- 9. Ethical compliance declaration: tick the four boxes (learner signs below)
    decl = doc.paragraphs[[q.text.startswith("I confirm that:") for q in doc.paragraphs].index(True)]
    ticked = 0
    for t in decl._p.iter(qn("w:t")):
        if "\u2610" in t.text:
            t.text = t.text.replace("\u2610", "\u2611")
            ticked += 1
        if t.text.strip().startswith("\u2611  AI tools used"):
            t.text = t.text.rstrip().rstrip(".") + " (Claude by Anthropic)."
    assert ticked == 4, ticked

    doc.save(OUT)
    print("saved", OUT)


if __name__ == "__main__":
    main()
