"""AWS Lambda handler #1 — frame extraction.

Triggered by an S3 upload event. Extracts keyframes with ffmpeg (provided via a
Lambda layer at /opt/ffmpeglib/ffmpeg), writes them to the media bucket, and
invokes the recognizer Lambda. Deployed by infra/main.tf.
"""

import json
import os
import subprocess

import boto3

s3 = boto3.client("s3")
lambda_client = boto3.client("lambda")

FFMPEG = "/opt/ffmpeglib/ffmpeg"
MEDIA_BUCKET = os.environ.get("MEDIA_BUCKET", "")
RECOGNIZER_FN = os.environ.get("RECOGNIZER_FN", "sceneiq-dev-recognizer")
SAMPLE_FPS = os.environ.get("SAMPLE_FPS", "3")


def handler(event, _context):
    rec = event["Records"][0]["s3"]
    bucket, key = rec["bucket"]["name"], rec["object"]["key"]
    title_id = os.path.splitext(os.path.basename(key))[0]
    src = f"/tmp/{os.path.basename(key)}"
    s3.download_file(bucket, key, src)

    out_dir = f"/tmp/{title_id}"
    os.makedirs(out_dir, exist_ok=True)
    subprocess.check_call([
        FFMPEG, "-i", src, "-vf", f"fps={SAMPLE_FPS}", "-q:v", "3",
        f"{out_dir}/frame_%04d.jpg", "-y",
    ])

    keys = []
    for fn in sorted(os.listdir(out_dir)):
        dst = f"{title_id}/{fn}"
        s3.upload_file(f"{out_dir}/{fn}", MEDIA_BUCKET, dst)
        keys.append(dst)

    lambda_client.invoke(
        FunctionName=RECOGNIZER_FN, InvocationType="Event",
        Payload=json.dumps({"title_id": title_id, "media_bucket": MEDIA_BUCKET, "frame_keys": keys}),
    )
    return {"statusCode": 200, "body": f"extracted {len(keys)} frames for {title_id}"}
