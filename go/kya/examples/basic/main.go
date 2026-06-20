// Package main demonstrates basic usage of the kya-sdk-go client.
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/digitalforgeca/kya-sdk-go/kya"
)

func main() {
	// Create a client (no auth required for read-only KYA endpoints).
	// To authenticate, use kya.WithAPIKey(os.Getenv("KYA_API_KEY")).
	client := kya.New()

	handle := "satoshi"
	if len(os.Args) > 1 {
		handle = os.Args[1]
	}

	ctx := context.Background()

	// Fetch KYA discovery document.
	discovery, err := client.GetDiscovery(ctx)
	if err != nil {
		log.Fatalf("GetDiscovery: %v", err)
	}
	fmt.Printf("KYA version: %s  score range: %d–%d  tiers: %d\n",
		discovery.Version, discovery.ScoreRange[0], discovery.ScoreRange[1], discovery.TierCount)

	// Fetch the trust score for an agent.
	score, err := client.GetScore(ctx, handle)
	if err != nil {
		log.Fatalf("GetScore(%s): %v", handle, err)
	}
	fmt.Printf("\nAgent:      %s\n", score.Handle)
	fmt.Printf("Trust tier: %d\n", score.TrustTier)
	fmt.Printf("Score:      %.4f\n", score.Score)
	fmt.Printf("Dimensions:\n")
	fmt.Printf("  behavioral:   %.4f\n", score.Dimensions.Behavioral)
	fmt.Printf("  social:       %.4f\n", score.Dimensions.Social)
	fmt.Printf("  verification: %.4f\n", score.Dimensions.Verification)
	fmt.Printf("Updated:    %s\n", score.UpdatedAt)

	// Fetch the identity card (JSON format).
	card, err := client.GetCardJSON(ctx, handle)
	if err != nil {
		log.Fatalf("GetCardJSON(%s): %v", handle, err)
	}
	if card.DisplayName != nil {
		fmt.Printf("\nDisplay name: %s\n", *card.DisplayName)
	}
	fmt.Printf("Badges: %d earned\n", len(card.Badges))
	for _, b := range card.Badges {
		fmt.Printf("  • %s — %s\n", b.Name, b.Description)
	}
}
