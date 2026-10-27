#!/usr/bin/env python3
"""Validate and export a Mealbook recipe-bank JSON using only the Python stdlib.

The tool is read-only in --validate mode. In export mode it writes JSON, CSV,
and SQLite artifacts to an explicit output directory. It preserves missing source
facts as null/blank rather than calculating nutrition or quantities.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
import shutil
import sqlite3
import sys
import tempfile
from typing import Any

TOOL_VERSION = "1.0"
MACROS = ("calories", "protein", "carbs", "fat", "fiber", "sugar", "sodium")
NUTRITION_BASES = {"per_serving", "per_recipe", "unspecified", "not_stated"}


class BankValidationError(ValueError):
    """Raised when a bank cannot be faithfully exported."""


def positive_or_zero(raw: str) -> int:
    value = int(raw)
    if value < 0:
        raise argparse.ArgumentTypeError("must be zero or greater")
    return value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate/export a Mealbook recipe bank without network access.")
    parser.add_argument("--input", required=True, type=Path, help="Recipe-bank JSON input path.")
    parser.add_argument("--output-dir", type=Path, help="New directory for JSON/CSV/SQLite output (required unless --validate).")
    parser.add_argument("--expected-count", type=positive_or_zero, default=119, help="Expected recipe count; set 0 to skip count enforcement (default: 119).")
    parser.add_argument("--validate", action="store_true", help="Read and validate only; does not write files.")
    parser.add_argument("--overwrite", action="store_true", help="Replace an existing output directory after a successful export.")
    return parser.parse_args()


def read_bank(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise BankValidationError(f"Input does not exist: {path}") from error
    except UnicodeDecodeError as error:
        raise BankValidationError(f"Input is not UTF-8 text: {path}") from error
    except json.JSONDecodeError as error:
        raise BankValidationError(f"Input is not valid JSON: {path}: {error.msg}") from error
    if not isinstance(value, dict):
        raise BankValidationError("Bank root must be a JSON object")
    return value


def nullable_number(value: Any, label: str) -> float | int | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise BankValidationError(f"{label} must be a number or null")
    if value < 0:
        raise BankValidationError(f"{label} must be non-negative")
    return value


def nullable_text(value: Any, label: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise BankValidationError(f"{label} must be text or null")
    return value


def strings(value: Any, label: str) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise BankValidationError(f"{label} must be an array of text")
    return list(value)


def nutrition(value: Any, label: str) -> dict[str, float | int | None]:
    if not isinstance(value, dict) or set(value) != set(MACROS):
        raise BankValidationError(f"{label} must contain exactly: {', '.join(MACROS)}")
    return {key: nullable_number(value[key], f"{label}.{key}") for key in MACROS}


def normalized_ingredient(value: Any, recipe_id: str, position: int) -> dict[str, Any]:
    label = f"{recipe_id}.ingredients[{position}]"
    if not isinstance(value, dict):
        raise BankValidationError(f"{label} must be an object")
    for key in ("id", "name", "quantity", "unit", "quantityText", "aisle"):
        if key not in value:
            raise BankValidationError(f"{label} is missing {key}")
    ingredient_id = value["id"]
    name = value["name"]
    quantity_text = value["quantityText"]
    aisle = value["aisle"]
    if not all(isinstance(item, str) and item.strip() for item in (ingredient_id, name, aisle)):
        raise BankValidationError(f"{label} id, name, and aisle must be non-empty text")
    if not isinstance(quantity_text, str):
        raise BankValidationError(f"{label}.quantityText must be text; an empty string preserves an unspecified amount")
    return {
        "id": ingredient_id,
        "name": name,
        "quantity": nullable_number(value["quantity"], f"{label}.quantity"),
        "unit": nullable_text(value["unit"], f"{label}.unit"),
        "quantityText": quantity_text,
        "aisle": aisle,
        "sourceText": nullable_text(value.get("sourceText"), f"{label}.sourceText"),
    }


def normalized_recipe(value: Any, position: int) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise BankValidationError(f"recipes[{position}] must be an object")
    required = (
        "id", "name", "roles", "tags", "categories", "ingredients", "steps", "baseServings", "nutrition",
        "reportedNutrition", "nutritionBasis", "sourceUrl", "sourceName", "creatorCredit", "viewCount",
        "viewCountAt", "image", "prepMinutes", "cookMinutes", "mealPrepRating", "mealPrepNotes", "dataGaps",
        "favorite", "addedAt",
    )
    missing = [key for key in required if key not in value]
    if missing:
        raise BankValidationError(f"recipes[{position}] is missing: {', '.join(missing)}")
    recipe_id = value["id"]
    name = value["name"]
    source_name = value["sourceName"]
    meal_prep_notes = value["mealPrepNotes"]
    added_at = value["addedAt"]
    if not all(isinstance(item, str) and item.strip() for item in (recipe_id, name, source_name, added_at)):
        raise BankValidationError(f"recipes[{position}] has an empty required text field")
    if not isinstance(meal_prep_notes, str):
        raise BankValidationError(f"{recipe_id}.mealPrepNotes must be text")
    if not isinstance(value["ingredients"], list) or not value["ingredients"]:
        raise BankValidationError(f"{recipe_id}.ingredients must be a non-empty array")
    if not isinstance(value["favorite"], bool):
        raise BankValidationError(f"{recipe_id}.favorite must be boolean")
    basis = value["nutritionBasis"]
    if basis not in NUTRITION_BASES:
        raise BankValidationError(f"{recipe_id}.nutritionBasis is invalid")
    view_count = nullable_number(value["viewCount"], f"{recipe_id}.viewCount")
    if view_count is not None and int(view_count) != view_count:
        raise BankValidationError(f"{recipe_id}.viewCount must be an integer or null")
    view_count_at = nullable_text(value["viewCountAt"], f"{recipe_id}.viewCountAt")
    if (view_count is None) != (view_count_at is None):
        raise BankValidationError(f"{recipe_id} must preserve viewCount and viewCountAt together")
    return {
        "id": recipe_id,
        "name": name,
        "roles": strings(value["roles"], f"{recipe_id}.roles"),
        "tags": strings(value["tags"], f"{recipe_id}.tags"),
        "categories": strings(value["categories"], f"{recipe_id}.categories"),
        "ingredients": [normalized_ingredient(item, recipe_id, item_position) for item_position, item in enumerate(value["ingredients"], start=1)],
        "steps": strings(value["steps"], f"{recipe_id}.steps"),
        "baseServings": nullable_number(value["baseServings"], f"{recipe_id}.baseServings"),
        "nutrition": nutrition(value["nutrition"], f"{recipe_id}.nutrition"),
        "reportedNutrition": nutrition(value["reportedNutrition"], f"{recipe_id}.reportedNutrition"),
        "nutritionBasis": basis,
        "nutritionEvidence": nullable_text(value.get("nutritionEvidence"), f"{recipe_id}.nutritionEvidence"),
        "sourceUrl": nullable_text(value["sourceUrl"], f"{recipe_id}.sourceUrl"),
        "sourceName": source_name,
        "creatorCredit": nullable_text(value["creatorCredit"], f"{recipe_id}.creatorCredit"),
        "viewCount": int(view_count) if view_count is not None else None,
        "viewCountAt": view_count_at,
        "image": nullable_text(value["image"], f"{recipe_id}.image"),
        "prepMinutes": nullable_number(value["prepMinutes"], f"{recipe_id}.prepMinutes"),
        "cookMinutes": nullable_number(value["cookMinutes"], f"{recipe_id}.cookMinutes"),
        "mealPrepRating": nullable_number(value["mealPrepRating"], f"{recipe_id}.mealPrepRating"),
        "mealPrepNotes": meal_prep_notes,
        "dataGaps": strings(value["dataGaps"], f"{recipe_id}.dataGaps"),
        "favorite": value["favorite"],
        "addedAt": added_at,
    }


def validate_bank(raw: dict[str, Any], expected_count: int) -> tuple[int, list[dict[str, Any]], dict[str, Any]]:
    schema_version = raw.get("schemaVersion")
    if not isinstance(schema_version, int) or isinstance(schema_version, bool):
        raise BankValidationError("schemaVersion must be an integer")
    recipes_raw = raw.get("recipes")
    if not isinstance(recipes_raw, list):
        raise BankValidationError("recipes must be an array")
    if expected_count and len(recipes_raw) != expected_count:
        raise BankValidationError(f"Expected {expected_count} recipes, found {len(recipes_raw)}")
    recipes = [normalized_recipe(recipe, position) for position, recipe in enumerate(recipes_raw, start=1)]
    ids = [recipe["id"] for recipe in recipes]
    if len(ids) != len(set(ids)):
        raise BankValidationError("Recipe IDs must be unique")
    ingredient_ids = [ingredient["id"] for recipe in recipes for ingredient in recipe["ingredients"]]
    if len(ingredient_ids) != len(set(ingredient_ids)):
        raise BankValidationError("Ingredient IDs must be unique across the bank")
    source_recipes = [recipe for recipe in recipes if recipe["sourceUrl"] is not None]
    original_recipes = [recipe for recipe in recipes if recipe["sourceUrl"] is None]
    if any(recipe["viewCount"] is None for recipe in source_recipes):
        raise BankValidationError("Every sourced recipe must retain its view snapshot or be explicitly corrected before export")
    summary = {
        "schema_version": 1,
        "bank_schema_version": schema_version,
        "recipe_count": len(recipes),
        "sourced_recipe_count": len(source_recipes),
        "original_recipe_count": len(original_recipes),
        "ingredient_line_count": len(ingredient_ids),
        "step_count": sum(len(recipe["steps"]) for recipe in recipes),
        "unknown_quantity_count": sum(ingredient["quantity"] is None for recipe in recipes for ingredient in recipe["ingredients"]),
        "nutrition_basis_counts": {basis: sum(recipe["nutritionBasis"] == basis for recipe in recipes) for basis in sorted(NUTRITION_BASES)},
        "reported_macro_value_count": sum(value is not None for recipe in recipes for value in recipe["reportedNutrition"].values()),
        "normalized_macro_value_count": sum(value is not None for recipe in recipes for value in recipe["nutrition"].values()),
        "quality_gap_count": sum(len(recipe["dataGaps"]) for recipe in recipes),
        "view_snapshot_count": sum(recipe["viewCount"] is not None for recipe in recipes),
        "source_text_ingredient_count": sum(bool(ingredient["sourceText"]) for recipe in recipes for ingredient in recipe["ingredients"]),
    }
    return schema_version, recipes, summary


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def csv_value(value: Any) -> Any:
    return "" if value is None else value


def write_csvs(output: Path, recipes: list[dict[str, Any]]) -> None:
    recipe_fields = [
        "id", "name", "base_servings", "nutrition_basis", "nutrition_evidence", "source_url", "source_name",
        "creator_credit", "view_count", "view_count_at", "image", "prep_minutes", "cook_minutes",
        "meal_prep_rating", "meal_prep_notes", "favorite", "added_at", "roles_json", "tags_json",
        "categories_json", "data_gaps_json",
    ] + [f"reported_{macro}" for macro in MACROS] + [f"normalized_{macro}" for macro in MACROS]
    with (output / "recipes.csv").open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=recipe_fields)
        writer.writeheader()
        for recipe in recipes:
            row = {
                "id": recipe["id"], "name": recipe["name"], "base_servings": csv_value(recipe["baseServings"]),
                "nutrition_basis": recipe["nutritionBasis"], "nutrition_evidence": csv_value(recipe["nutritionEvidence"]),
                "source_url": csv_value(recipe["sourceUrl"]), "source_name": recipe["sourceName"],
                "creator_credit": csv_value(recipe["creatorCredit"]), "view_count": csv_value(recipe["viewCount"]),
                "view_count_at": csv_value(recipe["viewCountAt"]), "image": csv_value(recipe["image"]),
                "prep_minutes": csv_value(recipe["prepMinutes"]), "cook_minutes": csv_value(recipe["cookMinutes"]),
                "meal_prep_rating": csv_value(recipe["mealPrepRating"]), "meal_prep_notes": recipe["mealPrepNotes"],
                "favorite": str(recipe["favorite"]).lower(), "added_at": recipe["addedAt"],
                "roles_json": json.dumps(recipe["roles"], ensure_ascii=False),
                "tags_json": json.dumps(recipe["tags"], ensure_ascii=False),
                "categories_json": json.dumps(recipe["categories"], ensure_ascii=False),
                "data_gaps_json": json.dumps(recipe["dataGaps"], ensure_ascii=False),
            }
            row.update({f"reported_{macro}": csv_value(recipe["reportedNutrition"][macro]) for macro in MACROS})
            row.update({f"normalized_{macro}": csv_value(recipe["nutrition"][macro]) for macro in MACROS})
            writer.writerow(row)
    with (output / "recipe-ingredients.csv").open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=["recipe_id", "position", "ingredient_id", "name", "quantity", "unit", "quantity_text", "aisle", "source_text"])
        writer.writeheader()
        for recipe in recipes:
            for position, ingredient in enumerate(recipe["ingredients"], start=1):
                writer.writerow({
                    "recipe_id": recipe["id"], "position": position, "ingredient_id": ingredient["id"],
                    "name": ingredient["name"], "quantity": csv_value(ingredient["quantity"]),
                    "unit": csv_value(ingredient["unit"]), "quantity_text": ingredient["quantityText"],
                    "aisle": ingredient["aisle"], "source_text": csv_value(ingredient["sourceText"]),
                })
    with (output / "recipe-steps.csv").open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=["recipe_id", "position", "instruction"])
        writer.writeheader()
        for recipe in recipes:
            for position, step in enumerate(recipe["steps"], start=1):
                writer.writerow({"recipe_id": recipe["id"], "position": position, "instruction": step})


def create_sqlite(path: Path, recipes: list[dict[str, Any]], summary: dict[str, Any]) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.executescript(
            """
            PRAGMA foreign_keys = ON;
            CREATE TABLE metadata (key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
            CREATE TABLE recipes (
              id TEXT PRIMARY KEY, name TEXT NOT NULL, base_servings REAL,
              nutrition_basis TEXT NOT NULL CHECK(nutrition_basis IN ('per_serving','per_recipe','unspecified','not_stated')),
              nutrition_evidence TEXT,
              normalized_calories REAL, normalized_protein REAL, normalized_carbs REAL, normalized_fat REAL,
              normalized_fiber REAL, normalized_sugar REAL, normalized_sodium REAL,
              reported_calories REAL, reported_protein REAL, reported_carbs REAL, reported_fat REAL,
              reported_fiber REAL, reported_sugar REAL, reported_sodium REAL,
              prep_minutes REAL, cook_minutes REAL
            );
            CREATE TABLE recipe_provenance (
              recipe_id TEXT PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
              source_url TEXT, source_name TEXT NOT NULL, creator_credit TEXT,
              view_count INTEGER, view_count_at TEXT, image TEXT, added_at TEXT NOT NULL
            );
            CREATE TABLE recipe_quality (
              recipe_id TEXT PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
              meal_prep_rating REAL, meal_prep_notes TEXT NOT NULL,
              data_gaps_json TEXT NOT NULL, favorite INTEGER NOT NULL CHECK(favorite IN (0,1))
            );
            CREATE TABLE recipe_ingredients (
              recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
              position INTEGER NOT NULL, ingredient_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
              quantity REAL, unit TEXT, quantity_text TEXT NOT NULL, aisle TEXT NOT NULL, source_text TEXT,
              PRIMARY KEY(recipe_id, position)
            );
            CREATE TABLE recipe_steps (
              recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
              position INTEGER NOT NULL, instruction TEXT NOT NULL,
              PRIMARY KEY(recipe_id, position)
            );
            CREATE TABLE recipe_labels (
              recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
              kind TEXT NOT NULL CHECK(kind IN ('role','tag','category')), label TEXT NOT NULL,
              PRIMARY KEY(recipe_id, kind, label)
            );
            CREATE INDEX recipe_provenance_view_count ON recipe_provenance(view_count DESC);
            CREATE INDEX recipe_ingredients_name ON recipe_ingredients(name COLLATE NOCASE);
            """
        )
        for key, value in summary.items():
            connection.execute("INSERT INTO metadata(key, value_json) VALUES (?, ?)", (key, json.dumps(value, ensure_ascii=False, sort_keys=True)))
        for recipe in recipes:
            connection.execute(
                """INSERT INTO recipes VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    recipe["id"], recipe["name"], recipe["baseServings"], recipe["nutritionBasis"], recipe["nutritionEvidence"],
                    *(recipe["nutrition"][macro] for macro in MACROS),
                    *(recipe["reportedNutrition"][macro] for macro in MACROS),
                    recipe["prepMinutes"], recipe["cookMinutes"],
                ),
            )
            connection.execute(
                "INSERT INTO recipe_provenance VALUES (?,?,?,?,?,?,?,?)",
                (recipe["id"], recipe["sourceUrl"], recipe["sourceName"], recipe["creatorCredit"], recipe["viewCount"], recipe["viewCountAt"], recipe["image"], recipe["addedAt"]),
            )
            connection.execute(
                "INSERT INTO recipe_quality VALUES (?,?,?,?,?)",
                (recipe["id"], recipe["mealPrepRating"], recipe["mealPrepNotes"], json.dumps(recipe["dataGaps"], ensure_ascii=False), int(recipe["favorite"])),
            )
            connection.executemany(
                "INSERT INTO recipe_ingredients VALUES (?,?,?,?,?,?,?,?,?)",
                [
                    (recipe["id"], position, ingredient["id"], ingredient["name"], ingredient["quantity"], ingredient["unit"], ingredient["quantityText"], ingredient["aisle"], ingredient["sourceText"])
                    for position, ingredient in enumerate(recipe["ingredients"], start=1)
                ],
            )
            connection.executemany(
                "INSERT INTO recipe_steps VALUES (?,?,?)",
                [(recipe["id"], position, step) for position, step in enumerate(recipe["steps"], start=1)],
            )
            labels = [(recipe["id"], "role", value) for value in recipe["roles"]]
            labels += [(recipe["id"], "tag", value) for value in recipe["tags"]]
            labels += [(recipe["id"], "category", value) for value in recipe["categories"]]
            connection.executemany("INSERT OR IGNORE INTO recipe_labels VALUES (?,?,?)", labels)
        connection.commit()
        recipe_count = connection.execute("SELECT count(*) FROM recipes").fetchone()[0]
        ingredient_count = connection.execute("SELECT count(*) FROM recipe_ingredients").fetchone()[0]
        integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
        foreign_keys = connection.execute("PRAGMA foreign_key_check").fetchall()
        if recipe_count != summary["recipe_count"] or ingredient_count != summary["ingredient_line_count"] or integrity != "ok" or foreign_keys:
            raise BankValidationError("SQLite validation failed")
    finally:
        connection.close()


