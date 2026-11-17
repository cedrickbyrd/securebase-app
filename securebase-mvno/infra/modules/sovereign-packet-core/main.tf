# Sovereign Packet Core Module: free5GC R17+ with eBPF/gtp5g Data Plane
variable "project_id" { type = string }
variable "sovereign_scope" { type = string }
variable "primary_region" { type = string }
variable "hsm_cmek_key_id" { type = string }

resource "google_container_cluster" "mvno_core" {
  name     = "securebase-mvno-${var.sovereign_scope}"
  location = var.primary_region

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = true
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  database_encryption {
    state    = "ENCRYPTED"
    key_name = var.hsm_cmek_key_id
  }
}

resource "google_container_node_pool" "upf_ebpf_nodes" {
  name       = "upf-gtp5g-dataplane"
  cluster    = google_container_cluster.mvno_core.id
  node_count = 2 # HA Compute-Optimized UPF Nodes (8 vCPU, 32 GB RAM)

  node_config {
    machine_type = "c2d-standard-8"
    image_type   = "UBUNTU_CONTAINERD" # Custom hardened gtp5g + eBPF kernel
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }
}
