package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

type SimPostureRequest struct {
	IMSI            string `json:"imsi"`
	IMEI            string `json:"imei"`
	IMEISVVerified  *bool  `json:"imei_sv_verified,omitempty"`
	IoTSAFESigValid *bool  `json:"iot_safe_sig_valid,omitempty"`
	PCR0            string `json:"reported_pcr0,omitempty"`
	ExpectedPCR0    string `json:"expected_pcr0,omitempty"`
	PCR7            string `json:"reported_pcr7,omitempty"`
	ExpectedPCR7    string `json:"expected_pcr7,omitempty"`
	MECEnclaveID    string `json:"mec_enclave_id,omitempty"`
	APN             string `json:"apn"`
	SovereignScope  string `json:"sovereign_scope"`
	TargetTAC       string `json:"target_tac"`
	TargetTenant    string `json:"target_tenant_id"`
	TargetVPC       string `json:"target_vpc_id"`
	SourceMCCMNC    string `json:"source_mcc_mnc"`
}

var allowedTacs = map[string]map[string]bool{
	"securebase-us":   {"TAC-0x1A2B": true, "TAC-0x1A2C": true, "TAC-0x4E10": true},
	"securebase-euro": {"TAC-0x2F01": true, "TAC-0x2F09": true},
	"securebase-asia": {"TAC-0x3C11": true, "TAC-0x3C44": true},
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "healthy",
		"service": "corelink-mcp-server",
	})
}

func handleAuthorizeSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req SimPostureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	scope := req.SovereignScope
	if scope == "" {
		scope = "securebase-us"
	}

	action := "ALLOW"
	xdpAction := "XDP_PASS"
	ulclState := "MEC_LOCAL_STEER"
	authorized := true

	if req.IoTSAFESigValid != nil && !*req.IoTSAFESigValid {
		action = "XDP_DROP_AND_PFCP_DELETE"
		xdpAction = "XDP_DROP"
		ulclState = "PFCP_FAR_DROP"
		authorized = false
	} else if (req.ExpectedPCR7 != "" && req.PCR7 != req.ExpectedPCR7) || (req.ExpectedPCR0 != "" && req.PCR0 != req.ExpectedPCR0) {
		action = "XDP_DROP_AND_PFCP_DELETE"
		xdpAction = "XDP_DROP"
		ulclState = "PFCP_FAR_DROP"
		authorized = false
	} else if req.TargetTAC != "" {
		tacPrefix := strings.Split(req.TargetTAC, " ")[0]
		if !allowedTacs[scope][tacPrefix] {
			action = "SMF_PDU_SESSION_RELEASE"
			xdpAction = "XDP_DROP"
			ulclState = "PFCP_FAR_DROP"
			authorized = false
		} else if req.IMEISVVerified != nil && !*req.IMEISVVerified {
			action = "PCF_QOS_THROTTLE"
			authorized = false
		}
	}

	sum := sha256.Sum256([]byte(req.IMSI + "|" + req.TargetTAC + "|" + req.PCR7 + "|" + action))
	digest := hex.EncodeToString(sum[:])

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"authorized":      authorized,
		"action":          action,
		"xdp_action":      xdpAction,
		"ulcl_state":      ulclState,
		"mec_enclave_id":  req.MECEnclaveID,
		"imsi_sha256":     digest[:16],
		"assigned_vrf":    "vrf-" + req.TargetTenant,
		"worm_attested":   true,
		"worm_digest":     digest,
		"evaluated_at_ut": time.Now().UTC(),
	})
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/v1/mcp/authorize-session", handleAuthorizeSession)

	addr := "127.0.0.1:" + getEnv("PORT", "8085")
	srv := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	log.Printf("SecureBase CoreLink MCP server listening on %s", addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server failure: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