def output_readme(summary: dict[str, Any]) -> str:
    return f"""# Mealbook recipe-bank export

This directory was created by `tools/recipe-import/export_bank.py` version {TOOL_VERSION} without a network request.

## Contents

- `recipe-bank-export.json` preserves the application-compatible recipe records.
- `recipes.csv`, `recipe-ingredients.csv`, and `recipe-steps.csv` are relational spreadsheet exports.
- `recipes.sqlite` contains recipes, provenance, quality, ingredients, steps, labels, and metadata.
- `export-summary.json` records validation counts.

## Fidelity rules

- JSON and SQLite retain unknown values as `null`; CSV represents null as an empty cell.
- `reported_*` nutrition is source-reported. `normalized_*` nutrition is preserved separately and is not recalculated by this exporter.
- `nutrition_basis` remains explicit. An unspecified or absent basis must not be treated as per serving.
- Ingredient `quantity` can be null while `quantity_text` and `source_text` retain the available wording.
- `recipe_provenance` retains source URLs, credits, historical view snapshot fields, image references, and add time. Attribution does not grant reuse rights.
- `recipe_quality` retains source gaps and unassigned meal-prep/user fields; no rating or safety claim is invented.

Validated records: {summary['recipe_count']} total; {summary['sourced_recipe_count']} sourced; {summary['original_recipe_count']} original.
"""


