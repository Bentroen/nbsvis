use wasm_bindgen::prelude::*;

mod engine;
mod resampler;
mod voice;

pub use engine::Engine;
pub use engine::EngineMetrics;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}
