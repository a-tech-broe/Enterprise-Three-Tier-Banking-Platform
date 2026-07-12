terraform {
  backend "s3" {
    key     = "qa/terraform.tfstate"
    encrypt = true
  }
}
