output "uploads_bucket" {
  description = "Drop .mp4 files here to trigger the pipeline"
  value       = aws_s3_bucket.uploads.bucket
}

output "results_bucket" {
  description = "intelligence.json is written here per title"
  value       = aws_s3_bucket.results.bucket
}

output "recognizer_ecr_url" {
  description = "Push the recognizer container image here"
  value       = aws_ecr_repository.recognizer.repository_url
}

output "timeline_table" {
  value = aws_dynamodb_table.timeline.name
}
