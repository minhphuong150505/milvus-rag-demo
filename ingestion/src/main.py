import argparse
import json
from pathlib import Path

from src.config import get_settings
from src.pipeline import IngestionPipeline


def main() -> None:
    parser = argparse.ArgumentParser(description="RAG chatbot ingestion CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    create = subparsers.add_parser("create-collection", help="Create the Milvus collection")
    create.add_argument("--drop-existing", action="store_true", help="Drop and recreate the collection")

    ingest = subparsers.add_parser("ingest", help="Ingest files from a path")
    ingest.add_argument("--path", default="data/raw", help="File or directory to ingest")

    ingest_url = subparsers.add_parser("ingest-url", help="Ingest one or more URLs")
    ingest_url.add_argument("urls", nargs="+")

    query = subparsers.add_parser("query", help="Embed a question and search Milvus")
    query.add_argument("question")
    query.add_argument("--top-k", type=int, default=5)

    args = parser.parse_args()
    pipeline = IngestionPipeline(get_settings())

    if args.command == "create-collection":
        pipeline.create_collection(drop_existing=args.drop_existing)
        print("Collection is ready.")
        return

    if args.command == "ingest":
        inserted = pipeline.ingest_path(Path(args.path))
        print(f"Inserted {inserted} chunks.")
        return

    if args.command == "ingest-url":
        total = 0
        for url in args.urls:
            total += pipeline.ingest_url(url)
        print(f"Inserted {total} chunks.")
        return

    if args.command == "query":
        results = pipeline.query(args.question, top_k=args.top_k)
        print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
