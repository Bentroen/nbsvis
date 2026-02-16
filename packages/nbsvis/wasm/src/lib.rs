use wasm_bindgen::prelude::*;

#[derive(Clone)]
struct Voice {
    sample_id: usize,
    position: f32,
    gain_l: f32,
    gain_r: f32,
    step: f32,
}

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub struct Engine {
    voices: Vec<Voice>,
    max_voices: usize,

    sample_atlas: Vec<f32>,
    sample_offsets: Vec<usize>,
    sample_lengths: Vec<usize>,
}

#[wasm_bindgen]
impl Engine {
    #[wasm_bindgen(constructor)]
    pub fn new(max_voices: usize) -> Engine {
        Engine {
            voices: Vec::with_capacity(max_voices),
            max_voices,
            sample_atlas: Vec::new(),
            sample_offsets: Vec::new(),
            sample_lengths: Vec::new(),
        }
    }

    pub fn set_sample_atlas(&mut self, atlas: &[f32], offsets: &[usize], lengths: &[usize]) {
        self.sample_atlas.clear();
        self.sample_atlas.extend_from_slice(atlas);

        self.sample_offsets.clear();
        self.sample_offsets.extend_from_slice(offsets);

        self.sample_lengths.clear();
        self.sample_lengths.extend_from_slice(lengths);
    }

    pub fn spawn(&mut self, sample_id: usize, gain: f32, pan: f32, pitch: f32) {
        if self.voices.len() >= self.max_voices {
            self.voices.remove(0); // basic voice stealing
        }

        let gain_l = gain * (1.0 - pan);
        let gain_r = gain * pan;

        self.voices.push(Voice {
            sample_id,
            position: 0.0,
            gain_l,
            gain_r,
            step: pitch,
        });
    }

    pub fn reset(&mut self) {
        self.voices.clear();
    }

    pub fn trim(&mut self, max: usize) {
        self.max_voices = max;
        if self.voices.len() > max {
            self.voices.drain(0..(self.voices.len() - max));
        }
    }

    pub fn active_count(&self) -> usize {
        self.voices.len()
    }

    pub fn render(&mut self, output_l: &mut [f32], output_r: &mut [f32]) {
        let frames = output_l.len();

        for voice in &mut self.voices {
            let sample_id = voice.sample_id;

            if sample_id >= self.sample_offsets.len() {
                continue;
            }

            let offset = self.sample_offsets[sample_id];
            let length = self.sample_lengths[sample_id];

            let mut pos = voice.position;

            for i in 0..frames {
                let idx = pos as usize;

                if idx >= length {
                    break;
                }

                let s = self.sample_atlas[offset + idx];

                output_l[i] += s * voice.gain_l;
                output_r[i] += s * voice.gain_r;

                pos += voice.step;
            }

            voice.position = pos;
        }

        // Remove finished voices
        self.voices.retain(|v| {
            let id = v.sample_id;

            if id >= self.sample_lengths.len() {
                return false;
            }

            let length = self.sample_lengths[id];
            (v.position as usize) < length
        });
    }
}