"""Render the three architecture diagrams of docs/PROJECT_REPORT.md section 9 as PNG files.

Source of truth: the mermaid blocks in section 9.1 (DFD level 0), 9.2 (DFD level 1) and
9.3 (block diagram). Node names and edge labels are copied from there. Graphviz is not
installed, so the layout is drawn by hand with matplotlib.

Run:  .venv\\Scripts\\python.exe docs\\build\\make_diagrams.py
Output: docs/figures/arch/dfd_level0.png, dfd_level1.png, block_diagram.png

Every diagram runs a layout check after drawing: no label may overlap another label, a
node box, or any arrow line, and node text must stay inside its box.
"""
from __future__ import annotations

import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib import font_manager
from matplotlib.patches import Circle, Ellipse, FancyArrowPatch, FancyBboxPatch, Rectangle

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "figures" / "arch"
DPI = 200

_names = {f.name for f in font_manager.fontManager.ttflist}
FONT = "Arial" if "Arial" in _names else "DejaVu Sans"
plt.rcParams["font.family"] = FONT

INK = "#222222"
LINE = "#333333"
ENT_FILL, ENT_EDGE = "#F2F2F2", "#444444"
PROC_FILL, PROC_EDGE = "#EDE3F7", "#5B2A86"
STORE_FILL, STORE_EDGE = "#FFF6DC", "#8A6A00"
GROUP_EDGE = "#7A7A7A"
HEAD_GREY = "#666666"


