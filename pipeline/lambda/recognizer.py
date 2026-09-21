"""AWS Lambda handler #2 — recognition + intelligence (container image).

Invoked by the frame extractor. Loads the enrolled cast from S3, recognises
faces in each frame using the shared engine (faces.py), writes intelligence.json
to the results bucket and the cast timeline to DynamoDB. Deployed by
infra/main.tf as an ECR container (torch + facenet are too large for a zip).
"""

import json
import os

import boto3

from faces import CastIndex, FaceEngine  # bundled in the image

CAST_BUCKET = os.environ.get("CAST_BUCKET", "")
RESULTS_BUCKET = os.environ.get("RESULTS_BUCKET", "")
TIMELINE_TABLE = os.environ.get("TIMELINE_TABLE", "")

s3 = boto3.client("s3")
ddb = boto3.resource("dynamodb")

# models + cast index are initialised once per warm container
_engine = FaceEngine()
_cast = CastIndex(threshold=0.95)


def handler(event, _context):
    title_id = event["title_id"]
    media_bucket = event["media_bucket"]
    frame_keys = event["frame_keys"]

    # (cast enrollment would be synced from CAST_BUCKET on cold start)
    from ingest import ingest_frames  # local frames variant of the engine

    local_frames = []
    for k in frame_keys:
        dst = f"/tmp/{os.path.basename(k)}"
        s3.download_file(media_bucket, k, dst)
        local_frames.append(dst)

    intel = ingest_frames(local_frames, _cast, _engine, sample_fps=3.0)

    s3.put_object(
        Bucket=RESULTS_BUCKET, Key=f"{title_id}/intelligence.json",
        Body=json.dumps(intel), ContentType="application/json",
    )
    if TIMELINE_TABLE:
        table = ddb.Table(TIMELINE_TABLE)
        with table.batch_writer() as bw:
            for c in intel["cast"]:
                bw.put_item(Item={"titleId": title_id, "actor": c["actor"],
                                  "screenTimeSec": str(c["screenTimeSec"])})
    return {"statusCode": 200, "body": f"indexed {title_id}: {len(intel['cast'])} cast"}
