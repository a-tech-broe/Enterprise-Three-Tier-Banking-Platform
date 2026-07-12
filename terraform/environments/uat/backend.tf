terraform {
  backend "s3" {
    key     = "uat/terraform.tfstate"
    encrypt = true
  }
}
