##############################################################################
# SceneIQ — serverless video-intelligence pipeline (AWS)
#
#   S3 (raw upload) ──event──▶ frame-extractor Lambda (ffmpeg layer)
#                                     │ writes keyframes ──▶ S3 (frames)
#                                     ▼ invokes
#                              recognizer Lambda (ECR container: torch+facenet)
#                                     │ reads cast index (S3)
#                                     ▼ writes intelligence.json ──▶ S3 (results)
#                                     ▼ writes cast timeline ──▶ DynamoDB
#
# `terraform init && terraform apply` provisions the whole stack.
##############################################################################

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = var.region
}

locals {
  name = "sceneiq-${var.env}"
  tags = { Project = "SceneIQ", Env = var.env, ManagedBy = "Terraform" }
}

# ---------------------------------------------------------------- storage
resource "aws_s3_bucket" "uploads" {
  bucket = "${local.name}-uploads"
  tags   = local.tags
}

resource "aws_s3_bucket" "media" {
  bucket = "${local.name}-media" # extracted frames + smart thumbnails
  tags   = local.tags
}

resource "aws_s3_bucket" "results" {
  bucket = "${local.name}-results" # intelligence.json per title
  tags   = local.tags
}

resource "aws_s3_bucket" "cast" {
  bucket = "${local.name}-cast" # enrolled reference embeddings
  tags   = local.tags
}

resource "aws_dynamodb_table" "timeline" {
  name         = "${local.name}-timeline"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "titleId"
  range_key    = "actor"
  attribute {
    name = "titleId"
    type = "S"
  }
  attribute {
    name = "actor"
    type = "S"
  }
  tags = local.tags
}

# ---------------------------------------------------------------- registry
resource "aws_ecr_repository" "recognizer" {
  name                 = "${local.name}-recognizer"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
  tags = local.tags
}

# ---------------------------------------------------------------- iam
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${local.name}-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
  tags               = local.tags
}

data "aws_iam_policy_document" "lambda_perms" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
    resources = [for b in [aws_s3_bucket.uploads, aws_s3_bucket.media, aws_s3_bucket.results, aws_s3_bucket.cast] : b.arn]
  }
  statement {
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = [for b in [aws_s3_bucket.uploads, aws_s3_bucket.media, aws_s3_bucket.results, aws_s3_bucket.cast] : "${b.arn}/*"]
  }
  statement {
    actions   = ["dynamodb:PutItem", "dynamodb:BatchWriteItem", "dynamodb:Query"]
    resources = [aws_dynamodb_table.timeline.arn]
  }
  statement {
    actions   = ["lambda:InvokeFunction"]
    resources = ["*"]
  }
  statement {
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:*:*:*"]
  }
}

resource "aws_iam_role_policy" "lambda" {
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_perms.json
}

# ---------------------------------------------------------------- lambdas
# ffmpeg provided via a layer; frame extractor is a lightweight zip.
resource "aws_lambda_layer_version" "ffmpeg" {
  layer_name          = "${local.name}-ffmpeg"
  filename            = var.ffmpeg_layer_zip
  compatible_runtimes = ["python3.12"]
}

resource "aws_lambda_function" "extractor" {
  function_name = "${local.name}-frame-extractor"
  role          = aws_iam_role.lambda.arn
  runtime       = "python3.12"
  handler       = "frame_extractor.handler"
  filename      = var.extractor_zip
  timeout       = 120
  memory_size   = 1024
  layers        = [aws_lambda_layer_version.ffmpeg.arn]
  environment {
    variables = {
      MEDIA_BUCKET  = aws_s3_bucket.media.bucket
      RECOGNIZER_FN = aws_lambda_function.recognizer.function_name
      SAMPLE_FPS    = "3"
    }
  }
}

# recognizer ships as a container image (torch + facenet are too big for a zip).
resource "aws_lambda_function" "recognizer" {
  function_name = "${local.name}-recognizer"
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.recognizer.repository_url}:${var.image_tag}"
  timeout       = 300
  memory_size   = 3008
  environment {
    variables = {
      CAST_BUCKET    = aws_s3_bucket.cast.bucket
      RESULTS_BUCKET = aws_s3_bucket.results.bucket
      TIMELINE_TABLE = aws_dynamodb_table.timeline.name
    }
  }
}

# ---------------------------------------------------------------- trigger
resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.extractor.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.uploads.arn
}

resource "aws_s3_bucket_notification" "on_upload" {
  bucket = aws_s3_bucket.uploads.id
  lambda_function {
    lambda_function_arn = aws_lambda_function.extractor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_suffix       = ".mp4"
  }
  depends_on = [aws_lambda_permission.allow_s3]
}
