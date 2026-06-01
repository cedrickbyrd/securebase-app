variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "zip_path" { type = string, default = "../../../files/phase6/db_migrator.zip" }
variable "allowed_secret_arns" { type = list(string) }
variable "invoker_role_arns" { type = list(string), default = [] }
variable "tags" { type = map(string), default = {} }
