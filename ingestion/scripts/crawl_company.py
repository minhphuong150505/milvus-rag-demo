import argparse

from src.config import get_settings
from src.pipeline import IngestionPipeline


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl a small list of company URLs into Milvus")
    parser.add_argument("urls", nargs="+")
    args = parser.parse_args()

    pipeline = IngestionPipeline(get_settings())
    total = 0
    for url in args.urls:
        total += pipeline.ingest_url(url)
    print(f"Inserted {total} chunks from {len(args.urls)} URLs.")


if __name__ == "__main__":
    main()
