"""Prepare the supplied Wobbleheads SVG collection for the web app."""
from pathlib import Path
import json
import re
import shutil
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "site" / "public" / "images"
LAYERS = ("Background", "Face", "Hair", "Eyes", "Nose", "Mouth", "Extra")
SOURCES = (1, 6, 17, 204, 317, 445, 1031, 1240, 1367, 1870, 2327, 3094)
SOURCE_TRAITS = {
    "Background": {1: "Sage", 6: "Dusty Rose", 17: "Sage", 204: "Sand", 317: "Dusty Rose", 445: "Plum", 1031: "Sand", 1240: "Slate Blue", 1367: "Sand", 1870: "Plum", 2327: "Sage", 3094: "Sand"},
    "Face": {1: "Light Tan", 6: "Olive", 17: "Tan", 204: "Deep Brown", 317: "Light Tan", 445: "Tan", 1031: "Brown", 1240: "Golden", 1367: "Deep Brown", 1870: "Tan", 2327: "Deep Brown", 3094: "Olive"},
    "Hair": {1: "Bald", 6: "Curly", 17: "Mohawk", 204: "Curly", 317: "Mohawk", 445: "Bald", 1031: "Flame Crown", 1240: "Beanie", 1367: "Mohawk", 1870: "Side Part", 2327: "Beanie", 3094: "Short"},
    "Eyes": {1: "Wide", 6: "Wide", 17: "Laser Eyes", 204: "Round Glasses", 317: "Wide", 445: "Round Glasses", 1031: "Square Glasses", 1240: "Round Glasses", 1367: "Monocle", 1870: "Monocle", 2327: "Sleepy", 3094: "Sleepy"},
    "Nose": {1: "Curve", 6: "Button", 17: "Curve", 204: "Dot", 317: "Dot", 445: "Curve", 1031: "Dot", 1240: "Curve", 1367: "Dot", 1870: "Line", 2327: "Dot", 3094: "Button"},
    "Mouth": {1: "Smile", 6: "Smile", 17: "Open", 204: "Smirk", 317: "Smirk", 445: "Flat", 1031: "Flat", 1240: "Smirk", 1367: "Flat", 1870: "Smirk", 2327: "Flat", 3094: "Smile"},
    "Extra": {1: "Dimple", 6: "Bowtie", 17: "Freckles", 204: "None", 445: "Mustache", 1031: "Dimple", 1240: "Eyepatch", 1367: "Freckles", 1870: "Eyepatch", 3094: "Headphones"},
}
NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    originals = sorted((ROOT / "images").glob("piece-*.svg"))
    collection = []
    by_id = {}
    for source in originals:
        match = re.fullmatch(r"piece-(\d{4})-(common|uncommon|rare|legendary)\.svg", source.name)
        if not match:
            continue
        item = {"id": int(match.group(1)), "rarity": match.group(2), "file": source.name}
        collection.append(item)
        by_id[item["id"]] = source
        shutil.copyfile(source, OUT / source.name)

    trait_dir = OUT / "traits"
    trait_dir.mkdir(exist_ok=True)
    challenge_dir = OUT / "challenges"
    challenge_dir.mkdir(exist_ok=True)
    traits = {layer: [] for layer in LAYERS}
    for source_id in SOURCES:
        source = by_id[source_id]
        shutil.copyfile(source, challenge_dir / f"challenge-{source_id:04d}.svg")
        root = ET.parse(source).getroot()
        defs = root.find(f"{{{NS}}}defs")
        for layer in LAYERS:
            group = next((node for node in root if node.tag == f"{{{NS}}}g" and node.get("id") == layer), None)
            if group is None:
                continue
            layered = ET.Element(f"{{{NS}}}svg", {"viewBox": "0 0 160 160", "width": "600", "height": "600"})
            if defs is not None:
                layered.append(ET.fromstring(ET.tostring(defs)))
            layered.append(ET.fromstring(ET.tostring(group)))
            filename = f"{layer.lower()}-{source_id:04d}.svg"
            ET.ElementTree(layered).write(trait_dir / filename, encoding="unicode", xml_declaration=True)
            traits[layer].append({"id": source_id, "file": f"/images/traits/{filename}", "label": SOURCE_TRAITS[layer][source_id]})

    (ROOT / "site" / "public" / "collection.json").write_text(json.dumps(collection, separators=(",", ":")))
    (ROOT / "site" / "app" / "trait-options.json").write_text(json.dumps(traits, separators=(",", ":")))
    print(f"Prepared {len(collection)} originals and {sum(map(len, traits.values()))} trait layers")


if __name__ == "__main__":
    main()
