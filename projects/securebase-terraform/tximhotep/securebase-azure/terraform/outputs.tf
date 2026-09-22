output "resource_group_name" {
  value = azurerm_resource_group.securebase_rg.name
}

output "key_vault_uri" {
  value = azurerm_key_vault.securebase_kv.vault_uri
}

output "storage_account_name" {
  value = azurerm_storage_account.evidence_storage.name
}

output "evidence_container_id" {
  value = azurerm_storage_container.evidence_container.id
}
