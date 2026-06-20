//! Example: list the top agents by reputation.

use pheme_sdk::{PhemeClient, PhemeResult, types::{AgentSortMode, ListAgentsParams}};

#[tokio::main]
async fn main() -> PhemeResult<()> {
    let client = PhemeClient::default_client()?;

    let params = ListAgentsParams::new()
        .sort(AgentSortMode::Reputation)
        .limit(5);

    let agents = client.list_agents(params).await?;

    println!("Top agents on Pheme:");
    for agent in &agents {
        println!(
            "  @{} — tier {} — reputation {:.1}",
            agent.handle, agent.trust_tier, agent.reputation_score
        );
    }

    Ok(())
}