class Diagram:
    def __init__(self, width: float, height: float):
        self.w, self.h = width, height
        self.fig = plt.figure(figsize=(width, height), dpi=DPI, facecolor="white")
        self.ax = self.fig.add_axes([0, 0, 1, 1])
        self.ax.set_xlim(0, width)
        self.ax.set_ylim(0, height)
        self.ax.set_aspect("equal")
        self.ax.axis("off")
        self.boxes: list[tuple[str, tuple[float, float, float, float]]] = []  # name, x0,y0,x1,y1
        self.node_texts: list[tuple[str, object, str]] = []  # owner, text artist, ...
        self.label_texts: list[tuple[str, object]] = []
        self.segments: list[tuple[str, tuple[float, float], tuple[float, float]]] = []
        self.circles: dict[str, tuple[float, float, float]] = {}

    # ------------------------------------------------------------------ nodes
    def _text_block(self, owner, cx, cy, lines, box):
        """lines: list of (text, size, weight, style, colour). Stacked and centred on (cx, cy)."""
        gaps = [s / 72 * 1.28 for (_, s, *_rest) in lines]  # inches per line
        total = sum(gaps)
        y = cy + total / 2
        for (txt, size, weight, style, colour), g in zip(lines, gaps):
            y -= g / 2
            t = self.ax.text(cx, y, txt, ha="center", va="center", fontsize=size,
                             fontweight=weight, fontstyle=style, color=colour, zorder=6)
            self.node_texts.append((owner, t, box))
            y -= g / 2

    def entity(self, name, cx, cy, w, h, lines):
        x0, y0 = cx - w / 2, cy - h / 2
        self.ax.add_patch(Rectangle((x0, y0), w, h, fc=ENT_FILL, ec=ENT_EDGE, lw=1.8, zorder=3))
        self.boxes.append((name, (x0, y0, x0 + w, y0 + h)))
        self._text_block(name, cx, cy, lines, (x0, y0, x0 + w, y0 + h))

    def process_box(self, name, cx, cy, w, h, lines):
        x0, y0 = cx - w / 2, cy - h / 2
        self.ax.add_patch(FancyBboxPatch((x0 + 0.08, y0 + 0.08), w - 0.16, h - 0.16,
                                         boxstyle="round,pad=0.08,rounding_size=0.18",
                                         fc=PROC_FILL, ec=PROC_EDGE, lw=1.8, zorder=3))
        self.boxes.append((name, (x0, y0, x0 + w, y0 + h)))
        self._text_block(name, cx, cy, lines, (x0, y0, x0 + w, y0 + h))

    def process_circle(self, name, cx, cy, r, lines):
        self.ax.add_patch(Circle((cx, cy), r, fc=PROC_FILL, ec=PROC_EDGE, lw=2.2, zorder=3))
        self.boxes.append((name, (cx - r, cy - r, cx + r, cy + r)))
        self.circles[name] = (cx, cy, r)
        self._text_block(name, cx, cy, lines, (cx - r * 0.82, cy - r * 0.82, cx + r * 0.82, cy + r * 0.82))

    def store(self, name, cx, cy, w, h, ident, lines, id_w=0.55):
        """Open-ended data store: closed on the left, open on the right, ID cell on the left."""
        x0, y0 = cx - w / 2, cy - h / 2
        x1, y1 = x0 + w, y0 + h
        self.ax.add_patch(Rectangle((x0, y0), w, h, fc=STORE_FILL, ec="none", zorder=3))
        for (a, b, c, d) in [(x0, y1, x1, y1), (x0, y0, x1, y0), (x0, y0, x0, y1), (x0 + id_w, y0, x0 + id_w, y1)]:
            self.ax.plot([a, c], [b, d], color=STORE_EDGE, lw=1.8, solid_capstyle="butt", zorder=4)
        self.boxes.append((name, (x0, y0, x1, y1)))
        self._text_block(name + ".id", x0 + id_w / 2, cy, [(ident, 11, "bold", "normal", INK)],
                         (x0, y0, x0 + id_w, y1))
        self._text_block(name, x0 + id_w + (w - id_w) / 2, cy, lines, (x0 + id_w, y0, x1, y1))

    def cylinder(self, name, cx, cy, w, h, lines):
        x0, y0 = cx - w / 2, cy - h / 2
        cap = 0.17
        t = np.linspace(np.pi, 2 * np.pi, 60)
        bx, by = cx + (w / 2) * np.cos(t), (y0 + cap) + cap * np.sin(t)       # front half of the bottom ellipse
        poly = np.column_stack([np.r_[x0, bx, x0 + w], np.r_[y0 + h - cap, by, y0 + h - cap]])
        self.ax.add_patch(plt.Polygon(poly, closed=True, fc=STORE_FILL, ec="none", zorder=3))
        self.ax.plot(bx, by, color=STORE_EDGE, lw=1.8, zorder=4)
        self.ax.plot([x0, x0], [y0 + cap, y0 + h - cap], color=STORE_EDGE, lw=1.8, zorder=4)
        self.ax.plot([x0 + w, x0 + w], [y0 + cap, y0 + h - cap], color=STORE_EDGE, lw=1.8, zorder=4)
        self.ax.add_patch(Ellipse((cx, y0 + h - cap), w, 2 * cap, fc="#FFFBEE", ec=STORE_EDGE, lw=1.8, zorder=4))
        self.boxes.append((name, (x0, y0, x0 + w, y0 + h)))
        self._text_block(name, cx, y0 + (cap + h - 2 * cap) / 2, lines, (x0, y0 + cap, x0 + w, y0 + h - 2 * cap))

    def group(self, name, x0, y0, x1, y1, title):
        self.ax.add_patch(FancyBboxPatch((x0, y0), x1 - x0, y1 - y0, boxstyle="round,pad=0,rounding_size=0.15",
                                         fc="#FAFAFA", ec=GROUP_EDGE, lw=1.5, ls=(0, (5, 3)), zorder=1))
        t = self.ax.text(x0 + 0.18, y1 - 0.14, title, ha="left", va="top", fontsize=11, fontweight="bold",
                         color="#444444", zorder=6)
        self.label_texts.append((name + ".title", t))

    # ------------------------------------------------------------------ edges
    def arrow(self, owner, pts, both=False, lw=1.7, z=2.0):
        """Polyline with an arrow head on the last segment (and on the first when both)."""
        xs, ys = zip(*pts)
        self.ax.plot(xs, ys, color=LINE, lw=lw, solid_capstyle="butt", solid_joinstyle="miter", zorder=z)

        def head(tail, tip):
            # short stub so the head patch does not repaint the whole segment (keeps line jumps visible)
            dx, dy = tip[0] - tail[0], tip[1] - tail[1]
            n = float(np.hypot(dx, dy))
            k = min(0.22, n) / n
            start = (tip[0] - dx * k, tip[1] - dy * k)
            self.ax.add_patch(FancyArrowPatch(start, tip, arrowstyle="-|>", mutation_scale=17, lw=lw,
                                              color=LINE, shrinkA=0, shrinkB=0, zorder=5))

        head(pts[-2], pts[-1])
        if both:
            head(pts[1], pts[0])
        for a_, b_ in zip(pts[:-1], pts[1:]):
            self.segments.append((owner, a_, b_))

    def bridge(self, x, y, vertical_under=True):
        """Break the line that runs underneath at a crossing: white patch under the over-line."""
        if vertical_under:
            self.ax.add_patch(Rectangle((x - 0.06, y - 0.075), 0.12, 0.15, fc="white", ec="none", zorder=2.3))
        else:
            self.ax.add_patch(Rectangle((x - 0.075, y - 0.06), 0.15, 0.12, fc="white", ec="none", zorder=2.3))

    def label(self, owner, x, y, text, ha="center", va="center", size=10, style="normal", weight="normal",
              color=INK):
        t = self.ax.text(x, y, text, ha=ha, va=va, fontsize=size, fontstyle=style, fontweight=weight,
                         color=color, zorder=7, linespacing=1.18)
        self.label_texts.append((owner, t))
        return t

    # ------------------------------------------------------------------ checks
    def _bbox(self, t):
        r = self.fig.canvas.get_renderer()
        bb = t.get_window_extent(r)
        inv = self.ax.transData.inverted()
        (x0, y0), (x1, y1) = inv.transform((bb.x0, bb.y0)), inv.transform((bb.x1, bb.y1))
        return x0, y0, x1, y1

    @staticmethod
    def _rect_hit(a, b, pad=0.0):
        return not (a[2] + pad <= b[0] or b[2] + pad <= a[0] or a[3] + pad <= b[1] or b[3] + pad <= a[1])

    @staticmethod
    def _seg_hits_rect(p, q, r, pad=0.03):
        x0, y0, x1, y1 = r[0] - pad, r[1] - pad, r[2] + pad, r[3] + pad
        # Liang-Barsky
        dx, dy = q[0] - p[0], q[1] - p[1]
        t0, t1 = 0.0, 1.0
        for pp, qq in ((-dx, p[0] - x0), (dx, x1 - p[0]), (-dy, p[1] - y0), (dy, y1 - p[1])):
            if pp == 0:
                if qq < 0:
                    return False
            else:
                t = qq / pp
                if pp < 0:
                    t0 = max(t0, t)
                else:
                    t1 = min(t1, t)
        return t0 <= t1

    def check(self, label):
        self.fig.canvas.draw()
        problems = []
        labels = [(o, t, self._bbox(t)) for o, t in self.label_texts]
        for i, (o1, t1, b1) in enumerate(labels):
            for (o2, t2, b2) in labels[i + 1:]:
                if self._rect_hit(b1, b2, pad=0.02):
                    problems.append(f"label/label overlap: {t1.get_text()!r} x {t2.get_text()!r}")
            for (o, seg_a, seg_b) in self.segments:
                if self._seg_hits_rect(seg_a, seg_b, b1):
                    problems.append(f"arrow {o} touches label {t1.get_text()!r}")
            for (name, bx) in self.boxes:
                if name in self.circles:
                    cx, cy, r = self.circles[name]
                    nx, ny = min(max(cx, b1[0]), b1[2]), min(max(cy, b1[1]), b1[3])
                    hit = (nx - cx) ** 2 + (ny - cy) ** 2 < (r + 0.03) ** 2
                else:
                    hit = self._rect_hit(b1, bx, pad=0.0)
                if hit:
                    problems.append(f"label {t1.get_text()!r} overlaps node {name}")
            if b1[0] < 0.03 or b1[1] < 0.03 or b1[2] > self.w - 0.03 or b1[3] > self.h - 0.03:
                problems.append(f"label {t1.get_text()!r} leaves the canvas")
        for owner, t, box in self.node_texts:
            b = self._bbox(t)
            if b[0] < box[0] + 0.04 or b[2] > box[2] - 0.04 or b[1] < box[1] + 0.02 or b[3] > box[3] - 0.02:
                problems.append(f"node text {t.get_text()!r} not inside {owner}")
            for (o, seg_a, seg_b) in self.segments:
                if self._seg_hits_rect(seg_a, seg_b, b, pad=0.0):
                    problems.append(f"arrow {o} crosses node text {t.get_text()!r}")
        print(f"[{label}] layout problems: {len(problems)}")
        for p in problems:
            print("   -", p)
        return problems

    def save(self, path: Path, dpi: int = DPI):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.fig.savefig(path, dpi=dpi, facecolor="white", bbox_inches="tight", pad_inches=0.12)
        plt.close(self.fig)


