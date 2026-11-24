#!/usr/bin/env python3
"""AZ herfleri (ə,ş,ç,ğ,ı,İ,ö,ü) ucun Google Fonts coverage yoxlamasi."""
import re
import subprocess
import sys

# Legacy UA -> Google Fonts API TTF qaytarir
CSS_UA = "Mozilla/5.0 (Windows NT 6.1; WOW64)"

FAMILIES = {
    "Inter": "Inter:wght@400",
    "Noto Sans": "Noto+Sans:wght@400",
    "Manrope": "Manrope:wght@400",
    "Poppins": "Poppins:wght@400",
    "Montserrat": "Montserrat:wght@400",
    "Rubik": "Rubik:wght@400",
    "Roboto": "Roboto:wght@400",
    "Open Sans": "Open+Sans:wght@400",
}

# yoxlanacaq AZ herfleri: B→b, kicik→boyuk
AZ_CHARS = {
    0x018F: "Ə", 0x0259: "ə",
    0x015E: "Ş", 0x015F: "ş",
    0x00C7: "Ç", 0x00E7: "ç",
    0x011E: "Ğ", 0x011F: "ğ",
    0x0130: "İ", 0x0131: "ı",
    0x00D6: "Ö", 0x00F6: "ö",
    0x00DC: "Ü", 0x00FC: "ü",
}


def get_ttf_url(family_q):
    css = subprocess.run(
        ["curl", "-s", "--max-time", "20", "-A", CSS_UA,
         f"https://fonts.googleapis.com/css2?family={family_q}&display=swap"],
        capture_output=True, text=True).stdout
    m = re.search(r"url\((https://[^)]+\.ttf)\)", css)
    return m.group(1) if m else None


def check(path):
    from fontTools.ttLib import TTFont
    font = TTFont(path)
    cmap = font.getBestCmap()
    return {cp: (cp in cmap) for cp in AZ_CHARS}


def main():
    ok_all = []
    for name, q in FAMILIES.items():
        url = get_ttf_url(q)
        if not url:
            print(f"{name:12s} : TTF URL tapilmadi")
            continue
        path = f"/tmp/fonts/{name.replace(' ', '')}.ttf"
        subprocess.run(["curl", "-sL", "--max-time", "40", "-o", path, url])
        try:
            res = check(path)
        except Exception as e:
            print(f"{name:12s} : PARSE XETASI {e}")
            continue
        missing = [lbl for cp, lbl in AZ_CHARS.items() if not res[cp]]
        status = "TAM DƏSTƏK" if not missing else "ƏSKİK: " + ",".join(missing)
        print(f"{name:12s} : {status}")
        if not missing:
            ok_all.append(name)
    print("\nTam dəstəkləyənlər:", ", ".join(ok_all) if ok_all else "yoxdur")
    return 0


if __name__ == "__main__":
    sys.exit(main())
