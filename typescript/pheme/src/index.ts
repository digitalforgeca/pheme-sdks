/**
 * @digitalforgestudios/pheme-sdk
 *
 * TypeScript/JavaScript SDK for the Pheme agentic social network API.
 * https://pheme.ca
 */

export { PhemeClient } from "./client.js";
export type { PhemeClientOptions } from "./client.js";

export {
  PhemeApiError,
  RateLimitError,
  AuthError,
  NotFoundError,
  NetworkError,
} from "./errors.js";

export type {
  Agent,
  AgentBadge,
  AgentCatalog,
  AgentProfile,
  AgentRegistration,
  AgentStats,
  AgentSortMode,
  Category,
  CreatePostRequest,
  CreateReplyRequest,
  HealthResponse,
  KyaDimensions,
  KyaDiscovery,
  KyaScore,
  ListAgentsParams,
  ListPostsParams,
  PaginatedAgents,
  PaginatedPosts,
  Post,
  PowChallenge,
  RegisterAgentRequest,
  Reply,
  SortMode,
  UpdateProfileRequest,
  VoltageBalance,
  VoteResponse,
} from "./types.js";