def L(text, size=10.5, weight="normal", style="normal", color=INK):
    return (text, size, weight, style, color)


def HDR(text="External entity"):
    return L(text, 9.5, "normal", "italic", HEAD_GREY)


# ====================================================================== 9.1 DFD level 0
def dfd_level0():
    d = Diagram(8.9, 5.0)
    sx, sy, r = 5.5, 3.4, 1.2
    d.process_circle("SYS", sx, sy, r, [
        L("0", 12, "bold"), L("RetailMax CRM", 12, "bold"), L("React app in the", 10.5), L("browser", 10.5)])
    d.entity("PIPE", 1.4, sy, 2.4, 1.3, [HDR(), L("Offline Python pipeline", 11, "bold"), L("(pandas, scikit-learn)", 10)])
    d.entity("USER", 5.5, 0.8, 3.2, 1.3, [HDR(), L("CRM user", 11.5, "bold"), L("(marketing or sales manager)", 10)])
    d.entity("CUST", 1.4, 0.8, 2.4, 1.3, [HDR(), L("Customer", 11.5, "bold"), L("(data principal)", 10)])

    # PIPE -> SYS
    d.arrow("PIPE>SYS", [(2.6, sy), (sx - r, sy)])
    d.label("PIPE>SYS", (2.6 + sx - r) / 2, sy + 0.1, "customers.csv,\nchurn-model.json", va="bottom")

    # USER -> SYS  (left vertical)
    xl = sx - 0.7
    yb = sy - np.sqrt(r * r - 0.7 * 0.7)
    d.arrow("USER>SYS", [(xl, 1.45), (xl, yb)])
    d.label("USER>SYS", xl - 0.12, 2.0, "filters, campaign set-up,\npoint adjustments,\nCSV upload, erasure action", ha="right")

    # SYS -> USER  (right vertical)
    xr = sx + 0.7
    d.arrow("SYS>USER", [(xr, yb), (xr, 1.45)])
    d.label("SYS>USER", xr + 0.12, 2.0, "dashboards, segments,\nchurn risk, campaign results,\nCSV export, consent log", ha="left")

    # CUST -> USER
    d.arrow("CUST>USER", [(2.6, 0.8), (3.9, 0.8)])
    d.label("CUST>USER", (2.6 + 3.9) / 2, 0.92, "consent given or\nwithdrawn,\nerasure request", va="bottom")
    d.check("dfd level 0")
    d.save(OUT / "dfd_level0.png", dpi=240)


