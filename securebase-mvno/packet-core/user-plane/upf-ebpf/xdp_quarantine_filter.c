// SPDX-License-Identifier: Apache-2.0
// TxImhotep LLC - Policy-Before-Packet Kernel eBPF XDP Cellular Quarantine Filter
// Attached to sovereign VPC / MEC UPF ingress NIC hook prior to sk_buff allocation.

#include <linux/bpf.h>
#include <linux/if_ether.h>
#include <linux/ip.h>
#include <linux/udp.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_endian.h>

#define GTPU_PORT 2152

struct ue_policy_state {
    __u8  permit_forward; // 1 = XDP_PASS, 0 = XDP_DROP
    __u8  ulcl_mec_steer; // 1 = Local MEC Enclave, 0 = Drop/Quarantine
    __u32 pcr_epoch;
};

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 65536);
    __type(key, __u32); // Assigned UE private IPv4 (network byte order)
    __type(value, struct ue_policy_state);
} xdp_permit_ip_map SEC(".maps");

struct {
    __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
    __uint(max_entries, 2); // 0 = passed_packets, 1 = dropped_packets
    __type(key, __u32);
    __type(value, __u64);
} xdp_quarantine_stats SEC(".maps");

static __always_inline void bump_stat(__u32 idx) {
    __u64 *cnt = bpf_map_lookup_elem(&xdp_quarantine_stats, &idx);
    if (cnt) {
        __sync_fetch_and_add(cnt, 1);
    }
}

SEC("xdp")
int securebase_edge_xdp_quarantine(struct xdp_md *ctx) {
    void *data_end = (void *)(long)ctx->data_end;
    void *data     = (void *)(long)ctx->data;

    struct ethhdr *eth = data;
    if ((void *)(eth + 1) > data_end)
        return XDP_PASS;

    if (eth->h_proto != bpf_htons(ETH_P_IP))
        return XDP_PASS;

    struct iphdr *ip = (void *)(eth + 1);
    if ((void *)(ip + 1) > data_end)
        return XDP_PASS;

    __u32 src_ip = ip->saddr;
    struct ue_policy_state *state = bpf_map_lookup_elem(&xdp_permit_ip_map, &src_ip);

    // Fail-closed policy-before-packet enforcement: drop prior to sk_buff allocation
    if (!state || state->permit_forward == 0) {
        bump_stat(1);
        return XDP_DROP;
    }

    bump_stat(0);
    return XDP_PASS;
}

char _license[] SEC("license") = "Apache-2.0";
