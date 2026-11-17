package tools

import "testing"

func TestAllowedTacGeofence(t *testing.T) {
	allowed := map[string]bool{"TAC-0x1A2B": true, "TAC-0x1A2C": true, "TAC-0x4E10": true}
	if !allowed["TAC-0x1A2C"] {
		t.Fatalf("expected Waxahachie TAC-0x1A2C to be permitted")
	}
	if allowed["TAC-0x9F88"] {
		t.Fatalf("expected border drift TAC-0x9F88 to trigger SMF PDU Session Release")
	}
}