# ====================================================================== 9.2 DFD level 1
def dfd_level1():
    W, H = 11.8, 8.0
    d = Diagram(W, H)
    pw, ph = 2.3, 1.0
    xa, xb, xc = 2.0, 5.8, 9.9          # three process columns
    yd, yp, yu, yq, yd3 = 7.3, 5.65, 3.7, 2.05, 0.5   # store row, P row, USER row, P4/P5 row, D3 row

    def P(name, cx, cy, num, text):
        d.process_box(name, cx, cy, pw, ph, [L(num, 11.5, "bold")] + [L(t, 10.5) for t in text])

    d.store("D1", xa, yd, 2.9, 0.9, "D1", [L("customers.csv", 10.5, "bold"), L("(read only, ships with the app)", 9.5)])
    d.store("D2", xc, yd, 2.5, 0.9, "D2", [L("churn-model.json", 10.5, "bold"), L("(read only)", 9.5)])
    P("P1", xa, yp, "1", ["Load and validate data"])
    P("P2", xb, yp, "2", ["Derive RFM scores,", "segment and loyalty tier"])
    P("P3", xc, yp, "3", ["Score churn risk"])
    P("P6", xa, yu, "6", ["Manage consent", "and erasure"])
    P("P4", xb, yq, "4", ["Build and run campaigns"])
    P("P5", xc, yq, "5", ["Manage loyalty points"])
    d.entity("USER", xb, yu, 2.3, 0.85, [HDR(), L("CRM user", 11.5, "bold")])
    d.store("D3", 5.7, yd3, 9.8, 0.8, "D3",
            [L("localStorage", 10.5, "bold"), L("consent, points, notes, campaigns, erasures, audit log", 10)], id_w=0.6)

    top, bot = yp + ph / 2, yp - ph / 2          # P row top / bottom
    utop, ubot = yu + 0.425, yu - 0.425

    # D1 -> P1, D2 -> P3 (no labels in the mermaid)
    d.arrow("D1>P1", [(xa, yd - 0.45), (xa, top)])
    d.arrow("D2>P3", [(xc, yd - 0.45), (xc, top)])
    # USER -> P1 "imported CSV"
    d.arrow("USER>P1", [(4.95, utop), (4.95, 4.8), (2.6, 4.8), (2.6, bot)])
    d.label("USER>P1", 3.3, 4.87, "imported CSV", ha="left", va="bottom")
    # P1 -> P2 "valid rows"
    d.arrow("P1>P2", [(xa + pw / 2, yp), (xb - pw / 2, yp)])
    d.label("P1>P2", (xa + xb) / 2, yp + 0.1, "valid rows", va="bottom")
    # P2 -> P3 "customers with R, F, M, tier"
    d.arrow("P2>P3", [(xb + pw / 2, yp), (xc - pw / 2, yp)])
    d.label("P2>P3", (xb + xc) / 2, yp + 0.1, "customers with\nR, F, M, tier", va="bottom")
    # P2 -> USER, P3 -> USER
    d.arrow("P2>USER", [(xb, bot), (xb, utop)])
    d.arrow("P3>USER", [(9.0, bot), (9.0, yu + 0.25), (xb + 1.15, yu + 0.25)])
    # P3 -> P4 "customers with churn risk"
    d.arrow("P3>P4", [(10.6, bot), (10.6, 3.0), (6.45, 3.0), (6.45, yq + 0.5)], z=2.6)
    d.label("P3>P4", 10.5, 4.3, "customers with\nchurn risk", ha="right")
    # USER -> P4 "audience, offer, channel"
    d.arrow("USER>P4", [(5.35, ubot), (5.35, yq + 0.5)])
    d.label("USER>P4", 5.25, 3.0 + 0.0, "audience, offer, channel", ha="right", va="center")
    # D3 -> P2
    d.arrow("D3>P2", [(10.6, yd3), (11.45, yd3), (11.45, 6.55), (xb, 6.55), (xb, top)], z=2.6)
    d.bridge(xc, 6.55)          # D2>P3 passes under D3>P2
    d.bridge(9.55, 3.0)         # USER>P5 passes under P3>P4
    # USER -> P6 "consent changes, erasure"
    d.arrow("USER>P6", [(xb - 1.15, yu), (xa + pw / 2, yu)])
    d.label("USER>P6", (xb - 1.15 + xa + pw / 2) / 2, yu + 0.1, "consent changes,\nerasure", va="bottom")
    # P6 -> P4 "consent flags"
    d.arrow("P6>P4", [(2.7, yu - 0.5), (2.7, yq), (xb - pw / 2, yq)])
    d.label("P6>P4", 3.7, yq + 0.1, "consent flags", va="bottom")
    # P4 -> P5 "simulated results, points awarded"
    d.arrow("P4>P5", [(xb + pw / 2, yq), (xc - pw / 2, yq)])
    d.label("P4>P5", (xb + xc) / 2, yq + 0.1, "simulated results,\npoints awarded", va="bottom")
    # USER -> P5 "manual adjustments"
    d.arrow("USER>P5", [(xb + 1.15, yu - 0.25), (9.55, yu - 0.25), (9.55, yq + 0.5)])
    d.label("USER>P5", 8.25, yu - 0.15, "manual adjustments", va="bottom")
    # P4, P5, P6 -> D3
    d.arrow("P4>D3", [(xb, yq - 0.5), (xb, yd3 + 0.4)])
    d.arrow("P5>D3", [(xc, yq - 0.5), (xc, yd3 + 0.4)])
    d.arrow("P6>D3", [(1.5, yu - 0.5), (1.5, yd3 + 0.4)])
    d.check("dfd level 1")
    d.save(OUT / "dfd_level1.png")


