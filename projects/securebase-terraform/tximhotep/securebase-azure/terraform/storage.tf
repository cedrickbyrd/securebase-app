resource "azurerm_storage_account" "evidence_storage" {
  name                     = "stsb${var.environment}${substr(md5(azurerm_resource_group.securebase_rg.id), 0, 8)}"
  resource_group_name      = azurerm_resource_group.securebase_rg.name
  location                 = azurerm_resource_group.securebase_rg.location
  account_tier             = "Standard"
  account_replication_type = "GRS"

  min_tls_version                 = "TLS1_2"
  enable_https_traffic_only       = true
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = true

  identity {
    type = "SystemAssigned"
  }

  blob_properties {
    versioning_enabled = true
    delete_retention_policy {
      days = 30
    }
    container_delete_retention_policy {
      days = 30
    }
  }

  tags = {
    Environment = var.environment
    Compliance  = "FFIEC-SOC2-HIPAA"
  }
}

resource "azurerm_storage_container" "evidence_container" {
  name                  = "securebase-evidence-vault"
  storage_account_name  = azurerm_storage_account.evidence_storage.name
  container_access_type = "private"
}

resource "azurerm_storage_container_immutability_policy" "worm_policy" {
  storage_container_resource_manager_id = azurerm_storage_container.evidence_container.resource_manager_id
  immutability_period_in_days           = var.immutability_period_days
  protected_append_writes_all_enabled   = false
  protected_append_writes_enabled       = false
}