def export_bank(output_dir: Path, bank_schema_version: int, recipes: list[dict[str, Any]], summary: dict[str, Any], overwrite: bool) -> None:
    if output_dir.exists() and not overwrite:
        raise BankValidationError(f"Output directory already exists: {output_dir} (use --overwrite to replace it)")
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=f".{output_dir.name}.tmp-", dir=output_dir.parent))
    try:
        export_json = {
            "schema_version": 1,
            "exporter": "export_bank.py",
            "exporter_version": TOOL_VERSION,
            "bank_schema_version": bank_schema_version,
            "recipe_count": len(recipes),
            "fidelity": {
                "unknown_values": "preserved as null; no nutrition or quantity estimation",
                "nutrition": "reported and normalized values remain separate with explicit nutritionBasis",
                "quality": "dataGaps and meal-prep fields retained without new ratings",
                "provenance": "source/view/image fields retained; attribution is not a license",
            },
            "recipes": recipes,
        }
        write_json(temporary / "recipe-bank-export.json", export_json)
        write_csvs(temporary, recipes)
        create_sqlite(temporary / "recipes.sqlite", recipes, summary)
        write_json(temporary / "export-summary.json", summary)
        (temporary / "README.md").write_text(output_readme(summary), encoding="utf-8")
        if output_dir.exists():
            shutil.rmtree(output_dir)
        temporary.replace(output_dir)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise


def main() -> int:
    args = parse_args()
    if not args.validate and args.output_dir is None:
        print("error: --output-dir is required unless --validate is used", file=sys.stderr)
        return 2
    if args.validate and args.output_dir is not None:
        print("error: --validate is read-only; omit --output-dir", file=sys.stderr)
        return 2
    try:
        raw = read_bank(args.input)
        bank_schema_version, recipes, summary = validate_bank(raw, args.expected_count)
        if args.validate:
            print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))
            return 0
        assert args.output_dir is not None
        export_bank(args.output_dir, bank_schema_version, recipes, summary, args.overwrite)
        print(f"Exported {summary['recipe_count']} recipes to {args.output_dir}")
        return 0
    except BankValidationError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    except sqlite3.Error as error:
        print(f"error: SQLite export failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