# ====================================================================== 9.3 block diagram
def block_diagram():
    d = Diagram(10.6, 8.6)
    d.group("OFF", 0.2, 5.3, 10.4, 8.4, "Offline pipeline (Python, run on the developer's laptop)")
    bh = 1.05
    yr = 7.1
    d.process_box("A", 1.35, yr, 2.1, bh, [L("dataset_original.csv", 10.5, "bold"), L("500 HCL rows", 10)])
    d.process_box("B", 3.9, yr, 2.1, bh, [L("generate_dataset.py", 10.5, "bold"), L("adds 4,500 rows and", 10), L("labelled faults", 10)])
    d.process_box("C", 6.45, yr, 2.1, bh, [L("clean_dataset.py", 10.5, "bold"), L("13 rules", 10)])
    d.process_box("D", 9.0, yr, 2.3, bh, [L("train_churn_model.py", 10.5, "bold"), L("logistic regression", 10), L("and random forest", 10)])
    d.process_box("E", 3.9, 5.95, 2.1, 0.8, [L("eda.ipynb", 10.5, "bold"), L("11 charts", 10)])
    d.arrow("A>B", [(2.4, yr), (2.85, yr)])
    d.arrow("B>C", [(4.95, yr), (5.4, yr)])
    d.arrow("C>D", [(7.5, yr), (7.85, yr)])
    d.arrow("C>E", [(5.95, yr - bh / 2), (5.95, 5.95), (4.95, 5.95)])

    d.group("BR", 0.2, 0.15, 10.4, 3.9, "")
    d.label("BR.title", 10.22, 3.76, "Browser (static React single-page app, no server)", ha="right", va="top", size=11,
            weight="bold", color="#444444")
    yb = 2.7
    d.process_box("F", 1.9, yb, 2.4, 1.1, [L("Data layer", 10.5, "bold"), L("CSV parser and", 10), L("validator", 10)])
    d.process_box("G", 5.2, yb, 3.2, 1.5, [L("Logic layer, TypeScript", 10.5, "bold"), L("RFM scores, loyalty tiers,", 10),
                                             L("in-browser churn scoring,", 10), L("campaign audience", 10), L("and consent gate", 10)])
    d.process_box("H", 8.85, yb, 2.9, 1.1, [L("Presentation layer", 10.5, "bold"), L("React 19, Tailwind CSS, Recharts", 10),
                                              L("9 screens", 10)])
    d.cylinder("I", 5.2, 0.85, 3.2, 1.3, [L("localStorage", 10.5, "bold"), L("consent, points, notes,", 10),
                                           L("campaigns, erasures, audit log", 10)])
    d.arrow("F>G", [(3.1, yb), (3.6, yb)])
    d.arrow("G>H", [(6.8, yb), (7.4, yb)])
    d.arrow("G<>I", [(5.2, yb - 0.75), (5.2, 1.5)], both=True)

    # pipeline files into the browser app
    d.arrow("C>F", [(6.95, yr - bh / 2), (6.95, 4.9), (1.45, 4.9), (1.45, yb + 0.55)])
    d.label("C>F", 4.2, 4.97, "customers.csv", va="bottom")
    d.arrow("D>F", [(9.0, yr - bh / 2), (9.0, 4.45), (2.6, 4.45), (2.6, yb + 0.55)])
    d.label("D>F", 5.8, 4.38, "churn-model.json", va="top")
    d.check("block")
    d.save(OUT / "block_diagram.png")


if __name__ == "__main__":
    which = sys.argv[1:] or ["l0", "l1", "block"]
    if "l0" in which:
        dfd_level0()
    if "l1" in which:
        dfd_level1()
    if "block" in which:
        block_diagram()
