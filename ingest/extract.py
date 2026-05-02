"""Extract usable text from a paper. Try PDF first, fall back to abstract."""
from __future__ import annotations
import io
import logging
import re
import httpx
from pypdf import PdfReader

log = logging.getLogger("girigo.extract")

UA = "girigo-research/0.1 (research; mailto:opqrttuj@gmail.com)"


def extract_text(paper: dict, max_pdf_bytes: int = 12_000_000) -> tuple[str, str]:
    """Return (text, source_kind) where source_kind ∈ {"pdf", "abstract", "empty"}.

    Tries the open-access PDF first; falls back to the abstract if PDF
    download or parsing fails.
    """
    pdf_url = paper.get("pdf_url")
    if pdf_url:
        try:
            with httpx.Client(timeout=45, follow_redirects=True, headers={"User-Agent": UA}) as cli:
                r = cli.get(pdf_url)
                if r.status_code == 200 and r.content[:4] == b"%PDF":
                    if len(r.content) > max_pdf_bytes:
                        log.info(f"  pdf too large ({len(r.content)//1_000_000} MB), skip → abstract")
                    else:
                        text = _pdf_to_text(r.content)
                        if text and len(text) > 800:
                            return text, "pdf"
        except Exception as e:
            log.debug(f"  pdf fail {pdf_url}: {e}")

    abstract = paper.get("abstract")
    if abstract and len(abstract) > 100:
        return abstract.strip(), "abstract"

    return "", "empty"


def _pdf_to_text(pdf_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages: list[str] = []
        for page in reader.pages:
            try:
                t = page.extract_text() or ""
                pages.append(t)
            except Exception:
                continue
        text = "\n".join(pages)
    except Exception as e:
        log.debug(f"  pdf parse fail: {e}")
        return ""

    # Cleanup: collapse whitespace, drop ultra-short lines (page headers/footers)
    lines = [ln.strip() for ln in text.splitlines()]
    cleaned: list[str] = []
    for ln in lines:
        if not ln:
            cleaned.append("")
            continue
        if len(ln) < 4:
            continue
        # Skip pure page numbers
        if re.fullmatch(r"\d+", ln):
            continue
        cleaned.append(ln)
    out = "\n".join(cleaned)
    out = re.sub(r"\n{3,}", "\n\n", out)
    out = re.sub(r"[ \t]+", " ", out)
    # Heuristically truncate references section
    m = re.search(r"\n(?:References|REFERENCES|Bibliography)\b", out)
    if m and m.start() > 2000:
        out = out[: m.start()]
    return out.strip()
