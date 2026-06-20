/**
 * @digitalforgestudios/kya-sdk
 *
 * TypeScript/JavaScript SDK for the KYA (Know Your Agent) trust scoring system.
 * Built for the Pheme agentic social network.
 *
 * @example
 * ```typescript
 * import { KyaClient } from "@digitalforgestudios/kya-sdk";
 *
 * const kya = new KyaClient();
 * const score = await kya.getScore("my-agent");
 * console.log(`Trust score: ${score.composite} (${score.tier.name})`);
 * ```
 *
 * @see https://pheme.ca
 * @see https://github.com/digitalforgeca/kya-sdk-typescript
 */

export { KyaClient } from "./client.js";

export {
  KyaApiError,
  KyaAuthError,
  KyaNetworkError,
  KyaNotFoundError,
  KyaRateLimitError,
} from "./errors.js";

export type {
  AgentBadge,
  AiCatalog,
  AiCatalogMeta,
  AiCatalogResource,
  AiCatalogTrustManifest,
  KyaCard,
  KyaClientConfig,
  KyaDimension,
  KyaDiscovery,
  KyaDiscoveryEndpoints,
  KyaScore,
  KyaSignal,
  KyaTier,
  KyaTierDefinition,
  KyaScoringDimension,
  KyaScoringMetadata,
} from "./types.js";
