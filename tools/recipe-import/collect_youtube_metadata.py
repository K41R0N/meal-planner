#!/usr/bin/env python3
"""Collect public YouTube metadata for a finite, supplied catalog.

This is deliberately metadata-only: no media, thumbnails, subtitles, cookies,
accounts, proxy configuration, or anti-bot evasion are used. It makes one
bounded, no-retry request at a time and stops on a detected access block.
Requires a local yt-dlp executable but otherwise uses only the Python stdlib.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import selectors
import subprocess
import sys
import time
from typing import Any

TOOL_VERSION = "1.0"
VIDEO_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{11}$")
BLOCK_PATTERN = re.compile(r"sign in to confirm|not a bot|captcha|bot check|login required", re.IGNORECASE)
NOT_FOUND_PATTERN = re.compile(
    r"video unavailable|this video is unavailable|private video|video is private|has been removed|video not found",
    re.IGNORECASE,
)


class ValidationError(ValueError):
    """Raised when a caller-supplied catalog cannot be processed safely."""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def positive_integer(raw: str) -> int:
    value = int(raw)
    if value <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return value


def path_from(raw: str) -> Path:
    return Path(raw).expanduser()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Collect bounded public YouTube metadata from an explicit catalog; never downloads media."
    )
    parser.add_argument("--catalog", required=True, type=path_from, help="Path to a finite channel catalog JSON file.")
    parser.add_argument("--output-dir", required=True, type=path_from, help="New or existing directory for one metadata JSON file per video.")
    parser.add_argument("--manifest", required=True, type=path_from, help="Path for the explicit collection manifest JSON.")
    parser.add_argument(
        "--maximum-videos",
        required=True,
        type=positive_integer,
        help="Maximum catalog entries to attempt; must not exceed the catalog length.",
    )
    parser.add_argument("--yt-dlp", default="yt-dlp", help="Local yt-dlp executable name or path (default: yt-dlp).")
    parser.add_argument("--timeout-seconds", type=positive_integer, default=45, help="Per-video subprocess deadline (default: 45).")
    parser.add_argument(
        "--metadata-output-limit-bytes",
        type=positive_integer,
        default=1024 * 1024,
        help="Maximum stdout JSON bytes per video (default: 1048576).",
    )
    parser.add_argument("--reuse-existing", action="store_true", help="Reuse a matching existing metadata JSON record instead of requesting it again.")
    return parser.parse_args()


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ValidationError(f"Catalog does not exist: {path}") from error
    except UnicodeDecodeError as error:
        raise ValidationError(f"Catalog is not UTF-8 text: {path}") from error
    except json.JSONDecodeError as error:
        raise ValidationError(f"Catalog is not valid JSON: {path}: {error.msg}") from error


def catalog_entries(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    catalog = read_json(path)
    if not isinstance(catalog, dict):
        raise ValidationError("Catalog root must be a JSON object")
    channel_url = catalog.get("channel_url")
    if not isinstance(channel_url, str) or not channel_url.startswith("https://"):
        raise ValidationError("Catalog channel_url must be an https URL")
    entries = catalog.get("entries")
    if not isinstance(entries, list) or not entries:
        raise ValidationError("Catalog entries must be a non-empty array")
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for position, entry in enumerate(entries, start=1):
        if not isinstance(entry, dict):
            raise ValidationError(f"Catalog entry {position} must be an object")
        video_id = entry.get("id")
        if not isinstance(video_id, str) or not VIDEO_ID_PATTERN.fullmatch(video_id):
            raise ValidationError(f"Catalog entry {position} has an invalid 11-character video id")
        if video_id in seen:
            raise ValidationError(f"Catalog contains duplicate video id: {video_id}")
        seen.add(video_id)
        normalized.append({"id": video_id})
    return catalog, normalized


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def safe_environment() -> dict[str, str]:
    """Run yt-dlp without inherited provider credentials or user configuration."""
    return {
        "PATH": os.environ.get("PATH", ""),
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
    }


def bounded_process(command: list[str], timeout_seconds: int, stdout_limit: int) -> dict[str, Any]:
    """Capture bounded stdout/stderr without a shell or inherited secret environment."""
    process = subprocess.Popen(
        command,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=os.getcwd(),
        env=safe_environment(),
        shell=False,
    )
    assert process.stdout is not None and process.stderr is not None
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ, "stdout")
    selector.register(process.stderr, selectors.EVENT_READ, "stderr")
    stdout_chunks: list[bytes] = []
    stderr_chunks: list[bytes] = []
    stdout_size = 0
    stderr_size = 0
    stderr_limit = 4096
    started = time.monotonic()
    reason: str | None = None

    try:
        while selector.get_map():
            remaining = timeout_seconds - (time.monotonic() - started)
            if remaining <= 0:
                reason = "timeout"
                break
            for key, _ in selector.select(timeout=remaining):
                try:
                    chunk = os.read(key.fileobj.fileno(), 65536)
                except OSError:
                    chunk = b""
                if not chunk:
                    selector.unregister(key.fileobj)
                    continue
                if key.data == "stdout":
                    keep = max(0, stdout_limit + 1 - stdout_size)
                    stdout_chunks.append(chunk[:keep])
                    stdout_size += len(chunk)
                    if stdout_size > stdout_limit:
                        reason = "output_limit"
                        break
                else:
                    keep = max(0, stderr_limit - stderr_size)
                    stderr_chunks.append(chunk[:keep])
                    stderr_size += len(chunk)
            if reason is not None:
                break
    finally:
        selector.close()

    if reason is not None and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=1)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=1)
    else:
        try:
            process.wait(timeout=1)
        except subprocess.TimeoutExpired:
            reason = reason or "timeout"
            process.kill()
            process.wait(timeout=1)

    return {
        "returncode": process.returncode,
        "stdout": b"".join(stdout_chunks).decode("utf-8", errors="replace"),
        "stderr": b"".join(stderr_chunks).decode("utf-8", errors="replace"),
        "reason": reason,
    }


def classify_failure(result: dict[str, Any]) -> str:
    diagnostic = f"{result['stderr']}\n{result['stdout']}"
    if result["reason"] == "timeout":
        return "timeout"
    if result["reason"] == "output_limit":
        return "output_limit"
    if BLOCK_PATTERN.search(diagnostic):
        return "blocked"
    if NOT_FOUND_PATTERN.search(diagnostic):
        return "not_found"
    return "failed"


def metadata_command(executable: str, video_id: str, timeout_seconds: int) -> list[str]:
    """Keep command options explicit: metadata JSON only, no config, no download, no retries."""
    return [
        executable,
        "--no-config-locations",
        "--ignore-config",
        "--skip-download",
        "--ignore-no-formats-error",
        "--no-playlist",
        "--no-warnings",
        "--socket-timeout",
        str(min(timeout_seconds, 30)),
        "--retries",
        "0",
        "--extractor-retries",
        "0",
        "--dump-single-json",
        "--",
        f"https://www.youtube.com/watch?v={video_id}",
    ]


def selected_metadata(raw: Any, catalog: dict[str, Any], video_id: str) -> dict[str, Any]:
    if not isinstance(raw, dict) or raw.get("id") != video_id:
        raise ValidationError("yt-dlp did not return matching metadata")
    view_count = raw.get("view_count")
    if view_count is not None and (not isinstance(view_count, int) or isinstance(view_count, bool) or view_count < 0):
        view_count = None
    selected = {
        "schema_version": 1,
        "metadata_only": True,
        "media_downloaded": False,
        "id": video_id,
        "title": raw.get("title") if isinstance(raw.get("title"), str) else None,
        "description": raw.get("description") if isinstance(raw.get("description"), str) else None,
        "view_count": view_count,
        "upload_date": raw.get("upload_date") if isinstance(raw.get("upload_date"), str) else None,
        "duration": raw.get("duration") if isinstance(raw.get("duration"), (int, float)) and not isinstance(raw.get("duration"), bool) else None,
        "channel_id": raw.get("channel_id") if isinstance(raw.get("channel_id"), str) else None,
        "channel": raw.get("channel") if isinstance(raw.get("channel"), str) else None,
        "uploader": raw.get("uploader") if isinstance(raw.get("uploader"), str) else None,
        "uploader_id": raw.get("uploader_id") if isinstance(raw.get("uploader_id"), str) else None,
        "webpage_url": raw.get("webpage_url") if isinstance(raw.get("webpage_url"), str) else f"https://www.youtube.com/watch?v={video_id}",
        "source_catalog_channel_id": catalog.get("channel_id") if isinstance(catalog.get("channel_id"), str) else None,
        "source_catalog_channel_url": catalog["channel_url"],
        "collected_at": utc_now(),
        "collector": "yt-dlp metadata-only",
    }
    return selected


def existing_record(path: Path, video_id: str) -> bool:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return False
    return isinstance(data, dict) and data.get("id") == video_id and data.get("metadata_only") is True


def manifest_template(catalog: dict[str, Any], args: argparse.Namespace, expected: int) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "tool": "collect_youtube_metadata.py",
        "tool_version": TOOL_VERSION,
        "metadata_only": True,
        "media_downloaded": False,
        "authentication_used": False,
        "cookies_used": False,
        "channel_id": catalog.get("channel_id") if isinstance(catalog.get("channel_id"), str) else None,
        "channel_url": catalog["channel_url"],
        "catalog_entries": expected,
        "maximum_videos": args.maximum_videos,
        "timeout_seconds": args.timeout_seconds,
        "metadata_output_limit_bytes": args.metadata_output_limit_bytes,
        "started_at": utc_now(),
        "status": "running",
        "results": [],
    }


def main() -> int:
    args = parse_args()
    try:
        catalog, entries = catalog_entries(args.catalog)
        if args.maximum_videos > len(entries):
            raise ValidationError("--maximum-videos cannot exceed the catalog entry count")
        if args.manifest.resolve().parent == args.output_dir.resolve() and args.manifest.name.endswith(".json"):
            # A manifest can live beside output files, but must not collide with a video record.
            if args.manifest.stem in {entry["id"] for entry in entries}:
                raise ValidationError("--manifest must not use a catalog video id as its filename")
    except ValidationError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    args.output_dir.mkdir(parents=True, exist_ok=True)
    selected = entries[: args.maximum_videos]
    manifest = manifest_template(catalog, args, len(entries))
    stopped_on_block = False

    for position, entry in enumerate(selected, start=1):
        video_id = entry["id"]
        record_path = args.output_dir / f"{video_id}.json"
        if args.reuse_existing and existing_record(record_path, video_id):
            manifest["results"].append({"position": position, "id": video_id, "status": "reused", "record_file": record_path.name})
            continue
        try:
            result = bounded_process(
                metadata_command(args.yt_dlp, video_id, args.timeout_seconds),
                args.timeout_seconds,
                args.metadata_output_limit_bytes,
            )
        except OSError as error:
            manifest["results"].append({"position": position, "id": video_id, "status": "failed", "error": str(error)[:500]})
            continue

        if result["returncode"] != 0 or result["reason"] is not None:
            category = classify_failure(result)
            manifest["results"].append(
                {
                    "position": position,
                    "id": video_id,
                    "status": category,
                    "stderr": result["stderr"][-1000:],
                    "reason": result["reason"],
                }
            )
            if category == "blocked":
                stopped_on_block = True
                break
            continue
        try:
            record = selected_metadata(json.loads(result["stdout"]), catalog, video_id)
            atomic_json(record_path, record)
        except (ValidationError, json.JSONDecodeError) as error:
            manifest["results"].append({"position": position, "id": video_id, "status": "failed", "error": str(error)[:500]})
            continue
        manifest["results"].append({"position": position, "id": video_id, "status": "ok", "record_file": record_path.name})

    attempted = len(manifest["results"])
    failures = [item for item in manifest["results"] if item["status"] not in {"ok", "reused"}]
    manifest["completed_at"] = utc_now()
    manifest["attempted_videos"] = attempted
    manifest["successful_videos"] = sum(item["status"] in {"ok", "reused"} for item in manifest["results"])
    manifest["failed_videos"] = len(failures)
    manifest["stopped_on_block"] = stopped_on_block
    manifest["status"] = "blocked" if stopped_on_block else ("completed" if not failures and attempted == len(selected) else "completed_with_failures")
    atomic_json(args.manifest, manifest)
    print(
        f"Collection {manifest['status']}: {manifest['successful_videos']} successful, "
        f"{manifest['failed_videos']} failed, {attempted}/{len(selected)} attempted. Manifest: {args.manifest}"
    )
    return 0 if manifest["status"] == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
