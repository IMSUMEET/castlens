variable "region" {
  type    = string
  default = "us-east-1"
}

variable "env" {
  type    = string
  default = "dev"
}

variable "image_tag" {
  description = "ECR tag for the recognizer container image"
  type        = string
  default     = "latest"
}

variable "extractor_zip" {
  description = "Path to the frame-extractor Lambda deployment zip"
  type        = string
  default     = "../build/frame_extractor.zip"
}

variable "ffmpeg_layer_zip" {
  description = "Path to the ffmpeg Lambda layer zip"
  type        = string
  default     = "../build/ffmpeg-layer.zip"
}
