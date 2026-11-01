"""Build two short companion documents into submission/:

- RetailMax_CRM_Output_Screenshots.docx: every app screenshot with its caption (same captions as
  section 10.1 of the report, taken from build_report_docx.py so the two never drift apart).
- RetailMax_CRM_Source_Code_and_Deployment.docx: repository, live demo, how to run, folder layout.

Run: .venv/Scripts/python docs/build/build_extras.py
"""
from __future__ import annotations

import sys
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Inches, Pt, RGBColor

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_report_docx as R  # noqa: E402  (captions, URLs, paths)

ROOT = R.ROOT
OUT = ROOT / "submission"
TITLE = "RetailMax CRM: Streamlining Customer Relationships"
PROGRAMME = "HCLTech Career Shaper Programme | III Year Industry Project | Project No. 27"
INK = RGBColor(0x1F, 0x29, 0x37)


def new_doc(subtitle: str) -> Document:
    doc = Document()
    s = doc.sections[0]
    s.page_width, s.page_height = Cm(21.0), Cm(29.7)
    for side in ("left_margin", "right_margin", "top_margin", "bottom_margin"):
        setattr(s, side, Cm(2.0))
    st = doc.styles["Normal"]
    st.font.name, st.font.size = "Calibri", Pt(11)
    for name, size in (("Heading 1", 16), ("Heading 2", 13)):
        h = doc.styles[name]
        h.font.name, h.font.size, h.font.color.rgb = "Calibri", Pt(size), INK
    p = doc.add_paragraph()
    r = p.add_run(TITLE)
    r.bold, r.font.size, r.font.color.rgb = True, Pt(18), INK
    doc.add_paragraph(PROGRAMME).runs[0].font.size = Pt(10)
    p = doc.add_paragraph()
    r = p.add_run(subtitle)
    r.bold, r.font.size = True, Pt(13)
    return doc


def screenshots() -> Path:
    doc = new_doc("Output screenshots")
    doc.add_paragraph(
        f"Screens of the working application, taken from the live site {R.DEMO_URL} "
        "at 1440 × 900 (desktop) and 390 px wide (phone)."
    )
    n = 0
    for group, shots in R.SCREENSHOT_GROUPS:
        doc.add_heading(group, level=2)
        for fname, title, caption in shots:
            n += 1
            doc.add_picture(str(R.APP_DIR / fname), width=Inches(6.6))
            doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
            cap = doc.add_paragraph()
            cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = cap.add_run(f"Screenshot {n}: {title}. ")
            run.bold, run.font.size = True, Pt(9.5)
            cap.add_run(caption).font.size = Pt(9.5)
    doc.add_heading("Phone layout", level=2)
    table = doc.add_table(rows=2, cols=len(R.MOBILE_SHOTS))
    for i, (fname, title, caption) in enumerate(R.MOBILE_SHOTS):
        n += 1
        cell = table.cell(0, i)
        cell.paragraphs[0].add_run().add_picture(str(R.APP_DIR / fname), width=Inches(R.MOBILE_W_IN))
        cell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        cp = table.cell(1, i).paragraphs[0]
        cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = cp.add_run(f"Screenshot {n}: {title}. ")
        run.bold, run.font.size = True, Pt(9.5)
        cp.add_run(caption).font.size = Pt(9.5)
    path = OUT / "RetailMax_CRM_Output_Screenshots.docx"
    doc.save(path)
    print(f"saved {path} ({n} screenshots)")
    return path


def source_code() -> Path:
    doc = new_doc("Source code and deployment")
    rows = [
        ("Source code (GitHub)", R.REPO_URL),
        ("Live application", R.DEMO_URL),
        ("Hosting", "GitHub Pages, built and deployed by GitHub Actions (.github/workflows/deploy.yml) on every push to main"),
        ("Front end", "React 19, TypeScript, Vite, Tailwind CSS, Recharts, React Router"),
        ("Data and ML", "Python, pandas, scikit-learn, matplotlib, seaborn, Jupyter"),
        ("Server / database", "None. Data ships with the app as a CSV file; changes are kept in the browser (localStorage)"),
    ]
    t = doc.add_table(rows=0, cols=2)
    t.style = "Table Grid"
    for k, v in rows:
        c = t.add_row().cells
        c[0].text, c[1].text = k, v
        c[0].paragraphs[0].runs[0].bold = True
        c[0].width, c[1].width = Cm(4.5), Cm(12.5)

    def code(lines: list[str]) -> None:
        for line in lines:
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(line)
            r.font.name, r.font.size = "Consolas", Pt(9.5)
        doc.add_paragraph()

    doc.add_heading("Run the application", level=2)
    doc.add_paragraph("Requires Node.js 20 or newer.")
    code(["git clone " + R.REPO_URL + ".git", "cd retailmax-crm", "npm install",
          "npm run dev        # http://localhost:5190", "npm run build      # type-check and production build into dist/"])
    doc.add_heading("Rerun the data and model pipeline", level=2)
    doc.add_paragraph("Tested with Python 3.13.")
    code(["python -m venv .venv", ".venv/Scripts/python -m pip install -r analysis/requirements.txt",
          ".venv/Scripts/python analysis/generate_dataset.py",
          ".venv/Scripts/python analysis/clean_dataset.py",
          ".venv/Scripts/python analysis/train_churn_model.py"])
    doc.add_heading("Repository layout", level=2)
    code([
        "retailmax-crm/",
        "├── src/                 React app: pages, components, data layer, churn scorer",
        "│   └── data/            customers.csv (cleaned dataset) and churn-model.json",
        "├── analysis/            Python: dataset generation, cleaning, model training, EDA notebook",
        "├── data/                original, combined and cleaned datasets, data dictionary, cleaning report",
        "├── docs/                project report, synopsis, figures, screenshots, demo script",
        "└── .github/workflows/   build and deploy to GitHub Pages",
    ])
    path = OUT / "RetailMax_CRM_Source_Code_and_Deployment.docx"
    doc.save(path)
    print(f"saved {path}")
    return path


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    screenshots()
    source_code()
