resource "azurerm_resource_group" "securebase_rg" {
  name     = var.resource_group_name
  location = var.location
  tags = {
    Environment = var.environment
    Platform    = "SecureBase"
    Governance  = "FrictionAcceptance"
  }
}

data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "securebase_kv" {
  name                        = "kv-sb-${var.environment}-${substr(md5(azurerm_resource_group.securebase_rg.id), 0, 8)}"
  location                    = azurerm_resource_group.securebase_rg.location
  resource_group_name         = azurerm_resource_group.securebase_rg.name
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  sku_name                    = "standard"
  soft_delete_retention_days  = 90
  purge_protection_enabled    = true

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    key_permissions = [
      "Create", "Get", "List", "Delete", "Purge", "Recover", "Update", "GetRotationPolicy", "SetRotationPolicy"
    ]
  }
}

resource "azurerm_key_vault_key" "evidence_key" {
  name         = "securebase-evidence-key"
  key_vault_id = azurerm_key_vault.securebase_kv.id
  key_type     = "RSA"
  key_size     = 4096

  key_opts = [
    "decrypt", "encrypt", "sign", "unwrapKey", "verify", "wrapKey"
  ]

  rotation_policy {
    automatic {
      time_before_expiry = "P30D"
    }
    expire_after         = "P365D" # 365-day rotation
    notify_before_expiry = "P29D"
  }
}
