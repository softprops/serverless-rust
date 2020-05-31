use lambda::lambda;
use serde_json::Value;

type Error = Box<dyn std::error::Error + Sync + Send + 'static>;

#[lambda]
#[tokio::main]
async fn main(event: Value) -> Result<Value, Error> {
    Ok(event)
}