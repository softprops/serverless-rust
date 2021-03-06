use lambda::{lambda, Context};
use serde_json::Value;

type Error = Box<dyn std::error::Error + Sync + Send + 'static>;

#[lambda]
#[tokio::main]
async fn main(event: Value, _: Context) -> Result<Value, Error> {
    Ok(event)
}