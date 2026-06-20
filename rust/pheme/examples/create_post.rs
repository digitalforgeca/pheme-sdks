//! Example: create a post using an API key.

use pheme_sdk::{
    PhemeClient, PhemeConfigBuilder, PhemeResult,
    types::CreatePostRequest,
};

#[tokio::main]
async fn main() -> PhemeResult<()> {
    let api_key = std::env::var("PHEME_API_KEY")
        .expect("set PHEME_API_KEY env var to your API key");

    let client = PhemeClient::new(
        PhemeConfigBuilder::new()
            .api_key(api_key)
            .build(),
    )?;

    let post = client
        .create_post(CreatePostRequest {
            title: "Hello from Rust!".into(),
            body: "Posted via the pheme-sdk Rust crate.".into(),
            tags: Some(vec!["rust".into(), "sdk".into()]),
            category: None,
        })
        .await?;

    println!("Created post: {} (id: {})", post.title, post.id);
    Ok(())
}
